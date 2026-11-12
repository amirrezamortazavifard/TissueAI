use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BoundingRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum RoiShape {
    Rectangle {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    },
    Ellipse {
        center_x: f64,
        center_y: f64,
        radius_x: f64,
        radius_y: f64,
    },
    Polygon {
        points: Vec<Point2D>,
    },
    Polyline {
        points: Vec<Point2D>,
    },
    Point {
        point: Point2D,
    },
    MultiPoint {
        points: Vec<Point2D>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ShapeMetrics {
    pub area_px: f64,
    pub perimeter_px: f64,
    pub centroid: Point2D,
    pub bounding_box: BoundingRect,
    pub circularity: f64,
    pub aspect_ratio: f64,
    pub feret_max_px: f64,
    pub feret_min_px: f64,
}

impl Default for Point2D {
    fn default() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
}

impl Default for BoundingRect {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
        }
    }
}

pub struct GeometryEngine;

impl GeometryEngine {
    /// Calculate polygon area using Shoelace formula (ROI-02)
    pub fn polygon_area(points: &[Point2D]) -> f64 {
        let n = points.len();
        if n < 3 {
            return 0.0;
        }

        let mut sum = 0.0;
        for i in 0..n {
            let j = (i + 1) % n;
            sum += points[i].x * points[j].y;
            sum -= points[j].x * points[i].y;
        }

        sum.abs() / 2.0
    }

    /// Calculate perimeter of a closed polygon
    pub fn polygon_perimeter(points: &[Point2D]) -> f64 {
        let n = points.len();
        if n < 2 {
            return 0.0;
        }

        let mut perimeter = 0.0;
        for i in 0..n {
            let j = (i + 1) % n;
            let dx = points[j].x - points[i].x;
            let dy = points[j].y - points[i].y;
            perimeter += (dx * dx + dy * dy).sqrt();
        }

        perimeter
    }

    /// Calculate centroid of a polygon
    pub fn polygon_centroid(points: &[Point2D]) -> Point2D {
        let n = points.len();
        if n == 0 {
            return Point2D::default();
        }
        if n < 3 {
            let sum_x: f64 = points.iter().map(|p| p.x).sum();
            let sum_y: f64 = points.iter().map(|p| p.y).sum();
            return Point2D {
                x: sum_x / (n as f64),
                y: sum_y / (n as f64),
            };
        }

        let area_signed = {
            let mut a = 0.0;
            for i in 0..n {
                let j = (i + 1) % n;
                a += points[i].x * points[j].y - points[j].x * points[i].y;
            }
            a / 2.0
        };

        if area_signed.abs() < 1e-9 {
            let sum_x: f64 = points.iter().map(|p| p.x).sum();
            let sum_y: f64 = points.iter().map(|p| p.y).sum();
            return Point2D {
                x: sum_x / (n as f64),
                y: sum_y / (n as f64),
            };
        }

        let mut cx = 0.0;
        let mut cy = 0.0;

        for i in 0..n {
            let j = (i + 1) % n;
            let cross = points[i].x * points[j].y - points[j].x * points[i].y;
            cx += (points[i].x + points[j].x) * cross;
            cy += (points[i].y + points[j].y) * cross;
        }

        Point2D {
            x: cx / (6.0 * area_signed),
            y: cy / (6.0 * area_signed),
        }
    }

    /// Bounding rectangle for points
    pub fn bounding_box(points: &[Point2D]) -> BoundingRect {
        if points.is_empty() {
            return BoundingRect::default();
        }

        let mut min_x = f64::MAX;
        let mut max_x = f64::MIN;
        let mut min_y = f64::MAX;
        let mut max_y = f64::MIN;

        for p in points {
            if p.x < min_x {
                min_x = p.x;
            }
            if p.x > max_x {
                max_x = p.x;
            }
            if p.y < min_y {
                min_y = p.y;
            }
            if p.y > max_y {
                max_y = p.y;
            }
        }

        BoundingRect {
            x: min_x,
            y: min_y,
            width: (max_x - min_x).max(0.0),
            height: (max_y - min_y).max(0.0),
        }
    }

    /// Compute Maximum Feret Diameter (caliper max distance between two vertices)
    pub fn max_feret_diameter(points: &[Point2D]) -> f64 {
        let n = points.len();
        if n < 2 {
            return 0.0;
        }

        let mut max_dist_sq = 0.0;
        for i in 0..n {
            for j in (i + 1)..n {
                let dx = points[i].x - points[j].x;
                let dy = points[i].y - points[j].y;
                let dist_sq = dx * dx + dy * dy;
                if dist_sq > max_dist_sq {
                    max_dist_sq = dist_sq;
                }
            }
        }

        max_dist_sq.sqrt()
    }

