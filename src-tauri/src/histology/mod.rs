use serde::{Deserialize, Serialize};
use crate::scientific_models::SpatialCalibration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StainVector {
    pub name: String,
    pub r: f64,
    pub g: f64,
    pub b: f64,
}

impl StainVector {
    pub fn normalized(&self) -> Self {
        let norm = (self.r * self.r + self.g * self.g + self.b * self.b).sqrt();
        if norm > 0.0 {
            Self {
                name: self.name.clone(),
                r: self.r / norm,
                g: self.g / norm,
                b: self.b / norm,
            }
        } else {
            self.clone()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistologyDeconvolutionResult {
    pub stain_name: String,
    pub optical_density: Vec<f32>,
    pub width: usize,
    pub height: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorphometryFeature {
    pub cell_id: u32,
    pub area_px: f64,
    pub area_microns: Option<f64>,
    pub perimeter_px: f64,
    pub perimeter_microns: Option<f64>,
    pub circularity: f64,
    pub mean_intensity: f64,
}

pub struct HistologyAnalysis;

impl HistologyAnalysis {
    /// Detect tissue area vs brightfield glass background
    /// Glass typically has high luminosity and very low saturation in RGB space
    pub fn detect_tissue_mask(rgb: &[u8], width: usize, height: usize, threshold: u8) -> Vec<bool> {
        let mut mask = vec![false; width * height];
        for i in 0..(width * height) {
            let r = rgb[i * 3] as u32;
            let g = rgb[i * 3 + 1] as u32;
            let b = rgb[i * 3 + 2] as u32;
            // Inverted luminosity: glass background ~ 255 -> 0; tissue -> higher value
            let lum = (299 * r + 587 * g + 114 * b) / 1000;
            if lum < threshold as u32 {
                mask[i] = true;
            }
        }
        mask
    }

    /// Color Deconvolution using Beer-Lambert optical density law
    /// Computes accurate OD matrix inversion for stain unmixing (e.g. H&E, H-DAB)
    pub fn deconvolve(
        rgb: &[u8],
        width: usize,
        height: usize,
        stains: &[StainVector],
    ) -> Result<Vec<HistologyDeconvolutionResult>, String> {
        if stains.len() < 2 {
            return Err("At least 2 stain vectors required".to_string());
        }

        // Standardize 3x3 stain matrix (pad third vector as orthogonal background if 2 stains provided)
        let s0 = stains[0].normalized();
        let s1 = stains[1].normalized();
        let s2 = if stains.len() >= 3 {
            stains[2].normalized()
        } else {
            // Cross product of s0 and s1 for optical density completeness
            let cx = s0.g * s1.b - s0.b * s1.g;
            let cy = s0.b * s1.r - s0.r * s1.b;
            let cz = s0.r * s1.g - s0.g * s1.r;
            StainVector {
                name: "Residual".to_string(),
                r: cx,
                g: cy,
                b: cz,
            }.normalized()
        };

        // Determinant of 3x3 matrix
        let det = s0.r * (s1.g * s2.b - s1.b * s2.g)
            - s0.g * (s1.r * s2.b - s1.b * s2.r)
            + s0.b * (s1.r * s2.g - s1.g * s2.r);

        if det.abs() < 1e-6 {
            return Err("Stain vectors are linearly dependent".to_string());
        }

        // Inverse matrix coefficients
        let inv = [
            (s1.g * s2.b - s1.b * s2.g) / det,
            (s0.b * s2.g - s0.g * s2.b) / det,
            (s0.g * s1.b - s0.b * s1.g) / det,
            (s1.b * s2.r - s1.r * s2.b) / det,
            (s0.r * s2.b - s0.b * s2.r) / det,
            (s0.b * s1.r - s0.r * s1.b) / det,
            (s1.r * s2.g - s1.g * s2.r) / det,
            (s0.g * s2.r - s0.r * s2.g) / det,
            (s0.r * s1.g - s0.g * s1.r) / det,
        ];

        let num_pixels = width * height;
        let mut ch0 = vec![0.0f32; num_pixels];
        let mut ch1 = vec![0.0f32; num_pixels];
        let mut ch2 = vec![0.0f32; num_pixels];

        for i in 0..num_pixels {
            let r = rgb[i * 3].max(1) as f64;
            let g = rgb[i * 3 + 1].max(1) as f64;
            let b = rgb[i * 3 + 2].max(1) as f64;

            // Optical density: OD = -log10(I / 255.0)
            let od_r = -(r / 255.0).log10();
            let od_g = -(g / 255.0).log10();
            let od_b = -(b / 255.0).log10();

            ch0[i] = (inv[0] * od_r + inv[1] * od_g + inv[2] * od_b).max(0.0) as f32;
            ch1[i] = (inv[3] * od_r + inv[4] * od_g + inv[5] * od_b).max(0.0) as f32;
            ch2[i] = (inv[6] * od_r + inv[7] * od_g + inv[8] * od_b).max(0.0) as f32;
        }

        let mut results = vec![
            HistologyDeconvolutionResult {
                stain_name: s0.name,
                optical_density: ch0,
                width,
                height,
            },
            HistologyDeconvolutionResult {
                stain_name: s1.name,
                optical_density: ch1,
                width,
                height,
            },
        ];

        if stains.len() >= 3 {
            results.push(HistologyDeconvolutionResult {
                stain_name: s2.name,
                optical_density: ch2,
                width,
                height,
            });
        }

        Ok(results)
    }

    /// Extract morphometry measurements for segmented cell labels
    pub fn extract_morphometry(
        labels: &[u32],
        intensity: &[u8],
        width: usize,
        height: usize,
        calibration: Option<&SpatialCalibration>,
    ) -> Vec<MorphometryFeature> {
        use std::collections::HashMap;

        #[derive(Default)]
        struct CellAcc {
            pixel_count: u32,
            sum_intensity: f64,
            perimeter_count: u32,
        }

        let mut map: HashMap<u32, CellAcc> = HashMap::new();

        for y in 0..height {
            for x in 0..width {
                let idx = y * width + x;
                let lbl = labels[idx];
                if lbl == 0 {
                    continue;
                }

                let entry = map.entry(lbl).or_default();
                entry.pixel_count += 1;
                entry.sum_intensity += intensity[idx] as f64;

                // Check 4-connected boundary
                let mut is_edge = false;
                if x == 0 || labels[idx - 1] != lbl { is_edge = true; }
                if x == width - 1 || labels[idx + 1] != lbl { is_edge = true; }
                if y == 0 || labels[idx - width] != lbl { is_edge = true; }
                if y == height - 1 || labels[idx + width] != lbl { is_edge = true; }

                if is_edge {
                    entry.perimeter_count += 1;
                }
            }
        }

        let mut features = Vec::new();
        let (px_area_scale, px_linear_scale) = if let Some(calib) = calibration {
            if calib.is_calibrated {
                (Some(calib.pixel_size_x * calib.pixel_size_y), Some((calib.pixel_size_x + calib.pixel_size_y) / 2.0))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        for (lbl, acc) in map {
            if acc.pixel_count == 0 {
                continue;
            }
            let area_px = acc.pixel_count as f64;
            let perim_px = acc.perimeter_count as f64;
            let circularity = if perim_px > 0.0 {
                (4.0 * std::f64::consts::PI * area_px) / (perim_px * perim_px)
            } else {
                0.0
            };

            let area_microns = px_area_scale.map(|s| area_px * s);
            let perimeter_microns = px_linear_scale.map(|s| perim_px * s);
            let mean_intensity = acc.sum_intensity / area_px;

            features.push(MorphometryFeature {
                cell_id: lbl,
                area_px,
                area_microns,
                perimeter_px: perim_px,
                perimeter_microns,
                circularity,
                mean_intensity,
            });
        }

        features.sort_by_key(|f| f.cell_id);
        features
    }
}
