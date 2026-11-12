use image::{DynamicImage, GenericImageView};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

/// Scientific pixel depth and data format (DATA-01)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PixelType {
    U8,
    U16,
    I16,
    F32,
    Rgb24,
    Rgba32,
}

impl PixelType {
    pub fn bytes_per_pixel(&self) -> usize {
        match self {
            PixelType::U8 => 1,
            PixelType::U16 | PixelType::I16 => 2,
            PixelType::F32 => 4,
            PixelType::Rgb24 => 3,
            PixelType::Rgba32 => 4,
        }
    }
}

/// N-Dimensional spatial and temporal coordinates (DATA-02)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub z_slices: u32,
    pub time_points: u32,
}

impl ImageDimensions {
    pub fn new_2d(width: u32, height: u32, channels: u32) -> Self {
        Self {
            width,
            height,
            channels,
            z_slices: 1,
            time_points: 1,
        }
    }

    pub fn total_pixels_per_plane(&self) -> usize {
        (self.width as usize) * (self.height as usize)
    }

    pub fn total_samples(&self) -> usize {
        (self.width as usize)
            * (self.height as usize)
            * (self.channels as usize)
            * (self.z_slices as usize)
            * (self.time_points as usize)
    }
}

/// Physical spatial calibration and measurement scale (DATA-03)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpatialCalibration {
    pub pixel_size_x: f64,
    pub pixel_size_y: f64,
    pub pixel_size_z: f64,
    pub unit_name: String,
    pub origin_x: f64,
    pub origin_y: f64,
    pub is_calibrated: bool,
}

impl Default for SpatialCalibration {
    fn default() -> Self {
        Self {
            pixel_size_x: 1.0,
            pixel_size_y: 1.0,
            pixel_size_z: 1.0,
            unit_name: "px".to_string(),
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: false,
        }
    }
}

impl SpatialCalibration {
    pub fn new_microns(pixel_size_xy: f64) -> Self {
        Self {
            pixel_size_x: pixel_size_xy,
            pixel_size_y: pixel_size_xy,
            pixel_size_z: 1.0,
            unit_name: "µm".to_string(),
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: pixel_size_xy > 0.0 && (pixel_size_xy - 1.0).abs() > f64::EPSILON,
        }
    }

    pub fn pixel_to_physical(&self, px: f64, py: f64) -> (f64, f64) {
        let x = (px - self.origin_x) * self.pixel_size_x;
        let y = (py - self.origin_y) * self.pixel_size_y;
        (x, y)
    }

    pub fn physical_to_pixel(&self, x: f64, y: f64) -> (f64, f64) {
        let px = (x / self.pixel_size_x) + self.origin_x;
        let py = (y / self.pixel_size_y) + self.origin_y;
        (px, py)
    }

    pub fn calculate_calibrated_distance(&self, dx_px: f64, dy_px: f64) -> f64 {
        let dx_phys = dx_px * self.pixel_size_x;
        let dy_phys = dy_px * self.pixel_size_y;
        (dx_phys * dx_phys + dy_phys * dy_phys).sqrt()
    }

    pub fn calculate_calibrated_area(&self, pixel_area: f64) -> f64 {
        pixel_area * (self.pixel_size_x * self.pixel_size_y)
    }

    pub fn format_distance(&self, distance_px: f64) -> String {
        if self.is_calibrated {
            let dist_phys = distance_px * self.pixel_size_x;
            format!("{:.2} {}", dist_phys, self.unit_name)
        } else {
            format!("{:.1} px", distance_px)
        }
    }

    pub fn format_area(&self, pixel_area: f64) -> String {
        if self.is_calibrated {
            let area_phys = self.calculate_calibrated_area(pixel_area);
            format!("{:.2} {}²", area_phys, self.unit_name)
        } else {
            format!("{:.1} px²", pixel_area)
        }
    }
}

/// High-level kind of scientific image resource
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AssetKind {
    SourceRaster,
    MicroscopyStack,
    WholeSlideImage,
    DerivedImage,
    LabelMask,
    ProbabilityMap,
}

/// Color space representation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ColorModel {
    Grayscale,
    Rgb,
    Multichannel,
    StainSeparated,
    Indexed,
}

/// Processing history and non-destructive lineage (DATA-05, Section 31)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub parent_asset_id: Option<String>,
    pub operation_id: String,
    pub parameters: serde_json::Value,
    pub timestamp_utc: String,
}

/// Internal typed contiguous storage for pixel samples
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TypedPixelBuffer {
    U8(Vec<u8>),
    U16(Vec<u16>),
    F32(Vec<f32>),
    Rgb24(Vec<u8>),
    Rgba32(Vec<u8>),
}

