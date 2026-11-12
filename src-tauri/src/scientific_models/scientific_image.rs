use image::{DynamicImage, GenericImageView};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::SystemTime;

// ── DATA-01: Pixel Types & Stride Alignment ───────────────────────────────────

/// Scientific pixel depth and data format (DATA-01, M1-01)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PixelType {
    U8,
    U16,
    I16,
    U32,
    I32,
    F32,
    F64,
    Rgb24,
    Rgba32,
}

impl PixelType {
    pub fn bytes_per_sample(&self) -> usize {
        match self {
            PixelType::U8 => 1,
            PixelType::U16 | PixelType::I16 => 2,
            PixelType::U32 | PixelType::I32 | PixelType::F32 => 4,
            PixelType::F64 => 8,
            PixelType::Rgb24 => 1,
            PixelType::Rgba32 => 1,
        }
    }

    pub fn bytes_per_pixel(&self) -> usize {
        match self {
            PixelType::U8 => 1,
            PixelType::U16 | PixelType::I16 => 2,
            PixelType::U32 | PixelType::I32 | PixelType::F32 => 4,
            PixelType::F64 => 8,
            PixelType::Rgb24 => 3,
            PixelType::Rgba32 => 4,
        }
    }

    pub fn bits_per_sample(&self) -> usize {
        self.bytes_per_sample() * 8
    }

    pub fn is_floating_point(&self) -> bool {
        matches!(self, PixelType::F32 | PixelType::F64)
    }

    pub fn is_signed(&self) -> bool {
        matches!(self, PixelType::I16 | PixelType::I32 | PixelType::F32 | PixelType::F64)
    }

    pub fn is_integer(&self) -> bool {
        matches!(
            self,
            PixelType::U8
                | PixelType::U16
                | PixelType::I16
                | PixelType::U32
                | PixelType::I32
                | PixelType::Rgb24
                | PixelType::Rgba32
        )
    }

    pub fn default_channel_count(&self) -> u32 {
        match self {
            PixelType::Rgb24 => 3,
            PixelType::Rgba32 => 4,
            _ => 1,
        }
    }
}

// ── DATA-02: Canonical Axis Model & Order Transposition ──────────────────────

/// Discrete dimension axis identifier (M1-02)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Axis {
    X,
    Y,
    Channel,
    Z,
    Time,
}

/// Supported multidimensional canonical coordinate ordering (M1-02)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum AxisOrder {
    #[default]
    XY,
    XYC,
    CXY,
    XYZ,
    XYZC,
    XYCZT,
    XYZCT,
    XYZTC,
}

impl AxisOrder {
    pub fn axes(&self) -> &'static [Axis] {
        match self {
            AxisOrder::XY => &[Axis::X, Axis::Y],
            AxisOrder::XYC => &[Axis::X, Axis::Y, Axis::Channel],
            AxisOrder::CXY => &[Axis::Channel, Axis::X, Axis::Y],
            AxisOrder::XYZ => &[Axis::X, Axis::Y, Axis::Z],
            AxisOrder::XYZC => &[Axis::X, Axis::Y, Axis::Z, Axis::Channel],
            AxisOrder::XYCZT => &[Axis::X, Axis::Y, Axis::Channel, Axis::Z, Axis::Time],
            AxisOrder::XYZCT => &[Axis::X, Axis::Y, Axis::Z, Axis::Channel, Axis::Time],
            AxisOrder::XYZTC => &[Axis::X, Axis::Y, Axis::Z, Axis::Time, Axis::Channel],
        }
    }

    pub fn has_axis(&self, axis: Axis) -> bool {
        self.axes().contains(&axis)
    }
}

/// N-Dimensional spatial and temporal coordinates (DATA-02, M1-02)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub z_slices: u32,
    pub time_points: u32,
    pub axis_order: AxisOrder,
}

impl ImageDimensions {
    pub fn new_2d(width: u32, height: u32, channels: u32) -> Self {
        Self {
            width,
            height,
            channels: channels.max(1),
            z_slices: 1,
            time_points: 1,
            axis_order: if channels > 1 { AxisOrder::XYC } else { AxisOrder::XY },
        }
    }

