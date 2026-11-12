use super::auto_thresholding::{calculate_histogram, get_li_threshold, get_mean_threshold, get_otsu_threshold};
use super::connected_components::find_connected_components;
use super::data_models::{
    AutoThresholdMethod, HsvRanges, ScaleCalibrationInfo, ThresholdAnalysisResult,
    ThresholdResultItem,
};
use super::scale::pixel_area_to_real;

/// Full threshold analysis pipeline.
/// Takes raw RGBA pixel data, applies threshold, finds connected components, and analyzes them.
pub fn perform_threshold_analysis(
    rgba_pixels: &[u8],
    width: usize,
    height: usize,
    hsv_ranges: &HsvRanges,
    is_grayscale_mode: bool,
    grayscale_value_range: Option<(u8, u8)>,
    min_object_size: usize,
    calibration: &ScaleCalibrationInfo,
) -> ThresholdAnalysisResult {
    let binary_mask = generate_binary_mask(
        rgba_pixels,
        width,
        height,
        hsv_ranges,
        is_grayscale_mode,
        grayscale_value_range,
    );

    analyze_binary_mask(&binary_mask, width, height, min_object_size, calibration)
}

/// Analyze an existing binary mask (for re-analysis after morphology).
pub fn analyze_binary_mask(
    binary_mask: &[Vec<bool>],
    width: usize,
    height: usize,
    min_object_size: usize,
    calibration: &ScaleCalibrationInfo,
) -> ThresholdAnalysisResult {
    let (labeled_mask, _count, components) =
        find_connected_components(binary_mask, width, height, min_object_size);

    let results: Vec<ThresholdResultItem> = components
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let real_area = pixel_area_to_real(c.area as f64, calibration);
            ThresholdResultItem {
                display_index: i + 1,
                label: c.label,
                area: c.area as f64,
                perimeter: c.perimeter,
                circularity: c.circularity,
                centroid_x: c.centroid_x,
                centroid_y: c.centroid_y,
                bounding_x: c.bounding_x,
                bounding_y: c.bounding_y,
                bounding_width: c.bounding_width,
                bounding_height: c.bounding_height,
                calculated_area_with_unit: format!("{:.2} {}", real_area, calibration.unit_name),
            }
        })
        .collect();

    ThresholdAnalysisResult {
        results,
        binary_mask: binary_mask.to_vec(),
        labeled_mask,
        width: width as u32,
        height: height as u32,
    }
}

/// Generate binary mask from RGBA pixels based on HSV ranges or grayscale range.
pub fn generate_binary_mask(
    rgba_pixels: &[u8],
    width: usize,
    height: usize,
    hsv_ranges: &HsvRanges,
    is_grayscale_mode: bool,
    grayscale_value_range: Option<(u8, u8)>,
) -> Vec<Vec<bool>> {
    let mut mask = vec![vec![false; width]; height];

    if is_grayscale_mode {
        let (g_min, g_max) = grayscale_value_range.unwrap_or((0, 255));
        for y in 0..height {
            for x in 0..width {
                let idx = (y * width + x) * 4;
                let r = rgba_pixels[idx] as f64;
                let g = rgba_pixels[idx + 1] as f64;
                let b = rgba_pixels[idx + 2] as f64;
                let gray = (0.299 * r + 0.587 * g + 0.114 * b).round() as u8;
                mask[y][x] = gray >= g_min && gray <= g_max;
            }
        }
    } else {
        for y in 0..height {
            for x in 0..width {
                let idx = (y * width + x) * 4;
                let r = rgba_pixels[idx] as f64 / 255.0;
                let g = rgba_pixels[idx + 1] as f64 / 255.0;
                let b = rgba_pixels[idx + 2] as f64 / 255.0;

                let max = r.max(g).max(b);
                let min = r.min(g).min(b);
                let delta = max - min;

                let h = if delta < 1e-6 {
                    0.0
                } else if (max - r).abs() < 1e-6 {
                    60.0 * (((g - b) / delta) % 6.0)
                } else if (max - g).abs() < 1e-6 {
                    60.0 * (((b - r) / delta) + 2.0)
                } else {
                    60.0 * (((r - g) / delta) + 4.0)
                };
                let h = if h < 0.0 { h + 360.0 } else { h };
                let h_u8 = (h / 2.0).round() as u8;

                let s = if max < 1e-6 { 0.0 } else { delta / max * 100.0 };
                let s_u8 = (s * 2.55).round() as u8;

                let v = max * 100.0;
                let v_u8 = (v * 2.55).round() as u8;

                let h_match = h_u8 >= hsv_ranges.h_min && h_u8 <= hsv_ranges.h_max;
                let s_match = s_u8 >= hsv_ranges.s_min && s_u8 <= hsv_ranges.s_max;
                let v_match = v_u8 >= hsv_ranges.v_min && v_u8 <= hsv_ranges.v_max;

                mask[y][x] = h_match && s_match && v_match;
            }
        }
    }

    mask
}