impl TypedPixelBuffer {
    pub fn len(&self) -> usize {
        match self {
            TypedPixelBuffer::U8(v) => v.len(),
            TypedPixelBuffer::U16(v) => v.len(),
            TypedPixelBuffer::F32(v) => v.len(),
            TypedPixelBuffer::Rgb24(v) => v.len(),
            TypedPixelBuffer::Rgba32(v) => v.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Read sample at a linear offset converted to f64
    pub fn get_sample_f64(&self, offset: usize) -> Option<f64> {
        match self {
            TypedPixelBuffer::U8(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::U16(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::F32(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::Rgb24(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::Rgba32(v) => v.get(offset).map(|&x| x as f64),
        }
    }

    /// Calculate intensity statistics across all samples
    pub fn compute_statistics(&self) -> (f64, f64, f64, f64) {
        let n = self.len();
        if n == 0 {
            return (0.0, 0.0, 0.0, 0.0);
        }

        let mut min = f64::MAX;
        let mut max = f64::MIN;
        let mut sum = 0.0;

        for i in 0..n {
            if let Some(val) = self.get_sample_f64(i) {
                if val < min {
                    min = val;
                }
                if val > max {
                    max = val;
                }
                sum += val;
            }
        }

        let mean = sum / (n as f64);
        let mut var_sum = 0.0;
        for i in 0..n {
            if let Some(val) = self.get_sample_f64(i) {
                let diff = val - mean;
                var_sum += diff * diff;
            }
        }
        let std_dev = (var_sum / (n as f64)).sqrt();

        (min, max, mean, std_dev)
    }

    /// Compute histogram with specified number of bins
    pub fn compute_histogram(&self, bin_count: usize) -> (Vec<u32>, f64, f64) {
        if bin_count == 0 || self.is_empty() {
            return (Vec::new(), 0.0, 0.0);
        }

        let (min, max, _, _) = self.compute_statistics();
        let mut bins = vec![0u32; bin_count];

        if (max - min).abs() < f64::EPSILON {
            bins[0] = self.len() as u32;
            return (bins, min, max);
        }

        let bin_width = (max - min) / (bin_count as f64);
        for i in 0..self.len() {
            if let Some(val) = self.get_sample_f64(i) {
                let idx = ((val - min) / bin_width).floor() as usize;
                let clamped_idx = idx.min(bin_count - 1);
                bins[clamped_idx] += 1;
            }
        }

        (bins, min, max)
    }
}

/// Canonical Scientific Image Asset (DATA-01, DATA-04, DATA-07, Section 26.1)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAsset {
    pub asset_id: String,
    pub asset_name: String,
    pub asset_kind: AssetKind,
    pub source_uri: Option<String>,
    pub dimensions: ImageDimensions,
    pub pixel_type: PixelType,
    pub calibration: SpatialCalibration,
    pub color_model: ColorModel,
    pub provenance: Option<Provenance>,
    #[serde(skip_serializing)]
    pub buffer: Option<TypedPixelBuffer>,
}

impl ImageAsset {
    /// Create ImageAsset from loaded DynamicImage
    pub fn from_dynamic_image(
        asset_id: String,
        asset_name: String,
        img: &DynamicImage,
        calibration: SpatialCalibration,
        source_uri: Option<String>,
    ) -> Self {
        let (width, height) = img.dimensions();
        let (pixel_type, color_model, buffer) = match img {
            DynamicImage::ImageLuma8(luma) => (
                PixelType::U8,
                ColorModel::Grayscale,
                TypedPixelBuffer::U8(luma.as_raw().clone()),
            ),
            DynamicImage::ImageLuma16(luma16) => (
                PixelType::U16,
                ColorModel::Grayscale,
                TypedPixelBuffer::U16(luma16.as_raw().clone()),
            ),
            DynamicImage::ImageRgb8(rgb) => (
                PixelType::Rgb24,
                ColorModel::Rgb,
                TypedPixelBuffer::Rgb24(rgb.as_raw().clone()),
            ),
            DynamicImage::ImageRgba8(rgba) => (
                PixelType::Rgba32,
                ColorModel::Rgb,
                TypedPixelBuffer::Rgba32(rgba.as_raw().clone()),
            ),
            _ => {
                let rgb = img.to_rgb8();
                (
                    PixelType::Rgb24,
                    ColorModel::Rgb,
                    TypedPixelBuffer::Rgb24(rgb.into_raw()),
                )
            }
        };

        let channels = match pixel_type {
            PixelType::U8 | PixelType::U16 | PixelType::I16 | PixelType::F32 => 1,
            PixelType::Rgb24 => 3,
            PixelType::Rgba32 => 4,
        };

        Self {
            asset_id,
            asset_name,
            asset_kind: AssetKind::SourceRaster,
            source_uri,
            dimensions: ImageDimensions::new_2d(width, height, channels),
            pixel_type,
            calibration,
            color_model,
            provenance: None,
            buffer: Some(buffer),
        }
    }

    /// Derive new asset from processing step (preserving parent lineage)
    pub fn create_derived(
        &self,
        new_id: String,
        new_name: String,
        new_buffer: TypedPixelBuffer,
        new_pixel_type: PixelType,
        new_color_model: ColorModel,
        operation_id: &str,
        parameters: serde_json::Value,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|_| "0".to_string());

        Self {
            asset_id: new_id,
            asset_name: new_name,
            asset_kind: AssetKind::DerivedImage,
            source_uri: self.source_uri.clone(),
            dimensions: self.dimensions.clone(),
            pixel_type: new_pixel_type,
            calibration: self.calibration.clone(),
            color_model: new_color_model,
            provenance: Some(Provenance {
                parent_asset_id: Some(self.asset_id.clone()),
                operation_id: operation_id.to_string(),
                parameters,
                timestamp_utc: timestamp,
            }),
            buffer: Some(new_buffer),
        }
    }

    /// Query pixel samples at (x, y) coordinates for all channels (DATA-12)
    pub fn get_pixel_values(&self, x: u32, y: u32) -> Result<Vec<f64>, String> {
        if x >= self.dimensions.width || y >= self.dimensions.height {
            return Err(format!(
                "Coordinates ({}, {}) out of bounds for image ({}x{})",
                x, y, self.dimensions.width, self.dimensions.height
            ));
        }

        let buffer = self
            .buffer
            .as_ref()
            .ok_or_else(|| "Pixel buffer not loaded in memory".to_string())?;

        let channels = self.dimensions.channels as usize;
        let base_idx = ((y as usize) * (self.dimensions.width as usize) + (x as usize)) * channels;

        let mut values = Vec::with_capacity(channels);
        for c in 0..channels {
            if let Some(val) = buffer.get_sample_f64(base_idx + c) {
                values.push(val);
            }
        }

        Ok(values)
    }
}