    pub fn new_5d(
        width: u32,
        height: u32,
        channels: u32,
        z_slices: u32,
        time_points: u32,
        axis_order: AxisOrder,
    ) -> Self {
        Self {
            width: width.max(1),
            height: height.max(1),
            channels: channels.max(1),
            z_slices: z_slices.max(1),
            time_points: time_points.max(1),
            axis_order,
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

    /// Size of an individual axis
    pub fn axis_size(&self, axis: Axis) -> usize {
        match axis {
            Axis::X => self.width as usize,
            Axis::Y => self.height as usize,
            Axis::Channel => self.channels as usize,
            Axis::Z => self.z_slices as usize,
            Axis::Time => self.time_points as usize,
        }
    }

    /// Linear stride for a given axis based on current AxisOrder layout
    pub fn stride_for_axis(&self, target_axis: Axis) -> usize {
        let axes = self.axis_order.axes();
        let mut stride = 1;
        // Axes are arranged from highest to lowest index or fastest to slowest
        // Standard convention: axes[0] is fastest changing (stride 1)
        for &axis in axes.iter() {
            if axis == target_axis {
                return stride;
            }
            stride *= self.axis_size(axis);
        }
        stride
    }

    /// Calculate linear 1D buffer index from 5D coordinates (x, y, c, z, t)
    pub fn linear_index(&self, x: u32, y: u32, c: u32, z: u32, t: u32) -> Result<usize, String> {
        if x >= self.width {
            return Err(format!("X coordinate {} out of range (width {})", x, self.width));
        }
        if y >= self.height {
            return Err(format!("Y coordinate {} out of range (height {})", y, self.height));
        }
        if c >= self.channels {
            return Err(format!("Channel {} out of range (count {})", c, self.channels));
        }
        if z >= self.z_slices {
            return Err(format!("Z slice {} out of range (count {})", z, self.z_slices));
        }
        if t >= self.time_points {
            return Err(format!("Timepoint {} out of range (count {})", t, self.time_points));
        }

        let mut index = 0;
        let mut multiplier = 1;
        for &axis in self.axis_order.axes() {
            let coord = match axis {
                Axis::X => x as usize,
                Axis::Y => y as usize,
                Axis::Channel => c as usize,
                Axis::Z => z as usize,
                Axis::Time => t as usize,
            };
            index += coord * multiplier;
            multiplier *= self.axis_size(axis);
        }

        Ok(index)
    }

    /// Decompose a linear 1D index into (x, y, c, z, t) coordinates
    pub fn coords_from_index(&self, mut index: usize) -> (u32, u32, u32, u32, u32) {
        let mut x = 0;
        let mut y = 0;
        let mut c = 0;
        let mut z = 0;
        let mut t = 0;

        for &axis in self.axis_order.axes() {
            let size = self.axis_size(axis);
            let coord = (index % size) as u32;
            index /= size;

            match axis {
                Axis::X => x = coord,
                Axis::Y => y = coord,
                Axis::Channel => c = coord,
                Axis::Z => z = coord,
                Axis::Time => t = coord,
            }
        }

        (x, y, c, z, t)
    }

    /// Permute source sample buffer from current axis order to canonical XYCZT layout
    pub fn transpose_to_canonical(&self, samples: &[f64]) -> Result<(ImageDimensions, Vec<f64>), String> {
        let total = self.total_samples();
        if samples.len() != total {
            return Err(format!("Sample length mismatch: expected {}, got {}", total, samples.len()));
        }

        if self.axis_order == AxisOrder::XYCZT || (self.z_slices == 1 && self.time_points == 1 && self.axis_order == AxisOrder::XYC) {
            return Ok((self.clone(), samples.to_vec()));
        }

        let canonical_dims = ImageDimensions {
            width: self.width,
            height: self.height,
            channels: self.channels,
            z_slices: self.z_slices,
            time_points: self.time_points,
            axis_order: AxisOrder::XYCZT,
        };

        let mut output = vec![0.0f64; total];
        for (src_idx, &val) in samples.iter().enumerate() {
            let (x, y, c, z, t) = self.coords_from_index(src_idx);
            let dst_idx = canonical_dims.linear_index(x, y, c, z, t)?;
            output[dst_idx] = val;
        }

        Ok((canonical_dims, output))
    }
}

// ── DATA-03: Spatial Calibration & Physical Units ─────────────────────────────

/// Provenance source of spatial calibration information (M1-03)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum CalibrationSource {
    Metadata,
    UserDefined,
    Imported,
    #[default]
    Unknown,
}

/// Physical spatial calibration and measurement scale (DATA-03, M1-03)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpatialCalibration {
    pub pixel_size_x: f64,
    pub pixel_size_y: f64,
    pub pixel_size_z: f64,
    pub time_interval: Option<f64>,
    pub unit_name: String,
    pub source: CalibrationSource,
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
            time_interval: None,
            unit_name: "px".to_string(),
            source: CalibrationSource::Unknown,
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: false,
        }
    }
}

