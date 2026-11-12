use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, Cursor};
use std::path::Path;
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

/// Metadata and spatial calibration of a whole slide image (WSI-01, DATA-03)
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
}

/// Native pyramidal slide reader with on-demand tile generation
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
            "png" => "High-resolution PNG Slide",
            "jpg" | "jpeg" => "JPEG Histology Slide",
            _ => "Generic Digital Pathology Slide",
        }
        .to_string();

        let file = File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
        let mut reader = BufReader::new(file);

        // Probe format
        let format = image::ImageFormat::from_path(path).unwrap_or(ImageFormat::Jpeg);
        let dynamic_img = image::load(&mut reader, format)
            .map_err(|e| format!("Failed to decode image data: {}", e))?;

        let (width, height) = dynamic_img.dimensions();
        let slide_id = Uuid::new_v4().to_string();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Slide")
            .to_string();

        // Standard 40x histology scan default: 0.25 µm/pixel
        let mpp_x = 0.25;
        let mpp_y = 0.25;
        let magnification = 40.0;

        // Build pyramid levels (1x, 2x, 4x, 8x, 16x, 32x) until dimension < tile_size
        let mut levels = Vec::new();
        let mut current_w = width;
        let mut current_h = height;
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

        // Map tile bounds into level-0 coordinates
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

        // Crop region from base image
        let cropped = self.base_image.crop_imm(x_level0, y_level0, w_level0, h_level0);

        // Resize to tile size if needed
        let target_tile = if downsample > 1.0 {
            let target_w = (w_level0 as f64 / downsample).round().max(1.0) as u32;
            let target_h = (h_level0 as f64 / downsample).round().max(1.0) as u32;
            cropped.resize_exact(target_w, target_h, FilterType::Triangle)
        } else {
            cropped
        };

        // Encode as JPEG byte buffer (quality 85 for speed and low bandwidth)
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

        let cropped = self.base_image.crop_imm(x_l0, y_l0, w_l0, h_l0);
        let resized = if downsample > 1.0 {
            cropped.resize_exact(width, height, FilterType::Triangle)
        } else {
            cropped
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        resized
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
            .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;
        Ok(jpeg_bytes)
    }
}
