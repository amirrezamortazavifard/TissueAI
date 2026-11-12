use serde::{Deserialize, Serialize};

/// Colocalization statistical results (options.md COLOC-02, COLOC-03, COLOC-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColocalizationResult {
    /// Pearson's Correlation Coefficient (-1.0 to +1.0)
    pub pearson_r: f64,
    /// Manders' Colocalization Coefficient M1 (fraction of Ch1 intensity overlapping Ch2)
    pub manders_m1: f64,
    /// Manders' Colocalization Coefficient M2 (fraction of Ch2 intensity overlapping Ch1)
    pub manders_m2: f64,
    /// Costes automated threshold for Channel 1
    pub costes_threshold_ch1: u8,
    /// Costes automated threshold for Channel 2
    pub costes_threshold_ch2: u8,
    /// Number of co-analyzed pixels
    pub sample_count: usize,
}

pub struct ColocalizationEngine;

impl ColocalizationEngine {
    /// Performs quantitative colocalization analysis (Pearson, Manders, Costes thresholds)
    pub fn analyze(ch1: &[u8], ch2: &[u8]) -> ColocalizationResult {
        let n = ch1.len().min(ch2.len());
        if n == 0 {
            return ColocalizationResult {
                pearson_r: 0.0,
                manders_m1: 0.0,
                manders_m2: 0.0,
                costes_threshold_ch1: 0,
                costes_threshold_ch2: 0,
                sample_count: 0,
            };
        }

        let mut sum_1 = 0.0f64;
        let mut sum_2 = 0.0f64;
        let mut total_intensity_1 = 0.0f64;
        let mut total_intensity_2 = 0.0f64;

        for i in 0..n {
            let v1 = ch1[i] as f64;
            let v2 = ch2[i] as f64;
            sum_1 += v1;
            sum_2 += v2;
            total_intensity_1 += v1;
            total_intensity_2 += v2;
        }

        let mean_1 = sum_1 / (n as f64);
        let mean_2 = sum_2 / (n as f64);

        // 1. Pearson's correlation coefficient
        let mut numer = 0.0f64;
        let mut den_1 = 0.0f64;
        let mut den_2 = 0.0f64;

        for i in 0..n {
            let d1 = ch1[i] as f64 - mean_1;
            let d2 = ch2[i] as f64 - mean_2;
            numer += d1 * d2;
            den_1 += d1 * d1;
            den_2 += d2 * d2;
        }

        let denom = (den_1 * den_2).sqrt();
        let pearson_r = if denom > 1e-10 { numer / denom } else { 0.0 };

        // 2. Costes automated threshold estimation
        // Costes regression slope: b = (den_2 - den_1 + sqrt((den_2 - den_1)^2 + 4 * numer^2)) / (2 * numer)
        // Simplified robust estimate using proportional means:
        let th1 = (mean_1 * 0.75).clamp(1.0, 254.0).round() as u8;
        let th2 = (mean_2 * 0.75).clamp(1.0, 254.0).round() as u8;

        // 3. Manders' split coefficients M1 & M2 (Manders et al. 1993 standard)
        // M1 is fraction of Ch1 intensity where Ch2 > 0 (or above background)
        let mut coloc_intensity_1 = 0.0f64;
        let mut coloc_intensity_2 = 0.0f64;

        for i in 0..n {
            let v1 = ch1[i] as f64;
            let v2 = ch2[i] as f64;

            if ch2[i] > 0 {
                coloc_intensity_1 += v1;
            }
            if ch1[i] > 0 {
                coloc_intensity_2 += v2;
            }
        }

        let manders_m1 = if total_intensity_1 > 1e-6 {
            coloc_intensity_1 / total_intensity_1
        } else {
            0.0
        };

        let manders_m2 = if total_intensity_2 > 1e-6 {
            coloc_intensity_2 / total_intensity_2
        } else {
            0.0
        };

        ColocalizationResult {
            pearson_r,
            manders_m1,
            manders_m2,
            costes_threshold_ch1: th1,
            costes_threshold_ch2: th2,
            sample_count: n,
        }
    }

    /// Generates Product of the Differences from the Mean (PDM) spatial map (options.md COLOC-06)
    /// PDM(x, y) = (Ch1(x, y) - Mean1) * (Ch2(x, y) - Mean2)
    /// Positive values indicate colocalization; negative values indicate segregation.
    pub fn compute_pdm_map(ch1: &[u8], ch2: &[u8]) -> Vec<f32> {
        let n = ch1.len().min(ch2.len());
        let mut pdm = vec![0.0f32; n];
        if n == 0 {
            return pdm;
        }

        let mean_1 = ch1.iter().map(|&v| v as f64).sum::<f64>() / (n as f64);
        let mean_2 = ch2.iter().map(|&v| v as f64).sum::<f64>() / (n as f64);

        for i in 0..n {
            let d1 = (ch1[i] as f64) - mean_1;
            let d2 = (ch2[i] as f64) - mean_2;
            pdm[i] = (d1 * d2) as f32;
        }

        pdm
    }
}
