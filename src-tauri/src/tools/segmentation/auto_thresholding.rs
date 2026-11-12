/// Otsu's method for automatic threshold selection.
/// Calculates between-class variance for each threshold (0-255)
/// and returns the threshold that maximizes it.
pub fn get_otsu_threshold(histogram: &[u32; 256]) -> u8 {
    let total: u64 = histogram.iter().map(|&x| x as u64).sum();
    if total == 0 {
        return 128;
    }

    let mut sum_total: f64 = 0.0;
    for (i, &count) in histogram.iter().enumerate() {
        sum_total += i as f64 * count as f64;
    }

    let mut sum_bg: f64 = 0.0;
    let mut weight_bg: u64 = 0;
    let mut max_variance: f64 = 0.0;
    let mut best_threshold: u8 = 0;

    for t in 0..256usize {
        weight_bg += histogram[t] as u64;
        if weight_bg == 0 {
            continue;
        }

        let weight_fg = total - weight_bg;
        if weight_fg == 0 {
            break;
        }

        sum_bg += t as f64 * histogram[t] as f64;

        let mean_bg = sum_bg / weight_bg as f64;
        let mean_fg = (sum_total - sum_bg) / weight_fg as f64;

        let diff = mean_bg - mean_fg;
        let variance = weight_bg as f64 * weight_fg as f64 * diff * diff;

        if variance > max_variance {
            max_variance = variance;
            best_threshold = t as u8;
        }
    }

    best_threshold
}

/// Weighted mean of the histogram as threshold.
pub fn get_mean_threshold(histogram: &[u32; 256]) -> u8 {
    let mut sum: f64 = 0.0;
    let mut count: f64 = 0.0;

    for (i, &val) in histogram.iter().enumerate() {
        sum += i as f64 * val as f64;
        count += val as f64;
    }

    if count == 0.0 {
        return 128;
    }

    (sum / count).round().min(255.0) as u8
}

/// Li's Minimum Cross Entropy method.
/// Iteratively refines threshold starting from the mean.
pub fn get_li_threshold(histogram: &[u32; 256]) -> u8 {
    let total: f64 = histogram.iter().map(|&x| x as f64).sum();
    if total == 0.0 {
        return 128;
    }

    let mut threshold = get_mean_threshold(histogram) as f64;
    let tolerance = 0.5;
    let max_iterations = 100;

    for _ in 0..max_iterations {
        let mut sum_bg: f64 = 0.0;
        let mut count_bg: f64 = 0.0;
        let mut sum_fg: f64 = 0.0;
        let mut count_fg: f64 = 0.0;

        for (i, &val) in histogram.iter().enumerate() {
            let v = val as f64;
            if i <= threshold as usize {
                sum_bg += i as f64 * v;
                count_bg += v;
            } else {
                sum_fg += i as f64 * v;
                count_fg += v;
            }
        }

        if count_bg == 0.0 || count_fg == 0.0 {
            break;
        }

        let mean_bg = sum_bg / count_bg;
        let mean_fg = sum_fg / count_fg;

        if mean_bg <= 0.0 || mean_fg <= 0.0 {
            break;
        }

        let new_threshold =
            (mean_fg - mean_bg) / (mean_fg.ln() - mean_bg.ln() + 1e-10);

        if (new_threshold - threshold).abs() < tolerance {
            return new_threshold.round().min(255.0).max(0.0) as u8;
        }

        threshold = new_threshold;
    }

    threshold.round().min(255.0).max(0.0) as u8
}

/// Calculate histogram from grayscale pixel data.
pub fn calculate_histogram(gray_pixels: &[u8]) -> [u32; 256] {
    let mut histogram = [0u32; 256];
    for &pixel in gray_pixels {
        histogram[pixel as usize] += 1;
    }
    histogram
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_otsu_bimodal() {
        let mut hist = [0u32; 256];
        for i in 0..100 {
            hist[i] = 1000;
        }
        for i in 150..256 {
            hist[i] = 1000;
        }
        let t = get_otsu_threshold(&hist);
        assert!(t > 80 && t < 170, "Otsu threshold should be between modes: {}", t);
    }

    #[test]
    fn test_mean_threshold() {
        let mut hist = [0u32; 256];
        hist[100] = 100;
        let t = get_mean_threshold(&hist);
        assert_eq!(t, 100);
    }

    #[test]
    fn test_li_threshold() {
        let mut hist = [0u32; 256];
        for i in 0..128 {
            hist[i] = 500;
        }
        for i in 128..256 {
            hist[i] = 200;
        }
        let t = get_li_threshold(&hist);
        assert!(t > 50 && t < 200, "Li threshold should be reasonable: {}", t);
    }

    #[test]
    fn test_calculate_histogram() {
        let pixels = vec![0u8, 50, 100, 200, 255, 100];
        let hist = calculate_histogram(&pixels);
        assert_eq!(hist[0], 1);
        assert_eq!(hist[50], 1);
        assert_eq!(hist[100], 2);
        assert_eq!(hist[200], 1);
        assert_eq!(hist[255], 1);
    }
}
