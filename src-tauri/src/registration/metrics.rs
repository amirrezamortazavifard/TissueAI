use serde::{Deserialize, Serialize};

/// Registration alignment quality assessment metrics (options.md REG-06)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationMetrics {
    pub mse: f64,
    pub ncc: f64,
    pub mutual_samples: usize,
}

pub struct RegistrationEvaluator;

impl RegistrationEvaluator {
    /// Computes MSE (Mean Squared Error) and NCC (Normalized Cross-Correlation)
    pub fn evaluate(img_a: &[u8], img_b: &[u8]) -> RegistrationMetrics {
        let n = img_a.len().min(img_b.len());
        if n == 0 {
            return RegistrationMetrics {
                mse: 0.0,
                ncc: 0.0,
                mutual_samples: 0,
            };
        }

        let mut sum_a = 0.0f64;
        let mut sum_b = 0.0f64;
        let mut sum_sq_diff = 0.0f64;

        for i in 0..n {
            let a = img_a[i] as f64;
            let b = img_b[i] as f64;
            sum_a += a;
            sum_b += b;
            let diff = a - b;
            sum_sq_diff += diff * diff;
        }

        let mse = sum_sq_diff / (n as f64);
        let mean_a = sum_a / (n as f64);
        let mean_b = sum_b / (n as f64);

        let mut numer = 0.0f64;
        let mut den_a = 0.0f64;
        let mut den_b = 0.0f64;

        for i in 0..n {
            let da = img_a[i] as f64 - mean_a;
            let db = img_b[i] as f64 - mean_b;
            numer += da * db;
            den_a += da * da;
            den_b += db * db;
        }

        let denom = (den_a * den_b).sqrt();
        let ncc = if denom > 1e-10 { numer / denom } else { 0.0 };

        RegistrationMetrics {
            mse,
            ncc,
            mutual_samples: n,
        }
    }

    /// Computes absolute difference image for visual overlay / flicker check (options.md REG-08)
    pub fn difference_image(img_a: &[u8], img_b: &[u8]) -> Vec<u8> {
        let n = img_a.len().min(img_b.len());
        let mut diff = vec![0u8; n];
        for i in 0..n {
            let d = (img_a[i] as i16 - img_b[i] as i16).abs();
            diff[i] = d.min(255) as u8;
        }
        diff
    }
}

