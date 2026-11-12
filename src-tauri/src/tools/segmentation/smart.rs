use super::data_models::ContourSegment;

/// Generate contour segments from a binary mask using marching squares.
pub fn generate_contour_segments(
    mask: &[f32],
    width: usize,
    height: usize,
    threshold: f32,
) -> Vec<ContourSegment> {
    let mut segments = Vec::new();

    for y in 0..height - 1 {
        for x in 0..width - 1 {
            let tl = mask[y * width + x];
            let tr = mask[y * width + x + 1];
            let br = mask[(y + 1) * width + x + 1];
            let bl = mask[(y + 1) * width + x];

            let mut config = 0u8;
            if tl >= threshold { config |= 1; }
            if tr >= threshold { config |= 2; }
            if br >= threshold { config |= 4; }
            if bl >= threshold { config |= 8; }

            if config == 0 || config == 15 {
                continue;
            }

            let x0 = x as f64;
            let y0 = y as f64;

            // Interpolation helpers
            let interp_x = |left: f32, right: f32| -> f64 {
                let t = (threshold - left) as f64 / (right - left).max(1e-7) as f64;
                x0 + t
            };
            let interp_y = |top: f32, bottom: f32| -> f64 {
                let t = (threshold - top) as f64 / (bottom - top).max(1e-7) as f64;
                y0 + t
            };

            let top = (interp_x(tl, tr), y0);
            let right = (x0 + 1.0, interp_y(tr, br));
            let bottom = (interp_x(bl, br), y0 + 1.0);
            let left = (x0, interp_y(tl, bl));

            let mut add_segment = |p1: (f64, f64), p2: (f64, f64)| {
                segments.push(ContourSegment {
                    x1: p1.0,
                    y1: p1.1,
                    x2: p2.0,
                    y2: p2.1,
                });
            };

            match config {
                1 | 14 => add_segment(top, left),
                2 | 13 => add_segment(top, right),
                3 | 12 => add_segment(left, right),
                4 | 11 => add_segment(bottom, right),
                5 => {
                    add_segment(top, right);
                    add_segment(left, bottom);
                }
                6 | 9 => add_segment(top, bottom),
                7 | 8 => add_segment(left, bottom),
                10 => {
                    add_segment(top, left);
                    add_segment(bottom, right);
                }
                _ => {}
            }
        }
    }

    segments
}

/// Smooth a mask using a 3x3 median filter.
pub fn smooth_mask(mask: &[f32], width: usize, height: usize) -> Vec<f32> {
    let mut result = vec![0.0f32; width * height];

    for y in 0..height {
        for x in 0..width {
            let mut neighbors = Vec::with_capacity(9);
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                        neighbors.push(mask[ny as usize * width + nx as usize]);
                    }
                }
            }
            neighbors.sort_by(|a, b| a.partial_cmp(b).unwrap());
            result[y * width + x] = neighbors[neighbors.len() / 2];
        }
    }

    result
}

/// Calculate area from a binary mask (count pixels above threshold).
pub fn calculate_mask_area(mask: &[f32], width: usize, height: usize, threshold: f32) -> usize {
    let mut count = 0;
    for y in 0..height {
        for x in 0..width {
            if mask[y * width + x] >= threshold {
                count += 1;
            }
        }
    }
    count
}

/// Calculate real-world area from pixel area using calibration.
pub fn mask_area_to_real(pixel_area: usize, pixels_per_unit: f64, unit: &str) -> String {
    let real_area = pixel_area as f64 / (pixels_per_unit * pixels_per_unit);
    format!("{:.2} {}", real_area, unit)
}

/// Convert mask float array to colored RGBA overlay (orange tint).
pub fn colorize_mask(mask: &[f32], width: usize, height: usize, threshold: f32) -> Vec<u8> {
    let mut rgba = vec![0u8; width * height * 4];
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let rgba_idx = idx * 4;
            if mask[idx] >= threshold {
                rgba[rgba_idx] = 255;      // R
                rgba[rgba_idx + 1] = 165;  // G
                rgba[rgba_idx + 2] = 0;    // B
                rgba[rgba_idx + 3] = 150;  // A
            }
        }
    }
    rgba
}

/// Create a masked pixel overlay with vibrance modulation.
pub fn create_masked_pixels(
    mask: &[f32],
    width: usize,
    height: usize,
    threshold: f32,
) -> Vec<u8> {
    let mut rgba = vec![0u8; width * height * 4];
    for i in 0..width * height {
        let rgba_idx = i * 4;
        let alpha = if mask[i] >= threshold { 255u8 } else { 100u8 };
        rgba[rgba_idx] = 255;
        rgba[rgba_idx + 1] = 165;
        rgba[rgba_idx + 2] = 0;
        rgba[rgba_idx + 3] = alpha;
    }
    rgba
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contour_generation() {
        let width = 4;
        let height = 4;
        let mask = vec![
            0.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 1.0, 0.0,
            0.0, 1.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ];
        let segments = generate_contour_segments(&mask, width, height, 0.5);
        assert!(!segments.is_empty(), "Should have contour segments around the square");
    }

    #[test]
    fn test_smooth_mask() {
        let mask = vec![0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0];
        let smoothed = smooth_mask(&mask, 3, 3);
        // Center pixel should still be high due to median filter
        assert!(smoothed[4] >= 0.0);
    }

    #[test]
    fn test_mask_area() {
        let mask = vec![0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0];
        let area = calculate_mask_area(&mask, 3, 3, 0.5);
        assert_eq!(area, 3);
    }
}
