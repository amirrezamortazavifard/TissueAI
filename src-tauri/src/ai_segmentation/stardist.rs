use crate::roi::geometry::Point2D;
use serde::{Deserialize, Serialize};
use std::f32::consts::PI;

/// A star-convex polygon representation decoded from StarDist neural network output (options.md DLSEG-03, DLSEG-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StarDistPolygon {
    pub id: usize,
    pub center_x: f64,
    pub center_y: f64,
    pub probability: f32,
    pub vertices: Vec<Point2D>,
    pub bbox: (f64, f64, f64, f64), // min_x, min_y, max_x, max_y
    pub area: f64,
}

impl StarDistPolygon {
    /// Checks bounding-box intersection over union (IoU) for fast NMS
    pub fn bbox_iou(&self, other: &Self) -> f64 {
        let (x1_a, y1_a, x2_a, y2_a) = self.bbox;
        let (x1_b, y1_b, x2_b, y2_b) = other.bbox;

        let inter_x1 = x1_a.max(x1_b);
        let inter_y1 = y1_a.max(y1_b);
        let inter_x2 = x2_a.min(x2_b);
        let inter_y2 = y2_a.min(y2_b);

        if inter_x2 <= inter_x1 || inter_y2 <= inter_y1 {
            return 0.0;
        }

        let inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1);
        let area_a = (x2_a - x1_a) * (y2_a - y1_a);
        let area_b = (x2_b - x1_b) * (y2_b - y1_b);
        let union_area = area_a + area_b - inter_area;

        if union_area <= 1e-6 {
            0.0
        } else {
            inter_area / union_area
        }
    }
}

pub struct StarDistDecoder;

impl StarDistDecoder {
    /// Decodes star-convex polygons from pixel probabilities and radial distances
    /// - `prob`: Probability map of size [height * width]
    /// - `distances`: Flattened radial distance array of size [n_rays * height * width]
    /// - `n_rays`: Number of radial directions (standard StarDist 2D uses 32 rays)
    /// - `prob_threshold`: Minimum probability to consider a pixel as cell center (e.g. 0.4)
    /// - `nms_threshold`: Maximum allowed IoU during non-maximum suppression (e.g. 0.3)
    pub fn decode(
        prob: &[f32],
        distances: &[f32],
        width: usize,
        height: usize,
        n_rays: usize,
        prob_threshold: f32,
        nms_threshold: f32,
    ) -> Vec<StarDistPolygon> {
        if prob.len() < width * height || distances.len() < n_rays * width * height || n_rays < 4 {
            return Vec::new();
        }

        let mut candidates = Vec::new();
        let angle_step = 2.0 * (PI as f64) / (n_rays as f64);

        for y in 0..height {
            for x in 0..width {
                let pixel_idx = y * width + x;
                let p = prob[pixel_idx];
                if p < prob_threshold {
                    continue;
                }

                let cx = x as f64 + 0.5;
                let cy = y as f64 + 0.5;

                let mut vertices = Vec::with_capacity(n_rays);
                let mut min_x = cx;
                let mut max_x = cx;
                let mut min_y = cy;
                let mut max_y = cy;

                for k in 0..n_rays {
                    let ray_idx = k * (width * height) + pixel_idx;
                    let r = distances[ray_idx].max(0.1) as f64;
                    let theta = (k as f64) * angle_step;

                    // Standard StarDist angle convention: 0 is up (-y), clockwise
                    // vx = cx + r * sin(theta), vy = cy - r * cos(theta)
                    let vx = cx + r * theta.sin();
                    let vy = cy - r * theta.cos();

                    min_x = min_x.min(vx);
                    max_x = max_x.max(vx);
                    min_y = min_y.min(vy);
                    max_y = max_y.max(vy);

                    vertices.push(Point2D { x: vx, y: vy });
                }

                // Compute polygon area using Shoelace formula
                let mut area: f64 = 0.0;
                for i in 0..vertices.len() {
                    let j = (i + 1) % vertices.len();
                    area += vertices[i].x * vertices[j].y;
                    area -= vertices[j].x * vertices[i].y;
                }
                let area = (area.abs() * 0.5).max(1.0);

                candidates.push(StarDistPolygon {
                    id: 0,
                    center_x: cx,
                    center_y: cy,
                    probability: p,
                    vertices,
                    bbox: (min_x, min_y, max_x, max_y),
                    area,
                });
            }
        }

        // Sort candidates by probability descending
        candidates.sort_by(|a, b| {
            b.probability
                .partial_cmp(&a.probability)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Non-Maximum Suppression (NMS)
        let mut keep = Vec::new();
        let mut suppressed = vec![false; candidates.len()];

        for i in 0..candidates.len() {
            if suppressed[i] {
                continue;
            }

            let mut poly = candidates[i].clone();
            poly.id = keep.len() + 1;
            keep.push(poly);

            for j in (i + 1)..candidates.len() {
                if suppressed[j] {
                    continue;
                }

                let iou = candidates[i].bbox_iou(&candidates[j]);
                if iou > nms_threshold as f64 {
                    suppressed[j] = true;
                }
            }
        }

        keep
    }
}
