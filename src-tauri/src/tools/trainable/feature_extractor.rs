use image::{DynamicImage, RgbImage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureSettings {
    pub gaussian_enabled: bool,
    pub gaussian_sigmas: Vec<f32>,
    pub sobel_enabled: bool,
    pub sobel_sigmas: Vec<f32>,
    pub laplacian_enabled: bool,
    pub laplacian_sigmas: Vec<f32>,
}

impl Default for FeatureSettings {
    fn default() -> Self {
        Self {
            gaussian_enabled: true,
            gaussian_sigmas: vec![1.0, 2.0],
            sobel_enabled: true,
            sobel_sigmas: vec![1.0, 2.0],
            laplacian_enabled: true,
            laplacian_sigmas: vec![2.0, 4.0],
        }
    }
}

impl FeatureSettings {
    pub fn total_feature_count(&self) -> usize {
        let mut count = 3;
        if self.gaussian_enabled {
            count += self.gaussian_sigmas.len();
        }
        if self.sobel_enabled {
            count += self.sobel_sigmas.len();
        }
        if self.laplacian_enabled {
            count += self.laplacian_sigmas.len();
        }
        count
    }
}

fn to_grayscale(img: &RgbImage) -> Vec<f32> {
    let (w, h) = img.dimensions();
    let mut gray = vec![0.0f32; (w * h) as usize];
    for y in 0..h {
        for x in 0..w {
            let p = img.get_pixel(x, y);
            let r = p[0] as f32;
            let g = p[1] as f32;
            let b = p[2] as f32;
            gray[(y * w + x) as usize] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
    }
    gray
}

fn to_hsv(img: &RgbImage) -> (Vec<f32>, Vec<f32>, Vec<f32>) {
    let (w, h) = img.dimensions();
    let n = (w * h) as usize;
    let mut h_channel = vec![0.0f32; n];
    let mut s_channel = vec![0.0f32; n];
    let mut v_channel = vec![0.0f32; n];

    for y in 0..h {
        for x in 0..w {
            let p = img.get_pixel(x, y);
            let r = p[0] as f32 / 255.0;
            let g = p[1] as f32 / 255.0;
            let b = p[2] as f32 / 255.0;
            let max = r.max(g).max(b);
            let min = r.min(g).min(b);
            let d = max - min;
            let idx = (y * w + x) as usize;

            v_channel[idx] = max;

            if max == 0.0 {
                s_channel[idx] = 0.0;
            } else {
                s_channel[idx] = d / max;
            }

            if d == 0.0 {
                h_channel[idx] = 0.0;
            } else if max == r {
                h_channel[idx] = 60.0 * (((g - b) / d) % 6.0);
            } else if max == g {
                h_channel[idx] = 60.0 * (((b - r) / d) + 2.0);
            } else {
                h_channel[idx] = 60.0 * (((r - g) / d) + 4.0);
            }
            if h_channel[idx] < 0.0 {
                h_channel[idx] += 360.0;
            }
            h_channel[idx] /= 360.0;
        }
    }
    (h_channel, s_channel, v_channel)
}

fn make_gaussian_kernel(sigma: f32) -> Vec<f32> {
    let radius = ((sigma * 3.0) as i32).max(1) as usize;
    let size = radius * 2 + 1;
    let mut kernel = vec![0.0f32; size];
    let mut sum = 0.0;
    for i in 0..size {
        let x = i as f32 - radius as f32;
        kernel[i] = (-x * x / (2.0 * sigma * sigma)).exp();
        sum += kernel[i];
    }
    for v in kernel.iter_mut() {
        *v /= sum;
    }
    kernel
}

fn convolve_horizontal(gray: &[f32], w: u32, h: u32, kernel: &[f32]) -> Vec<f32> {
    let radius = kernel.len() / 2;
    let mut out = vec![0.0f32; gray.len()];
    for y in 0..h as usize {
        for x in 0..w as usize {
            let mut sum = 0.0;
            for k in 0..kernel.len() {
                let nx = x as i32 + k as i32 - radius as i32;
                let nx = nx.max(0).min(w as i32 - 1) as usize;
                sum += gray[y * w as usize + nx] * kernel[k];
            }
            out[y * w as usize + x] = sum;
        }
    }
    out
}

fn convolve_vertical(gray: &[f32], w: u32, h: u32, kernel: &[f32]) -> Vec<f32> {
    let radius = kernel.len() / 2;
    let mut out = vec![0.0f32; gray.len()];
    for y in 0..h as usize {
        for x in 0..w as usize {
            let mut sum = 0.0;
            for k in 0..kernel.len() {
                let ny = y as i32 + k as i32 - radius as i32;
                let ny = ny.max(0).min(h as i32 - 1) as usize;
                sum += gray[ny * w as usize + x] * kernel[k];
            }
            out[y * w as usize + x] = sum;
        }
    }
    out
}

fn gaussian_blur(gray: &[f32], w: u32, h: u32, sigma: f32) -> Vec<f32> {
    let kernel = make_gaussian_kernel(sigma);
    let temp = convolve_horizontal(gray, w, h, &kernel);
    convolve_vertical(&temp, w, h, &kernel)
}

fn sobel_magnitude(gray: &[f32], w: u32, h: u32, sigma: f32) -> Vec<f32> {
    let blurred = gaussian_blur(gray, w, h, sigma);
    let mut gx = vec![0.0f32; blurred.len()];
    let mut gy = vec![0.0f32; blurred.len()];

    for y in 1..(h as usize - 1) {
        for x in 1..(w as usize - 1) {
            let idx = y * w as usize + x;
            gx[idx] = -blurred[(y - 1) * w as usize + (x - 1)]
                - 2.0 * blurred[y * w as usize + (x - 1)]
                - blurred[(y + 1) * w as usize + (x - 1)]
                + blurred[(y - 1) * w as usize + (x + 1)]
                + 2.0 * blurred[y * w as usize + (x + 1)]
                + blurred[(y + 1) * w as usize + (x + 1)];
            gy[idx] = -blurred[(y - 1) * w as usize + (x - 1)]
                - 2.0 * blurred[(y - 1) * w as usize + x]
                - blurred[(y - 1) * w as usize + (x + 1)]
                + blurred[(y + 1) * w as usize + (x - 1)]
                + 2.0 * blurred[(y + 1) * w as usize + x]
                + blurred[(y + 1) * w as usize + (x + 1)];
        }
    }

    let mut mag = vec![0.0f32; blurred.len()];
    for i in 0..mag.len() {
        mag[i] = (gx[i] * gx[i] + gy[i] * gy[i]).sqrt();
    }
    mag
}

fn laplacian(gray: &[f32], w: u32, h: u32, sigma: f32) -> Vec<f32> {
    let blurred = gaussian_blur(gray, w, h, sigma);
    let mut out = vec![0.0f32; blurred.len()];

    for y in 1..(h as usize - 1) {
        for x in 1..(w as usize - 1) {
            let idx = y * w as usize + x;
            out[idx] = -4.0 * blurred[idx]
                + blurred[(y - 1) * w as usize + x]
                + blurred[(y + 1) * w as usize + x]
                + blurred[y * w as usize + (x - 1)]
                + blurred[y * w as usize + (x + 1)];
        }
    }
    out
}

#[allow(dead_code)]
pub struct FeatureMaps {
    pub width: u32,
    pub height: u32,
    pub maps: Vec<Vec<f32>>,
    pub feature_count: usize,
}

pub fn extract_feature_maps(img: &DynamicImage, settings: &FeatureSettings) -> FeatureMaps {
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    let _n = (w * h) as usize;
    let gray = to_grayscale(&rgb);
    let (h_ch, s_ch, v_ch) = to_hsv(&rgb);

    let mut maps: Vec<Vec<f32>> = Vec::new();
    maps.push(h_ch);
    maps.push(s_ch);
    maps.push(v_ch);

    if settings.gaussian_enabled {
        for &sigma in &settings.gaussian_sigmas {
            maps.push(gaussian_blur(&gray, w, h, sigma));
        }
    }
    if settings.sobel_enabled {
        for &sigma in &settings.sobel_sigmas {
            maps.push(sobel_magnitude(&gray, w, h, sigma));
        }
    }
    if settings.laplacian_enabled {
        for &sigma in &settings.laplacian_sigmas {
            maps.push(laplacian(&gray, w, h, sigma));
        }
    }

    let feature_count = maps.len();
    FeatureMaps {
        width: w,
        height: h,
        maps,
        feature_count,
    }
}

pub fn get_feature_vector(feature_maps: &FeatureMaps, x: u32, y: u32) -> Vec<f32> {
    let idx = (y * feature_maps.width + x) as usize;
    feature_maps
        .maps
        .iter()
        .map(|m| {
            let v = m[idx];
            if v.is_finite() { v } else { 0.0 }
        })
        .collect()
}

#[allow(dead_code)]
pub fn normalize_features(features: &mut [f32]) {
    for f in features.iter_mut() {
        *f = (*f).clamp(0.0, 1.0);
    }
}
