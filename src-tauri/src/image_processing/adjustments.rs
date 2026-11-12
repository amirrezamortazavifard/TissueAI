/// Contrast, Brightness, Gamma, and Invert adjustments (ADJ-02, ADJ-06, ADJ-10)
pub struct Adjustments;

impl Adjustments {
    /// Apply linear contrast and brightness scaling
    /// factor = contrast (e.g. 1.0 = normal, 1.5 = high, 0.8 = low)
    /// offset = brightness (-128 to 128)
    pub fn brightness_contrast(data: &[u8], contrast: f32, brightness: f32) -> Vec<u8> {
        let mut lut = [0u8; 256];
        for (i, slot) in lut.iter_mut().enumerate() {
            let val = (i as f32 - 128.0) * contrast + 128.0 + brightness;
            *slot = val.round().clamp(0.0, 255.0) as u8;
        }

        data.iter().map(|&b| lut[b as usize]).collect()
    }

    /// Invert pixel intensities (ADJ-06)
    pub fn invert(data: &[u8]) -> Vec<u8> {
        data.iter().map(|&b| 255 - b).collect()
    }

    /// Gamma correction (ADJ-10)
    pub fn gamma(data: &[u8], gamma_val: f32) -> Vec<u8> {
        if gamma_val <= 0.0 {
            return data.to_vec();
        }
        let inv_gamma = 1.0 / gamma_val;
        let mut lut = [0u8; 256];
        for (i, slot) in lut.iter_mut().enumerate() {
            let normalized = (i as f32) / 255.0;
            let corrected = normalized.powf(inv_gamma);
            *slot = (corrected * 255.0).round().clamp(0.0, 255.0) as u8;
        }

        data.iter().map(|&b| lut[b as usize]).collect()
    }
}