impl SpatialCalibration {
    pub fn uncalibrated() -> Self {
        Self::default()
    }

    pub fn new_microns(pixel_size_xy: f64) -> Self {
        let is_valid = pixel_size_xy > 0.0 && (pixel_size_xy - 1.0).abs() > f64::EPSILON;
        Self {
            pixel_size_x: pixel_size_xy,
            pixel_size_y: pixel_size_xy,
            pixel_size_z: 1.0,
            time_interval: None,
            unit_name: "µm".to_string(),
            source: if is_valid { CalibrationSource::UserDefined } else { CalibrationSource::Unknown },
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: is_valid,
        }
    }

    pub fn from_metadata(pixel_size_x: f64, pixel_size_y: f64, pixel_size_z: Option<f64>, unit: &str) -> Self {
        let is_valid = pixel_size_x > 0.0 && pixel_size_y > 0.0;
        Self {
            pixel_size_x,
            pixel_size_y,
            pixel_size_z: pixel_size_z.unwrap_or(1.0),
            time_interval: None,
            unit_name: unit.to_string(),
            source: if is_valid { CalibrationSource::Metadata } else { CalibrationSource::Unknown },
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: is_valid,
        }
    }

    pub fn new_anisotropic(
        pixel_size_x: f64,
        pixel_size_y: f64,
        pixel_size_z: Option<f64>,
        unit: &str,
        source: CalibrationSource,
    ) -> Self {
        let is_valid = pixel_size_x > 0.0 && pixel_size_y > 0.0;
        Self {
            pixel_size_x,
            pixel_size_y,
            pixel_size_z: pixel_size_z.unwrap_or(1.0),
            time_interval: None,
            unit_name: unit.to_string(),
            source,
            origin_x: 0.0,
            origin_y: 0.0,
            is_calibrated: is_valid,
        }
    }

    pub fn pixel_to_physical(&self, px: f64, py: f64) -> (f64, f64) {
        if !self.is_calibrated {
            return (px, py);
        }
        let x = (px - self.origin_x) * self.pixel_size_x;
        let y = (py - self.origin_y) * self.pixel_size_y;
        (x, y)
    }

    pub fn physical_to_pixel(&self, x: f64, y: f64) -> (f64, f64) {
        if !self.is_calibrated || self.pixel_size_x <= 0.0 || self.pixel_size_y <= 0.0 {
            return (x, y);
        }
        let px = (x / self.pixel_size_x) + self.origin_x;
        let py = (y / self.pixel_size_y) + self.origin_y;
        (px, py)
    }

    pub fn calculate_calibrated_distance(&self, dx_px: f64, dy_px: f64) -> f64 {
        if !self.is_calibrated {
            return (dx_px * dx_px + dy_px * dy_px).sqrt();
        }
        let dx_phys = dx_px * self.pixel_size_x;
        let dy_phys = dy_px * self.pixel_size_y;
        (dx_phys * dx_phys + dy_phys * dy_phys).sqrt()
    }

    pub fn calculate_calibrated_area(&self, pixel_area: f64) -> f64 {
        if !self.is_calibrated {
            return pixel_area;
        }
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

// ── DATA-04: Metadata Normalization & Provenance ──────────────────────────────

/// Raw, unparsed vendor metadata tags (M1-04)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RawMetadata {
    pub vendor_format: Option<String>,
    pub entries: HashMap<String, String>,
    pub raw_json: Option<serde_json::Value>,
}

/// Metadata description of a single fluorescence or optical channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMetadata {
    pub index: u32,
    pub name: String,
    pub color_hex: String,
    pub emission_wavelength_nm: Option<f64>,
}

/// Normalized canonical scientific metadata model (M1-04)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NormalizedMetadata {
    pub acquisition_date: Option<String>,
    pub instrument_make: Option<String>,
    pub instrument_model: Option<String>,
    pub nominal_magnification: Option<f64>,
    pub numerical_aperture: Option<f64>,
    pub exposure_time_ms: Option<f64>,
    pub channels: Vec<ChannelMetadata>,
    pub source_provenance: HashMap<String, String>,
}

/// Complete versioned metadata record holding raw tags and normalized view (M1-04)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetadataRecord {
    pub raw: RawMetadata,
    pub normalized: NormalizedMetadata,
}

// ── Asset & Lineage Models ───────────────────────────────────────────────────

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

// ── DATA-01: Typed Contiguous Pixel Storage ──────────────────────────────────