/// Apply auto threshold method to RGBA image and return analysis results.
pub fn apply_auto_threshold(
    rgba_pixels: &[u8],
    width: usize,
    height: usize,
    method: &AutoThresholdMethod,
    min_object_size: usize,
    calibration: &ScaleCalibrationInfo,
) -> ThresholdAnalysisResult {
    // Convert to grayscale
    let mut gray_pixels = vec![0u8; width * height];
    for i in 0..width * height {
        let r = rgba_pixels[i * 4] as f64;
        let g = rgba_pixels[i * 4 + 1] as f64;
        let b = rgba_pixels[i * 4 + 2] as f64;
        gray_pixels[i] = (0.299 * r + 0.587 * g + 0.114 * b).round() as u8;
    }

    let histogram = calculate_histogram(&gray_pixels);

    let threshold = match method {
        AutoThresholdMethod::Otsu => get_otsu_threshold(&histogram),
        AutoThresholdMethod::Mean => get_mean_threshold(&histogram),
        AutoThresholdMethod::Li => get_li_threshold(&histogram),
    };

    // Generate binary mask using the calculated threshold on grayscale
    let mut mask = vec![vec![false; width]; height];
    for y in 0..height {
        for x in 0..width {
            mask[y][x] = gray_pixels[y * width + x] <= threshold;
        }
    }

    analyze_binary_mask(&mask, width, height, min_object_size, calibration)
}

/// Create a colored overlay for visualization.
pub fn create_colored_overlay(
    labeled_mask: &[Vec<i32>],
    width: usize,
    height: usize,
    highlight_label: Option<i32>,
) -> Vec<u8> {
    // Predefined colors for different components
    let colors: [(u8, u8, u8); 12] = [
        (255, 165, 0),   // Orange
        (0, 255, 255),   // Cyan
        (255, 0, 255),   // Magenta
        (0, 255, 0),     // Green
        (255, 255, 0),   // Yellow
        (0, 0, 255),     // Blue
        (255, 0, 0),     // Red
        (128, 0, 255),   // Purple
        (0, 128, 255),   // Sky blue
        (255, 128, 0),   // Dark orange
        (0, 255, 128),   // Spring green
        (255, 0, 128),   // Rose
    ];

    let mut overlay = vec![0u8; width * height * 4];

    for y in 0..height {
        for x in 0..width {
            let label = labeled_mask[y][x];
            let idx = (y * width + x) * 4;

            if label > 0 {
                let is_highlighted = highlight_label.map_or(true, |h| h == label);
                let alpha = if is_highlighted { 150u8 } else { 60u8 };
                let color_idx = ((label - 1) as usize) % colors.len();
                let (r, g, b) = colors[color_idx];

                if is_highlighted && highlight_label.is_some() {
                    // Bright highlight for selected
                    overlay[idx] = 0;
                    overlay[idx + 1] = 255;
                    overlay[idx + 2] = 255;
                    overlay[idx + 3] = 180;
                } else {
                    overlay[idx] = r;
                    overlay[idx + 1] = g;
                    overlay[idx + 2] = b;
                    overlay[idx + 3] = alpha;
                }
            } else {
                overlay[idx] = 0;
                overlay[idx + 1] = 0;
                overlay[idx + 2] = 0;
                overlay[idx + 3] = 0;
            }
        }
    }

    overlay
}
