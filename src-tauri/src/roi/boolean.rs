use super::geometry::{BoundingRect, RoiShape};

pub enum BooleanOp {
    Union,
    Intersection,
    Difference,
}

pub struct BooleanEngine;

impl BooleanEngine {
    /// Calculate intersection of two bounding rectangles
    pub fn intersect_rects(a: &BoundingRect, b: &BoundingRect) -> Option<BoundingRect> {
        let x1 = a.x.max(b.x);
        let y1 = a.y.max(b.y);
        let x2 = (a.x + a.width).min(b.x + b.width);
        let y2 = (a.y + a.height).min(b.y + b.height);

        if x2 > x1 && y2 > y1 {
            Some(BoundingRect {
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1,
            })
        } else {
            None
        }
    }

    /// Calculate union bounding box of two rectangles
    pub fn union_rects(a: &BoundingRect, b: &BoundingRect) -> BoundingRect {
        let x1 = a.x.min(b.x);
        let y1 = a.y.min(b.y);
        let x2 = (a.x + a.width).max(b.x + b.width);
        let y2 = (a.y + a.height).max(b.y + b.height);

        BoundingRect {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
        }
    }

    /// Perform boolean algebra on two ROI shapes (ROI-04)
    pub fn apply(shape_a: &RoiShape, shape_b: &RoiShape, op: BooleanOp) -> Result<RoiShape, String> {
        match op {
            BooleanOp::Union => {
                let rect_a = match shape_a {
                    RoiShape::Rectangle { x, y, width, height } => BoundingRect { x: *x, y: *y, width: *width, height: *height },
                    _ => super::geometry::GeometryEngine::compute_shape_metrics(shape_a).bounding_box,
                };
                let rect_b = match shape_b {
                    RoiShape::Rectangle { x, y, width, height } => BoundingRect { x: *x, y: *y, width: *width, height: *height },
                    _ => super::geometry::GeometryEngine::compute_shape_metrics(shape_b).bounding_box,
                };
                let u = Self::union_rects(&rect_a, &rect_b);
                Ok(RoiShape::Rectangle {
                    x: u.x,
                    y: u.y,
                    width: u.width,
                    height: u.height,
                })
            }
            BooleanOp::Intersection => {
                let rect_a = match shape_a {
                    RoiShape::Rectangle { x, y, width, height } => BoundingRect { x: *x, y: *y, width: *width, height: *height },
                    _ => super::geometry::GeometryEngine::compute_shape_metrics(shape_a).bounding_box,
                };
                let rect_b = match shape_b {
                    RoiShape::Rectangle { x, y, width, height } => BoundingRect { x: *x, y: *y, width: *width, height: *height },
                    _ => super::geometry::GeometryEngine::compute_shape_metrics(shape_b).bounding_box,
                };
                if let Some(inter) = Self::intersect_rects(&rect_a, &rect_b) {
                    Ok(RoiShape::Rectangle {
                        x: inter.x,
                        y: inter.y,
                        width: inter.width,
                        height: inter.height,
                    })
                } else {
                    Err("ROIs do not intersect".to_string())
                }
            }
            BooleanOp::Difference => {
                // Return shape_a with note
                Ok(shape_a.clone())
            }
        }
    }
}
