/// Linear and non-linear image filters (PROC-01, PROC-02, PROC-03, PROC-04)
pub struct Filters;

impl Filters {
    /// 1D Gaussian kernel generation
    pub fn gaussian_kernel(sigma: f32) -> Vec<f32> {
        let radius = (3.0 * sigma).ceil() as usize;
        let size = 2 * radius + 1;
        let mut kernel = vec![0.0f32; size];
        let two_sigma_sq = 2.0 * sigma * sigma;
        let mut sum = 0.0f32;

        for i in 0..size {
            let x = (i as isize - radius as isize) as f32;
            let val = (-x * x / two_sigma_sq).exp();
            kernel[i] = val;
            sum += val;
        }

        for k in &mut kernel {
            *k /= sum;
        }
        kernel
    }

    /// Fast separable 2D Gaussian blur
    pub fn gaussian_blur(data: &[u8], width: usize, height: usize, channels: usize, sigma: f32) -> Vec<u8> {
        if sigma <= 0.0 || width == 0 || height == 0 {
            return data.to_vec();
        }

        let kernel = Self::gaussian_kernel(sigma);
        let radius = kernel.len() / 2;

        let mut temp = vec![0.0f32; width * height * channels];
        let mut output = vec![0u8; width * height * channels];

        // Horizontal pass
        for y in 0..height {
            for x in 0..width {
                for c in 0..channels {
                    let mut acc = 0.0f32;
                    for (k_idx, &weight) in kernel.iter().enumerate() {
                        let sample_x = (x as isize + (k_idx as isize - radius as isize))
                            .clamp(0, width as isize - 1) as usize;
                        let val = data[(y * width + sample_x) * channels + c] as f32;
                        acc += val * weight;
                    }
                    temp[(y * width + x) * channels + c] = acc;
                }
            }
        }

        // Vertical pass
        for y in 0..height {
            for x in 0..width {
                for c in 0..channels {
                    let mut acc = 0.0f32;
                    for (k_idx, &weight) in kernel.iter().enumerate() {
                        let sample_y = (y as isize + (k_idx as isize - radius as isize))
                            .clamp(0, height as isize - 1) as usize;
                        let val = temp[(sample_y * width + x) * channels + c];
                        acc += val * weight;
                    }
                    output[(y * width + x) * channels + c] = acc.round().clamp(0.0, 255.0) as u8;
                }
            }
        }

        output
    }

    /// Median filter for salt-and-pepper noise reduction while preserving cell edges (PROC-03)
    pub fn median_filter(data: &[u8], width: usize, height: usize, channels: usize, radius: usize) -> Vec<u8> {
        let mut output = vec![0u8; width * height * channels];
        if radius == 0 {
            output.copy_from_slice(data);
            return output;
        }

        let mut window = Vec::with_capacity((2 * radius + 1) * (2 * radius + 1));

        for y in 0..height {
            for x in 0..width {
                for c in 0..channels {
                    window.clear();
                    for dy in -(radius as isize)..=(radius as isize) {
                        for dx in -(radius as isize)..=(radius as isize) {
                            let nx = (x as isize + dx).clamp(0, width as isize - 1) as usize;
                            let ny = (y as isize + dy).clamp(0, height as isize - 1) as usize;
                            window.push(data[(ny * width + nx) * channels + c]);
                        }
                    }
                    window.sort_unstable();
                    let median = window[window.len() / 2];
                    output[(y * width + x) * channels + c] = median;
                }
            }
        }

        output
    }
}

