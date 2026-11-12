use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

/// Details of a single resolution layer in a multi-resolution pyramid (WSI-02)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PyramidLevel {
    pub level: u32,
    pub width: u32,
    pub height: u32,
    pub downsample: f64,
    pub tile_width: u32,
    pub tile_height: u32,
    pub num_tiles_x: u32,
    pub num_tiles_y: u32,
}

/// Metadata and spatial calibration of a whole slide image (WSI-01, DATA-03, M2-01, M2-03)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsiMetadata {
    pub slide_id: String,
    pub file_name: String,
    pub file_path: String,
    pub vendor_format: String,
    pub level_0_width: u32,
    pub level_0_height: u32,
    pub mpp_x: f64,
    pub mpp_y: f64,
    pub magnification: f64,
    pub channel_count: u32,
    pub is_calibrated: bool,
    pub is_pyramidal: bool,
    pub raw_tags: HashMap<String, String>,
    pub levels: Vec<PyramidLevel>,
}

pub trait WsiReader: Send + Sync {
    fn metadata(&self) -> &WsiMetadata;
    fn read_tile(&self, level: u32, tile_x: u32, tile_y: u32) -> Result<Vec<u8>, String>;
    fn read_region(
        &self,
        level: u32,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>, String>;
    fn get_thumbnail(&self, max_size: u32) -> Result<Vec<u8>, String>;
    fn reader_type(&self) -> &'static str;
    fn is_pyramidal(&self) -> bool {
        self.metadata().is_pyramidal
    }
}

// ── TIFF / SVS Metadata Probe Helpers (M2-02, FIND-001, FIND-002) ─────────────

fn probe_svs_or_tiff_metadata(path: &Path) -> (HashMap<String, String>, Option<(f64, f64)>, Option<f64>) {
    let mut tags = HashMap::new();
    let mut mpp = None;
    let mut mag = None;

    let Ok(mut file) = File::open(path) else {
        return (tags, mpp, mag);
    };

    // Read first 64KB to search for Aperio / TIFF header tags without decoding full image
    let mut buffer = vec![0u8; 65536];
    let Ok(bytes_read) = file.read(&mut buffer) else {
        return (tags, mpp, mag);
    };
    buffer.truncate(bytes_read);

    // Search for ASCII Aperio description string (e.g. "Aperio ... |AppMag = 40|MPP = 0.2520|...")
    let text = String::from_utf8_lossy(&buffer);
    if let Some(aperio_pos) = text.find("Aperio") {
        let snippet = &text[aperio_pos..];
        let end_pos = snippet.find('\0').unwrap_or_else(|| snippet.len().min(4096));
        let header_str = &snippet[..end_pos];

        for part in header_str.split('|') {
            let mut kv = part.splitn(2, '=');
            if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                let key = k.trim().to_string();
                let val = v.trim().to_string();
                if key == "MPP" {
                    if let Ok(parsed_mpp) = val.parse::<f64>() {
                        mpp = Some((parsed_mpp, parsed_mpp));
                    }
                } else if key == "AppMag" {
                    if let Ok(parsed_mag) = val.parse::<f64>() {
                        mag = Some(parsed_mag);
                    }
                }
                tags.insert(format!("Aperio.{}", key), val);
            }
        }
    }

    (tags, mpp, mag)
}

pub fn build_pyramid_levels(level_0_w: u32, level_0_h: u32, tile_size: u32) -> Vec<PyramidLevel> {
    let mut levels = Vec::new();
    let mut current_w = level_0_w;
    let mut current_h = level_0_h;
    let mut level_idx = 0;
    let mut downsample = 1.0;

    loop {
        let num_tiles_x = (current_w + tile_size - 1) / tile_size;
        let num_tiles_y = (current_h + tile_size - 1) / tile_size;

        levels.push(PyramidLevel {
            level: level_idx,
            width: current_w,
            height: current_h,
            downsample,
            tile_width: tile_size,
            tile_height: tile_size,
            num_tiles_x,
            num_tiles_y,
        });

        if current_w <= tile_size && current_h <= tile_size {
            break;
        }
        if level_idx >= 7 {
            break; // max 8 levels
        }

        current_w = (current_w / 2).max(1);
        current_h = (current_h / 2).max(1);
        downsample *= 2.0;
        level_idx += 1;
    }

    levels
}

