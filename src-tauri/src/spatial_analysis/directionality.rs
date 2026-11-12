use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Directionality distribution results for fiber and tissue orientation (options.md DIR-02, DIR-03, DIR-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionalityResult {
    /// Dominant fiber direction in degrees (0.0 to 180.0)
    pub dominant_direction_deg: f64,
    /// Angular dispersion around dominant direction (standard deviation in degrees)
    pub dispersion_deg: f64,
    /// Anisotropy / alignment index (0.0 = completely isotropic/random, 1.0 = perfectly aligned)
    pub anisotropy_index: f64,
    /// Bin centers in degrees
    pub bin_centers: Vec<f64>,
    /// Accumulated gradient magnitude per angular bin
    pub bin_counts: Vec<f64>,
}

pub struct DirectionalityEngine;

impl DirectionalityEngine {
    /// Computes local gradient directionality histogram using 2D Sobel operators
    /// - `num_bins`: Number of angular bins in [0, 180) degrees (typically 36 or 90)
    pub fn analyze(
        image: &[u8],
        width: usize,
        height: usize,
        num_bins: usize,
    ) -> Result<DirectionalityResult, String> {
        if width < 3 || height < 3 || image.len() < width * height {
            return Err("Image dimensions too small for directionality gradient analysis".to_string());
        }
        let bins = num_bins.clamp(12, 180);
        let mut bin_counts = vec![0.0f64; bins];
        let bin_width = 180.0 / (bins as f64);

        let mut total_magnitude = 0.0f64;

        for y in 1..(height - 1) {
            for x in 1..(width - 1) {
                // Sobel 3x3 kernels
                let p00 = image[(y - 1) * width + (x - 1)] as f64;
                let p01 = image[(y - 1) * width + x] as f64;
                let p02 = image[(y - 1) * width + (x + 1)] as f64;

                let p10 = image[y * width + (x - 1)] as f64;
                let p12 = image[y * width + (x + 1)] as f64;

                let p20 = image[(y + 1) * width + (x - 1)] as f64;
                let p21 = image[(y + 1) * width + x] as f64;
                let p22 = image[(y + 1) * width + (x + 1)] as f64;

                let gx = (p02 + 2.0 * p12 + p22) - (p00 + 2.0 * p10 + p20);
                let gy = (p20 + 2.0 * p21 + p22) - (p00 + 2.0 * p01 + p02);

                let mag = (gx * gx + gy * gy).sqrt();
                if mag < 5.0 {
                    // Suppress low-contrast flat regions
                    continue;
                }

                // Fiber direction is perpendicular to gradient direction
                let mut angle_rad = gy.atan2(gx) + PI * 0.5;
                if angle_rad < 0.0 {
                    angle_rad += PI;
                }
                while angle_rad >= PI {
                    angle_rad -= PI;
                }

                let angle_deg = angle_rad * 180.0 / PI;
                let bin_idx = ((angle_deg / bin_width).floor() as usize).min(bins - 1);

                bin_counts[bin_idx] += mag;
                total_magnitude += mag;
            }
        }

        let mut bin_centers = Vec::with_capacity(bins);
        for i in 0..bins {
            bin_centers.push((i as f64 + 0.5) * bin_width);
        }

        // Find dominant bin (peak)
        let mut max_count = 0.0f64;
        let mut min_count = f64::MAX;
        let mut max_idx = 0;

        for (i, &count) in bin_counts.iter().enumerate() {
            if count > max_count {
                max_count = count;
                max_idx = i;
            }
            if count < min_count {
                min_count = count;
            }
        }

        let dominant_direction_deg = bin_centers[max_idx];

        // Anisotropy index: (max - min) / (max + min)
        let anisotropy_index = if (max_count + min_count) > 1e-6 {
            (max_count - min_count) / (max_count + min_count)
        } else {
            0.0
        };

        // Circular dispersion around peak
        let mut dispersion_sum = 0.0f64;
        for i in 0..bins {
            let diff = (bin_centers[i] - dominant_direction_deg).abs();
            let cyclic_diff = diff.min(180.0 - diff);
            dispersion_sum += cyclic_diff * cyclic_diff * bin_counts[i];
        }

        let dispersion_deg = if total_magnitude > 1e-6 {
            (dispersion_sum / total_magnitude).sqrt()
        } else {
            0.0
        };

        Ok(DirectionalityResult {
            dominant_direction_deg,
            dispersion_deg,
            anisotropy_index,
            bin_centers,
            bin_counts,
        })
    }
}