/// Internal typed contiguous storage for pixel samples across all supported bit depths (M1-01)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TypedPixelBuffer {
    U8(Vec<u8>),
    U16(Vec<u16>),
    I16(Vec<i16>),
    U32(Vec<u32>),
    I32(Vec<i32>),
    F32(Vec<f32>),
    F64(Vec<f64>),
    Rgb24(Vec<u8>),
    Rgba32(Vec<u8>),
}

impl TypedPixelBuffer {
    pub fn len(&self) -> usize {
        match self {
            TypedPixelBuffer::U8(v) => v.len(),
            TypedPixelBuffer::U16(v) => v.len(),
            TypedPixelBuffer::I16(v) => v.len(),
            TypedPixelBuffer::U32(v) => v.len(),
            TypedPixelBuffer::I32(v) => v.len(),
            TypedPixelBuffer::F32(v) => v.len(),
            TypedPixelBuffer::F64(v) => v.len(),
            TypedPixelBuffer::Rgb24(v) => v.len(),
            TypedPixelBuffer::Rgba32(v) => v.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn pixel_type(&self) -> PixelType {
        match self {
            TypedPixelBuffer::U8(_) => PixelType::U8,
            TypedPixelBuffer::U16(_) => PixelType::U16,
            TypedPixelBuffer::I16(_) => PixelType::I16,
            TypedPixelBuffer::U32(_) => PixelType::U32,
            TypedPixelBuffer::I32(_) => PixelType::I32,
            TypedPixelBuffer::F32(_) => PixelType::F32,
            TypedPixelBuffer::F64(_) => PixelType::F64,
            TypedPixelBuffer::Rgb24(_) => PixelType::Rgb24,
            TypedPixelBuffer::Rgba32(_) => PixelType::Rgba32,
        }
    }

    pub fn byte_size(&self) -> usize {
        match self {
            TypedPixelBuffer::U8(v) => v.len(),
            TypedPixelBuffer::U16(v) => v.len() * 2,
            TypedPixelBuffer::I16(v) => v.len() * 2,
            TypedPixelBuffer::U32(v) => v.len() * 4,
            TypedPixelBuffer::I32(v) => v.len() * 4,
            TypedPixelBuffer::F32(v) => v.len() * 4,
            TypedPixelBuffer::F64(v) => v.len() * 8,
            TypedPixelBuffer::Rgb24(v) => v.len(),
            TypedPixelBuffer::Rgba32(v) => v.len(),
        }
    }

    /// Read sample at a linear offset converted to f64
    pub fn get_sample_f64(&self, offset: usize) -> Option<f64> {
        match self {
            TypedPixelBuffer::U8(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::U16(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::I16(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::U32(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::I32(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::F32(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::F64(v) => v.get(offset).map(|&x| x),
            TypedPixelBuffer::Rgb24(v) => v.get(offset).map(|&x| x as f64),
            TypedPixelBuffer::Rgba32(v) => v.get(offset).map(|&x| x as f64),
        }
    }

    /// Set sample value at a linear offset with explicit range clamping
    pub fn set_sample_f64(&mut self, offset: usize, val: f64) -> Result<(), String> {
        if offset >= self.len() {
            return Err(format!("Offset {} out of bounds ({})", offset, self.len()));
        }

        match self {
            TypedPixelBuffer::U8(v) => v[offset] = val.clamp(0.0, 255.0).round() as u8,
            TypedPixelBuffer::U16(v) => v[offset] = val.clamp(0.0, 65535.0).round() as u16,
            TypedPixelBuffer::I16(v) => v[offset] = val.clamp(-32768.0, 32767.0).round() as i16,
            TypedPixelBuffer::U32(v) => v[offset] = val.clamp(0.0, u32::MAX as f64).round() as u32,
            TypedPixelBuffer::I32(v) => v[offset] = val.clamp(i32::MIN as f64, i32::MAX as f64).round() as i32,
            TypedPixelBuffer::F32(v) => v[offset] = val as f32,
            TypedPixelBuffer::F64(v) => v[offset] = val,
            TypedPixelBuffer::Rgb24(v) => v[offset] = val.clamp(0.0, 255.0).round() as u8,
            TypedPixelBuffer::Rgba32(v) => v[offset] = val.clamp(0.0, 255.0).round() as u8,
        }

        Ok(())
    }

    /// Convert samples to raw f32 vector
    pub fn to_f32_samples(&self) -> Vec<f32> {
        let n = self.len();
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            out.push(self.get_sample_f64(i).unwrap_or(0.0) as f32);
        }
        out
    }

    /// Convert samples to normalized 0.0..1.0 range
    pub fn to_f32_normalized(&self) -> Vec<f32> {
        let (min, max, _, _) = self.compute_statistics();
        let range = (max - min).max(f64::EPSILON);
        let n = self.len();
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            let val = self.get_sample_f64(i).unwrap_or(min);
            out.push(((val - min) / range).clamp(0.0, 1.0) as f32);
        }
        out
    }

    /// Convert any pixel type into 8-bit normalized display buffer (0..255)
    pub fn to_u8_normalized(&self) -> Vec<u8> {
        let (min, max, _, _) = self.compute_statistics();
        let range = (max - min).max(f64::EPSILON);
        let n = self.len();
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            let val = self.get_sample_f64(i).unwrap_or(min);
            let normalized = ((val - min) / range * 255.0).clamp(0.0, 255.0).round() as u8;
            out.push(normalized);
        }
        out
    }

    /// Encode buffer samples into Little-Endian byte array
    pub fn to_bytes_le(&self) -> Vec<u8> {
        match self {
            TypedPixelBuffer::U8(v) => v.clone(),
            TypedPixelBuffer::U16(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::I16(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::U32(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::I32(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::F32(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::F64(v) => v.iter().flat_map(|&x| x.to_le_bytes()).collect(),
            TypedPixelBuffer::Rgb24(v) => v.clone(),
            TypedPixelBuffer::Rgba32(v) => v.clone(),
        }
    }

    /// Decode raw Little-Endian byte slice into TypedPixelBuffer (M1-01)
    pub fn from_bytes_le(pixel_type: PixelType, bytes: &[u8]) -> Result<Self, String> {
        match pixel_type {
            PixelType::U8 => Ok(TypedPixelBuffer::U8(bytes.to_vec())),
            PixelType::Rgb24 => Ok(TypedPixelBuffer::Rgb24(bytes.to_vec())),
            PixelType::Rgba32 => Ok(TypedPixelBuffer::Rgba32(bytes.to_vec())),
            PixelType::U16 => {
                if bytes.len() % 2 != 0 {
                    return Err("U16 byte buffer length must be multiple of 2".to_string());
                }
                let vec: Vec<u16> = bytes.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                Ok(TypedPixelBuffer::U16(vec))
            }
            PixelType::I16 => {
                if bytes.len() % 2 != 0 {
                    return Err("I16 byte buffer length must be multiple of 2".to_string());
                }
                let vec: Vec<i16> = bytes.chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]])).collect();
                Ok(TypedPixelBuffer::I16(vec))
            }
            PixelType::U32 => {
                if bytes.len() % 4 != 0 {
                    return Err("U32 byte buffer length must be multiple of 4".to_string());
                }
                let vec: Vec<u32> = bytes
                    .chunks_exact(4)
                    .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect();
                Ok(TypedPixelBuffer::U32(vec))
            }
            PixelType::I32 => {
                if bytes.len() % 4 != 0 {
                    return Err("I32 byte buffer length must be multiple of 4".to_string());
                }
                let vec: Vec<i32> = bytes
                    .chunks_exact(4)
                    .map(|c| i32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect();
                Ok(TypedPixelBuffer::I32(vec))
            }
            PixelType::F32 => {
                if bytes.len() % 4 != 0 {
                    return Err("F32 byte buffer length must be multiple of 4".to_string());
                }
                let vec: Vec<f32> = bytes
                    .chunks_exact(4)
                    .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
                    .collect();
                Ok(TypedPixelBuffer::F32(vec))
            }
            PixelType::F64 => {
                if bytes.len() % 8 != 0 {
                    return Err("F64 byte buffer length must be multiple of 8".to_string());
                }
                let vec: Vec<f64> = bytes
                    .chunks_exact(8)
                    .map(|c| f64::from_le_bytes([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]))
                    .collect();
                Ok(TypedPixelBuffer::F64(vec))
            }
        }
    }

    /// Calculate intensity statistics across all samples (min, max, mean, std_dev)
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

// ── Canonical Scientific Image Asset ──────────────────────────────────────────

/// Canonical Scientific Image Asset (DATA-01, DATA-04, DATA-07)
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
    pub metadata: Option<MetadataRecord>,
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
            PixelType::U8 | PixelType::U16 | PixelType::I16 | PixelType::U32 | PixelType::I32 | PixelType::F32 | PixelType::F64 => 1,
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
            metadata: None,
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
            metadata: self.metadata.clone(),
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