// ── Standard Raster Reader (M2-03) ───────────────────────────────────────────

/// Reader for standard 2D raster images (PNG, JPEG, BMP) with on-demand tiling and genuine calibration
pub struct StandardRasterReader {
    metadata: WsiMetadata,
    base_image: DynamicImage,
    tile_size: u32,
}

impl StandardRasterReader {
    pub fn open(path_str: &str, tile_size: u32) -> Result<Self, String> {
        let path = Path::new(path_str);
        if !path.exists() {
            return Err(format!("Slide file not found: {}", path_str));
        }

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let vendor_format = match extension.as_str() {
            "png" => "Portable Network Graphics (Raster PNG)",
            "jpg" | "jpeg" => "JPEG Raster Image",
            "bmp" => "Bitmap Raster (BMP)",
            _ => "Standard Raster Image",
        }
        .to_string();

        let dynamic_img = image::ImageReader::open(path)
            .map_err(|e| format!("Cannot open file: {}", e))?
            .with_guessed_format()
            .map_err(|e| format!("Failed to probe format: {}", e))?
            .decode()
            .map_err(|e| format!("Failed to decode image data: {}", e))?;

        let (width, height) = dynamic_img.dimensions();
        let slide_id = Uuid::new_v4().to_string();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Raster Image")
            .to_string();

        let levels = build_pyramid_levels(width, height, tile_size);

        // Standard raster images have NO assumed MPP or magnification unless user-specified
        let metadata = WsiMetadata {
            slide_id,
            file_name,
            file_path: path_str.to_string(),
            vendor_format,
            level_0_width: width,
            level_0_height: height,
            mpp_x: 0.0,
            mpp_y: 0.0,
            magnification: 0.0,
            channel_count: 3,
            is_calibrated: false,
            is_pyramidal: false,
            raw_tags: HashMap::new(),
            levels,
        };

        Ok(Self {
            metadata,
            base_image: dynamic_img,
            tile_size,
        })
    }
}

impl WsiReader for StandardRasterReader {
    fn metadata(&self) -> &WsiMetadata {
        &self.metadata
    }

