use super::data_models::{CalibrationGridSettings, GridData, GridLine, GridMarker, Point, ScaleCalibrationInfo};

/// Calculate pixel distance between two points.
pub fn pixel_distance(p1: &Point, p2: &Point) -> f64 {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    (dx * dx + dy * dy).sqrt()
}

/// Calculate scale calibration from a measurement line and known real-world value.
pub fn calculate_calibration(
    start: &Point,
    end: &Point,
    known_value: f64,
    unit: &str,
) -> ScaleCalibrationInfo {
    let pixel_len = pixel_distance(start, end);
    if known_value <= 0.0 {
        return ScaleCalibrationInfo::default();
    }
    ScaleCalibrationInfo {
        pixels_per_unit: pixel_len / known_value,
        unit_name: unit.to_string(),
    }
}

/// Convert pixel area to real-world area using calibration.
pub fn pixel_area_to_real(pixel_area: f64, calibration: &ScaleCalibrationInfo) -> f64 {
    pixel_area / (calibration.pixels_per_unit * calibration.pixels_per_unit)
}

/// Convert pixel distance to real-world distance using calibration.
pub fn pixel_distance_to_real(pixel_dist: f64, calibration: &ScaleCalibrationInfo) -> f64 {
    pixel_dist / calibration.pixels_per_unit
}

/// Generate calibration grid data for rendering.
pub fn generate_grid(
    settings: &CalibrationGridSettings,
    image_width: f64,
    image_height: f64,
) -> GridData {
    if !settings.is_enabled || settings.rows == 0 || settings.columns == 0 {
        return GridData {
            lines: Vec::new(),
            markers: Vec::new(),
        };
    }

    let mut lines = Vec::new();
    let mut markers = Vec::new();

    let step_x = image_width / settings.columns as f64;
    let step_y = image_height / settings.rows as f64;

    // Vertical lines
    for col in 0..=settings.columns {
        let x = col as f64 * step_x;
        lines.push(GridLine {
            x1: x,
            y1: 0.0,
            x2: x,
            y2: image_height,
        });
    }

    // Horizontal lines
    for row in 0..=settings.rows {
        let y = row as f64 * step_y;
        lines.push(GridLine {
            x1: 0.0,
            y1: y,
            x2: image_width,
            y2: y,
        });
    }

    // Intersection markers
    for row in 0..=settings.rows {
        for col in 0..=settings.columns {
            let x = col as f64 * step_x;
            let y = row as f64 * step_y;
            markers.push(GridMarker {
                x,
                y,
                marker_type: settings.marker_type.clone(),
                color: settings.marker_color.clone(),
            });
        }
    }

    GridData { lines, markers }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pixel_distance() {
        let p1 = Point { x: 0.0, y: 0.0 };
        let p2 = Point { x: 3.0, y: 4.0 };
        assert!((pixel_distance(&p1, &p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_calibration() {
        let p1 = Point { x: 0.0, y: 0.0 };
        let p2 = Point { x: 100.0, y: 0.0 };
        let cal = calculate_calibration(&p1, &p2, 10.0, "mm");
        assert!((cal.pixels_per_unit - 10.0).abs() < 1e-10);
        assert_eq!(cal.unit_name, "mm");
    }

    #[test]
    fn test_area_conversion() {
        let cal = ScaleCalibrationInfo {
            pixels_per_unit: 10.0,
            unit_name: "mm".to_string(),
        };
        let real = pixel_area_to_real(10000.0, &cal);
        assert!((real - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_grid_generation() {
        let settings = CalibrationGridSettings {
            is_enabled: true,
            rows: 2,
            columns: 2,
            marker_color: "Yellow".to_string(),
            marker_type: "+".to_string(),
        };
        let grid = generate_grid(&settings, 100.0, 100.0);
        assert_eq!(grid.lines.len(), 6); // 3 vertical + 3 horizontal
        assert_eq!(grid.markers.len(), 9); // 3x3 intersections
    }
}
