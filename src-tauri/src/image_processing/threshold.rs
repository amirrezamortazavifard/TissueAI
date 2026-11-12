use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ThresholdMethod {
    Otsu,
    Triangle,
    Mean,
    Fixed(f64),
}

pub struct Thresholding;

impl Thresholding {
    /// Compute optimal threshold using Otsu's method on an 8-bit histogram
    pub fn otsu_u8(data: &[u8]) -> u8 {
        if data.is_empty() {
            return 128;
        }

        let mut hist = [0u32; 256];
        for &val in data {
            hist[val as usize] += 1;
        }

        let total = data.len() as f64;
        let mut sum = 0.0;
        for (i, &count) in hist.iter().enumerate() {
            sum += i as f64 * count as f64;
        }

        let mut sum_b = 0.0;
        let mut w_b = 0.0;
        let mut max_variance = 0.0;
        let mut best_threshold = 0u8;

        for (t, &count) in hist.iter().enumerate() {
            w_b += count as f64;
            if w_b == 0.0 {
                continue;
            }
            let w_f = total - w_b;
            if w_f == 0.0 {
                break;
            }

            sum_b += t as f64 * count as f64;
            let m_b = sum_b / w_b;
            let m_f = (sum - sum_b) / w_f;

            let variance = w_b * w_f * (m_b - m_f) * (m_b - m_f);
            if variance > max_variance {
                max_variance = variance;
                best_threshold = t as u8;
            }
        }

        best_threshold
    }

    /// Compute optimal threshold using Zack's Triangle method (effective for unimodal distributions with a tail)
    pub fn triangle_u8(data: &[u8]) -> u8 {
        if data.is_empty() {
            return 128;
        }

        let mut hist = [0u32; 256];
        for &val in data {
            hist[val as usize] += 1;
        }

        // Find peak and endpoints
        let mut max_bin = 0;
        let mut max_val = 0;
        let mut min_bin = 255;
        let mut end_bin = 0;

        for (i, &count) in hist.iter().enumerate() {
            if count > 0 {
                min_bin = min_bin.min(i);
                end_bin = end_bin.max(i);
            }
            if count > max_val {
                max_val = count;
                max_bin = i;
            }
        }

        if min_bin == end_bin || max_val == 0 {
            return max_bin as u8;
        }

        // Line between peak and farthest end
        let target_end = if (max_bin - min_bin) > (end_bin - max_bin) {
            min_bin
        } else {
            end_bin
        };

        let mut best_threshold = max_bin;
        let mut max_dist = -1.0;

        let a = (hist[target_end] as f64) - (max_val as f64);
        let b = (max_bin as f64) - (target_end as f64);
        let c = -(a * max_bin as f64 + b * max_val as f64);
        let norm = (a * a + b * b).sqrt();

        if norm == 0.0 {
            return max_bin as u8;
        }

        let range = if target_end > max_bin {
            max_bin..=target_end
        } else {
            target_end..=max_bin
        };

        for x in range {
            let y = hist[x] as f64;
            let dist = (a * x as f64 + b * y + c).abs() / norm;
            if dist > max_dist {
                max_dist = dist;
                best_threshold = x;
            }
        }

        best_threshold as u8
    }

    /// Apply threshold method to produce a binary mask (true = foreground)
    pub fn apply(data: &[u8], method: ThresholdMethod) -> (Vec<bool>, u8) {
        let thresh_val = match method {
            ThresholdMethod::Otsu => Self::otsu_u8(data),
            ThresholdMethod::Triangle => Self::triangle_u8(data),
            ThresholdMethod::Mean => {
                if data.is_empty() {
                    128
                } else {
                    let sum: u64 = data.iter().map(|&x| x as u64).sum();
                    (sum / data.len() as u64) as u8
                }
            }
            ThresholdMethod::Fixed(v) => v.round().clamp(0.0, 255.0) as u8,
        };

        let mask = data.iter().map(|&b| b > thresh_val).collect();
        (mask, thresh_val)
    }
}

