use super::data_models::{Point, ScaleCalibrationInfo};
use super::scale::{pixel_area_to_real, pixel_distance, pixel_distance_to_real};

/// Shoelace formula for polygon area (in pixel coordinates).
pub fn shoelace_area(points: &[Point]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    let n = points.len();
    let mut area = 0.0;
    for i in 0..n {
        let j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    area.abs() / 2.0
}

/// Calculate real-world polygon area using calibration.
pub fn polygon_area_real(points: &[Point], calibration: &ScaleCalibrationInfo) -> f64 {
    let pixel_area = shoelace_area(points);
    pixel_area_to_real(pixel_area, calibration)
}

/// Format area with unit for display.
pub fn format_area(area: f64, unit: &str) -> String {
    format!("{:.2} {}", area, unit)
}

/// Calculate real-world measurement distance between two points.
pub fn measurement_distance(p1: &Point, p2: &Point, calibration: &ScaleCalibrationInfo) -> f64 {
    let px_dist = pixel_distance(p1, p2);
    pixel_distance_to_real(px_dist, calibration)
}

/// Sobel gradient magnitude for a grayscale image.
/// Returns a 2D array of gradient magnitudes.
pub fn compute_sobel_gradient(gray_pixels: &[u8], width: usize, height: usize) -> Vec<Vec<f64>> {
    let mut gradient = vec![vec![0.0f64; width]; height];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            // Sobel X
            let gx = -(gray_pixels[(y - 1) * width + (x - 1)] as f64)
                - 2.0 * (gray_pixels[y * width + (x - 1)] as f64)
                - (gray_pixels[(y + 1) * width + (x - 1)] as f64)
                + (gray_pixels[(y - 1) * width + (x + 1)] as f64)
                + 2.0 * (gray_pixels[y * width + (x + 1)] as f64)
                + (gray_pixels[(y + 1) * width + (x + 1)] as f64);

            // Sobel Y
            let gy = -(gray_pixels[(y - 1) * width + (x - 1)] as f64)
                - 2.0 * (gray_pixels[(y - 1) * width + x] as f64)
                - (gray_pixels[(y - 1) * width + (x + 1)] as f64)
                + (gray_pixels[(y + 1) * width + (x - 1)] as f64)
                + 2.0 * (gray_pixels[(y + 1) * width + x] as f64)
                + (gray_pixels[(y + 1) * width + (x + 1)] as f64);

            gradient[y][x] = (gx * gx + gy * gy).sqrt();
        }
    }

    gradient
}

/// Find the strongest edge pixel within a given radius of a center point.
/// Returns the snapped position in pixel coordinates.
pub fn find_strongest_edge(
    gradient: &[Vec<f64>],
    center_x: f64,
    center_y: f64,
    radius: f64,
    width: usize,
    height: usize,
) -> Point {
    let cx = center_x.round() as i32;
    let cy = center_y.round() as i32;
    let r = radius.round() as i32;

    let mut best_x = cx;
    let mut best_y = cy;
    let mut best_mag = 0.0f64;

    for dy in -r..=r {
        for dx in -r..=r {
            let nx = cx + dx;
            let ny = cy + dy;
            if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                let mag = gradient[ny as usize][nx as usize];
                if mag > best_mag {
                    best_mag = mag;
                    best_x = nx;
                    best_y = ny;
                }
            }
        }
    }

    Point {
        x: best_x as f64,
        y: best_y as f64,
    }
}

/// Convert RGBA image to grayscale.
pub fn rgba_to_grayscale(pixels: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut gray = vec![0u8; width * height];
    for i in 0..width * height {
        let r = pixels[i * 4] as f64;
        let g = pixels[i * 4 + 1] as f64;
        let b = pixels[i * 4 + 2] as f64;
        gray[i] = (0.299 * r + 0.587 * g + 0.114 * b).round() as u8;
    }
    gray
}

/// Convert RGBA pixels to HSV for each pixel.
pub fn rgba_to_hsv(pixels: &[u8], width: usize, height: usize) -> Vec<(u8, u8, u8)> {
    let mut hsv_vec = Vec::with_capacity(width * height);
    for i in 0..width * height {
        let r = pixels[i * 4] as f64 / 255.0;
        let g = pixels[i * 4 + 1] as f64 / 255.0;
        let b = pixels[i * 4 + 2] as f64 / 255.0;

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

        let s = if max < 1e-6 { 0.0 } else { delta / max * 100.0 };
        let v = max * 100.0;

        hsv_vec.push((
            (h / 2.0).round() as u8, // H: 0-179
            (s * 2.55).round() as u8,  // S: 0-100 -> 0-255
            (v * 2.55).round() as u8,  // V: 0-100 -> 0-255
        ));
    }
    hsv_vec
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shoelace_square() {
        let points = vec![
            Point { x: 0.0, y: 0.0 },
            Point { x: 10.0, y: 0.0 },
            Point { x: 10.0, y: 10.0 },
            Point { x: 0.0, y: 10.0 },
        ];
        let area = shoelace_area(&points);
        assert!((area - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_shoelace_triangle() {
        let points = vec![
            Point { x: 0.0, y: 0.0 },
            Point { x: 10.0, y: 0.0 },
            Point { x: 5.0, y: 10.0 },
        ];
        let area = shoelace_area(&points);
        assert!((area - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_measurement_distance() {
        let cal = ScaleCalibrationInfo {
            pixels_per_unit: 10.0,
            unit_name: "mm".to_string(),
        };
        let p1 = Point { x: 0.0, y: 0.0 };
        let p2 = Point { x: 30.0, y: 40.0 };
        let d = measurement_distance(&p1, &p2, &cal);
        assert!((d - 5.0).abs() < 1e-10);
    }
}