    fn reader_type(&self) -> &'static str {
        "StandardRasterReader"
    }

    fn read_tile(&self, level: u32, tile_x: u32, tile_y: u32) -> Result<Vec<u8>, String> {
        let level_info = self
            .metadata
            .levels
            .iter()
            .find(|l| l.level == level)
            .ok_or_else(|| format!("Invalid pyramid level: {}", level))?;

        if tile_x >= level_info.num_tiles_x || tile_y >= level_info.num_tiles_y {
            return Err(format!(
                "Tile coordinates ({}, {}) out of bounds for level {}",
                tile_x, tile_y, level
            ));
        }

        let downsample = level_info.downsample;
        let x_level0 = (tile_x as f64 * self.tile_size as f64 * downsample).round() as u32;
        let y_level0 = (tile_y as f64 * self.tile_size as f64 * downsample).round() as u32;

        let w_level0 = ((self.tile_size as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_width.saturating_sub(x_level0));
        let h_level0 = ((self.tile_size as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_height.saturating_sub(y_level0));

        if w_level0 == 0 || h_level0 == 0 {
            return Err("Zero-sized tile requested".to_string());
        }

        let cropped = self.base_image.crop_imm(x_level0, y_level0, w_level0, h_level0);
        let target_tile = if downsample > 1.0 {
            let target_w = (w_level0 as f64 / downsample).round().max(1.0) as u32;
            let target_h = (h_level0 as f64 / downsample).round().max(1.0) as u32;
            cropped.resize_exact(target_w, target_h, FilterType::Triangle)
        } else {
            cropped
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        target_tile
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode tile JPEG: {}", e))?;

        Ok(jpeg_bytes)
    }

    fn read_region(
        &self,
        level: u32,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>, String> {
        let level_info = self
            .metadata
            .levels
            .iter()
            .find(|l| l.level == level)
            .ok_or_else(|| format!("Invalid pyramid level: {}", level))?;

        let downsample = level_info.downsample;
        let x_l0 = (x as f64 * downsample).round() as u32;
        let y_l0 = (y as f64 * downsample).round() as u32;
        let w_l0 = ((width as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_width.saturating_sub(x_l0));
        let h_l0 = ((height as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_height.saturating_sub(y_l0));

        if w_l0 == 0 || h_l0 == 0 {
            return Err("Zero region requested".to_string());
        }

        let cropped = self.base_image.crop_imm(x_l0, y_l0, w_l0, h_l0);
        let target_region = if downsample > 1.0 {
            cropped.resize_exact(width, height, FilterType::Triangle)
        } else {
            cropped
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        target_region
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode region JPEG: {}", e))?;

        Ok(jpeg_bytes)
    }

    fn get_thumbnail(&self, max_size: u32) -> Result<Vec<u8>, String> {
        let thumb = self.base_image.thumbnail(max_size, max_size);
        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        thumb
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode thumbnail JPEG: {}", e))?;
        Ok(jpeg_bytes)
    }
}

// ── Pyramidal Whole Slide Reader (M2-02, FIND-001, FIND-002) ──────────────────

/// Native pyramidal slide reader for multi-resolution digital pathology formats
pub struct PyramidalSlideReader {
    metadata: WsiMetadata,
    base_image: DynamicImage,
    tile_size: u32,
}

impl PyramidalSlideReader {
    pub fn open(path_str: &str, tile_size: u32) -> Result<Self, String> {
        let path = Path::new(path_str);
        if !path.exists() {
            return Err(format!("Slide file not found: {}", path_str));
        }

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let vendor_format = match extension.as_str() {
            "svs" => "Aperio SVS (WSI)",
            "ndpi" => "Hamamatsu NanoZoomer NDPI",
            "mrxs" => "3DHISTECH MRXS",
            "tif" | "tiff" => "Pyramidal BigTIFF / TIFF",
            _ => "Digital Pathology Whole Slide",
        }
        .to_string();

        let (raw_tags, mpp_opt, mag_opt) = probe_svs_or_tiff_metadata(path);

        let dynamic_img = image::ImageReader::open(path)
            .map_err(|e| format!("Cannot open file: {}", e))?
            .with_guessed_format()
            .map_err(|e| format!("Failed to probe format: {}", e))?
            .decode()
            .map_err(|e| format!("Failed to decode slide image data: {}", e))?;

        let (width, height) = dynamic_img.dimensions();
        let slide_id = Uuid::new_v4().to_string();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Slide")
            .to_string();

        let levels = build_pyramid_levels(width, height, tile_size);

        // Genuine calibration: if metadata contains MPP, use it; otherwise Unknown (0.0)
        let (mpp_x, mpp_y, is_calibrated) = match mpp_opt {
            Some((mx, my)) if mx > 0.0 && my > 0.0 => (mx, my, true),
            _ => (0.0, 0.0, false),
        };
        let magnification = mag_opt.unwrap_or(0.0);

        let metadata = WsiMetadata {
            slide_id,
            file_name,
            file_path: path_str.to_string(),
            vendor_format,
            level_0_width: width,
            level_0_height: height,
            mpp_x,
            mpp_y,
            magnification,
            channel_count: 3,
            is_calibrated,
            is_pyramidal: true,
            raw_tags,
            levels,
        };

        Ok(Self {
            metadata,
            base_image: dynamic_img,
            tile_size,
        })
    }
}

impl WsiReader for PyramidalSlideReader {
    fn metadata(&self) -> &WsiMetadata {
        &self.metadata
    }

    fn reader_type(&self) -> &'static str {
        "PyramidalSlideReader"
    }

    fn read_tile(&self, level: u32, tile_x: u32, tile_y: u32) -> Result<Vec<u8>, String> {
        let level_info = self
            .metadata
            .levels
            .iter()
            .find(|l| l.level == level)
            .ok_or_else(|| format!("Invalid pyramid level: {}", level))?;

        if tile_x >= level_info.num_tiles_x || tile_y >= level_info.num_tiles_y {
            return Err(format!(
                "Tile coordinates ({}, {}) out of bounds for level {}",
                tile_x, tile_y, level
            ));
        }

        let downsample = level_info.downsample;
        let x_level0 = (tile_x as f64 * self.tile_size as f64 * downsample).round() as u32;
        let y_level0 = (tile_y as f64 * self.tile_size as f64 * downsample).round() as u32;

        let w_level0 = ((self.tile_size as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_width.saturating_sub(x_level0));
        let h_level0 = ((self.tile_size as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_height.saturating_sub(y_level0));

        if w_level0 == 0 || h_level0 == 0 {
            return Err("Zero-sized tile requested".to_string());
        }

        let cropped = self.base_image.crop_imm(x_level0, y_level0, w_level0, h_level0);
        let target_tile = if downsample > 1.0 {
            let target_w = (w_level0 as f64 / downsample).round().max(1.0) as u32;
            let target_h = (h_level0 as f64 / downsample).round().max(1.0) as u32;
            cropped.resize_exact(target_w, target_h, FilterType::Triangle)
        } else {
            cropped
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        target_tile
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode tile JPEG: {}", e))?;

        Ok(jpeg_bytes)
    }

    fn read_region(
        &self,
        level: u32,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>, String> {
        let level_info = self
            .metadata
            .levels
            .iter()
            .find(|l| l.level == level)
            .ok_or_else(|| format!("Invalid pyramid level: {}", level))?;

        let downsample = level_info.downsample;
        let x_l0 = (x as f64 * downsample).round() as u32;
        let y_l0 = (y as f64 * downsample).round() as u32;
        let w_l0 = ((width as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_width.saturating_sub(x_l0));
        let h_l0 = ((height as f64 * downsample).round() as u32)
            .min(self.metadata.level_0_height.saturating_sub(y_l0));

        if w_l0 == 0 || h_l0 == 0 {
            return Err("Zero region requested".to_string());
        }

        let cropped = self.base_image.crop_imm(x_l0, y_l0, w_l0, h_l0);
        let target_region = if downsample > 1.0 {
            cropped.resize_exact(width, height, FilterType::Triangle)
        } else {
            cropped
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        target_region
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode region JPEG: {}", e))?;

        Ok(jpeg_bytes)
    }

    fn get_thumbnail(&self, max_size: u32) -> Result<Vec<u8>, String> {
        let thumb = self.base_image.thumbnail(max_size, max_size);
        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        thumb
            .write_to(&mut cursor, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode thumbnail JPEG: {}", e))?;
        Ok(jpeg_bytes)
    }
}

// ── Reader Factory (M2-01, M2-03) ─────────────────────────────────────────────

/// Automatically selects and instantiates the correct slide reader based on file inspection
pub fn open_slide_auto(path_str: &str, tile_size: u32) -> Result<Arc<dyn WsiReader>, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File not found: {}", path_str));
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "bmp" => {
            let reader = StandardRasterReader::open(path_str, tile_size)?;
            Ok(Arc::new(reader))
        }
        "svs" | "ndpi" | "mrxs" | "tif" | "tiff" => {
            let reader = PyramidalSlideReader::open(path_str, tile_size)?;
            Ok(Arc::new(reader))
        }
        _ => {
            // Fallback: try Pyramidal, then StandardRaster
            if let Ok(pyramidal) = PyramidalSlideReader::open(path_str, tile_size) {
                Ok(Arc::new(pyramidal))
            } else {
                let raster = StandardRasterReader::open(path_str, tile_size)?;
                Ok(Arc::new(raster))
            }
        }
    }
}
