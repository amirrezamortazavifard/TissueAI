use super::geometry::{GeometryEngine, RoiShape};
use crate::scientific_models::scientific_image::SpatialCalibration;
use serde::{Deserialize, Serialize};

/// Comprehensive scientific ROI measurements (ANA-01, ANA-02, ANA-03)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RoiMeasurements {
    pub area_px: f64,
    pub area_physical: f64,
    pub perimeter_px: f64,
    pub perimeter_physical: f64,
    pub circularity: f64,
    pub aspect_ratio: f64,
    pub feret_max_physical: f64,
    pub feret_min_physical: f64,
    pub centroid_x_physical: f64,
    pub centroid_y_physical: f64,
    pub unit_name: String,
    pub is_calibrated: bool,
    // Pixel intensity metrics (if image buffer was evaluated)
    pub mean_intensity: Option<f64>,
    pub min_intensity: Option<f64>,
    pub max_intensity: Option<f64>,
    pub std_dev_intensity: Option<f64>,
}

pub struct MeasurementEngine;

impl MeasurementEngine {
    pub fn measure(
        shape: &RoiShape,
        calibration: &SpatialCalibration,
    ) -> RoiMeasurements {
        let metrics = GeometryEngine::compute_shape_metrics(shape);

        // If uncalibrated, physical values remain 0 / uncalibrated
        let (area_phys, perim_phys, feret_max_phys, feret_min_phys, cx_phys, cy_phys) = if calibration.is_calibrated {
            let area = calibration.calculate_calibrated_area(metrics.area_px);
            
            // Calculate true anisotropic perimeter based on shape type
            let perim = match shape {
                RoiShape::Rectangle { width, height, .. } => {
                    2.0 * (width * calibration.pixel_size_x + height * calibration.pixel_size_y)
                }
                RoiShape::Ellipse { radius_x, radius_y, .. } => {
                    let a = radius_x * calibration.pixel_size_x;
                    let b = radius_y * calibration.pixel_size_y;
                    // Ramanujan approximation for ellipse perimeter
                    let h = ((a - b) * (a - b)) / ((a + b) * (a + b));
                    std::f64::consts::PI * (a + b) * (1.0 + (3.0 * h) / (10.0 + (4.0 - 3.0 * h).sqrt()))
                }
                RoiShape::Polygon { points } => {
                    let n = points.len();
                    let mut p = 0.0;
                    for i in 0..n {
                        let j = (i + 1) % n;
                        let dx = (points[j].x - points[i].x) * calibration.pixel_size_x;
                        let dy = (points[j].y - points[i].y) * calibration.pixel_size_y;
                        p += (dx * dx + dy * dy).sqrt();
                    }
                    p
                }
                RoiShape::Polyline { points } => {
                    let mut p = 0.0;
                    for w in points.windows(2) {
                        let dx = (w[1].x - w[0].x) * calibration.pixel_size_x;
                        let dy = (w[1].y - w[0].y) * calibration.pixel_size_y;
                        p += (dx * dx + dy * dy).sqrt();
                    }
                    p
                }
                _ => metrics.perimeter_px * ((calibration.pixel_size_x + calibration.pixel_size_y) / 2.0),
            };

            let f_max = metrics.feret_max_px * ((calibration.pixel_size_x + calibration.pixel_size_y) / 2.0);
            let f_min = metrics.feret_min_px * ((calibration.pixel_size_x + calibration.pixel_size_y) / 2.0);
            let (cx, cy) = calibration.pixel_to_physical(metrics.centroid.x, metrics.centroid.y);

            (area, perim, f_max, f_min, cx, cy)
        } else {
            (metrics.area_px, metrics.perimeter_px, metrics.feret_max_px, metrics.feret_min_px, metrics.centroid.x, metrics.centroid.y)
        };

        RoiMeasurements {
            area_px: metrics.area_px,
            area_physical: area_phys,
            perimeter_px: metrics.perimeter_px,
            perimeter_physical: perim_phys,
            circularity: metrics.circularity,
            aspect_ratio: metrics.aspect_ratio,
            feret_max_physical: feret_max_phys,
            feret_min_physical: feret_min_phys,
            centroid_x_physical: cx_phys,
            centroid_y_physical: cy_phys,
            unit_name: if calibration.is_calibrated { calibration.unit_name.clone() } else { "px".to_string() },
            is_calibrated: calibration.is_calibrated,
            mean_intensity: None,
            min_intensity: None,
            max_intensity: None,
            std_dev_intensity: None,
        }
    }
}