    /// Full shape analysis for any RoiShape
    pub fn compute_shape_metrics(shape: &RoiShape) -> ShapeMetrics {
        match shape {
            RoiShape::Rectangle {
                x,
                y,
                width,
                height,
            } => {
                let area = width * height;
                let perimeter = 2.0 * (width + height);
                let circularity = if perimeter > 0.0 {
                    (4.0 * std::f64::consts::PI * area) / (perimeter * perimeter)
                } else {
                    0.0
                };
                let aspect_ratio = if *height > 0.0 { width / height } else { 1.0 };
                let feret_max = (width * width + height * height).sqrt();
                let feret_min = width.min(*height);

                ShapeMetrics {
                    area_px: area,
                    perimeter_px: perimeter,
                    centroid: Point2D {
                        x: x + width / 2.0,
                        y: y + height / 2.0,
                    },
                    bounding_box: BoundingRect {
                        x: *x,
                        y: *y,
                        width: *width,
                        height: *height,
                    },
                    circularity,
                    aspect_ratio,
                    feret_max_px: feret_max,
                    feret_min_px: feret_min,
                }
            }
            RoiShape::Ellipse {
                center_x,
                center_y,
                radius_x,
                radius_y,
            } => {
                let area = std::f64::consts::PI * radius_x * radius_y;
                // Ramanujan approximation for ellipse perimeter
                let a = radius_x.max(*radius_y);
                let b = radius_x.min(*radius_y);
                let h = ((a - b) * (a - b)) / ((a + b) * (a + b));
                let perimeter = std::f64::consts::PI * (a + b) * (1.0 + (3.0 * h) / (10.0 + (4.0 - 3.0 * h).sqrt()));

                let circularity = if perimeter > 0.0 {
                    (4.0 * std::f64::consts::PI * area) / (perimeter * perimeter)
                } else {
                    1.0
                };
                let aspect_ratio = if *radius_y > 0.0 {
                    radius_x / radius_y
                } else {
                    1.0
                };

                ShapeMetrics {
                    area_px: area,
                    perimeter_px: perimeter,
                    centroid: Point2D {
                        x: *center_x,
                        y: *center_y,
                    },
                    bounding_box: BoundingRect {
                        x: center_x - radius_x,
                        y: center_y - radius_y,
                        width: radius_x * 2.0,
                        height: radius_y * 2.0,
                    },
                    circularity,
                    aspect_ratio,
                    feret_max_px: a * 2.0,
                    feret_min_px: b * 2.0,
                }
            }
            RoiShape::Polygon { points } => {
                let area = Self::polygon_area(points);
                let perimeter = Self::polygon_perimeter(points);
                let centroid = Self::polygon_centroid(points);
                let bounding_box = Self::bounding_box(points);
                let feret_max = Self::max_feret_diameter(points);
                let feret_min = bounding_box.width.min(bounding_box.height);

                let circularity = if perimeter > 0.0 {
                    (4.0 * std::f64::consts::PI * area) / (perimeter * perimeter)
                } else {
                    0.0
                };
                let aspect_ratio = if bounding_box.height > 0.0 {
                    bounding_box.width / bounding_box.height
                } else {
                    1.0
                };

                ShapeMetrics {
                    area_px: area,
                    perimeter_px: perimeter,
                    centroid,
                    bounding_box,
                    circularity,
                    aspect_ratio,
                    feret_max_px: feret_max,
                    feret_min_px: feret_min,
                }
            }
            RoiShape::Polyline { points } => {
                let perimeter = Self::polygon_perimeter(points);
                let centroid = Self::polygon_centroid(points);
                let bounding_box = Self::bounding_box(points);
                ShapeMetrics {
                    area_px: 0.0,
                    perimeter_px: perimeter,
                    centroid,
                    bounding_box,
                    circularity: 0.0,
                    aspect_ratio: 1.0,
                    feret_max_px: Self::max_feret_diameter(points),
                    feret_min_px: 0.0,
                }
            }
            RoiShape::Point { point } => ShapeMetrics {
                area_px: 0.0,
                perimeter_px: 0.0,
                centroid: point.clone(),
                bounding_box: BoundingRect {
                    x: point.x,
                    y: point.y,
                    width: 0.0,
                    height: 0.0,
                },
                circularity: 1.0,
                aspect_ratio: 1.0,
                feret_max_px: 0.0,
                feret_min_px: 0.0,
            },
            RoiShape::MultiPoint { points } => {
                let centroid = Self::polygon_centroid(points);
                let bounding_box = Self::bounding_box(points);
                ShapeMetrics {
                    area_px: 0.0,
                    perimeter_px: 0.0,
                    centroid,
                    bounding_box,
                    circularity: 0.0,
                    aspect_ratio: 1.0,
                    feret_max_px: Self::max_feret_diameter(points),
                    feret_min_px: 0.0,
                }
            }
        }
    }
}
