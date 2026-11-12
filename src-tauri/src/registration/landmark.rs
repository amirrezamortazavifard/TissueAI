use crate::registration::transform::AffineTransform;
use crate::roi::geometry::Point2D;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LandmarkPair {
    pub source: Point2D,
    pub target: Point2D,
}

pub struct LandmarkEstimator;

impl LandmarkEstimator {
    /// Solves optimal 2D affine transformation from at least 3 landmark pairs using Least Squares (options.md REG-03, REG-04)
    pub fn estimate_affine(pairs: &[LandmarkPair]) -> Result<AffineTransform, String> {
        if pairs.len() < 3 {
            return Err("At least 3 landmark pairs are required for affine transformation".to_string());
        }

        // We solve: (A^T * A) * [a, c, tx]^T = A^T * X'
        // and       (A^T * A) * [b, d, ty]^T = A^T * Y'
        let mut at_a = [[0.0f64; 3]; 3];
        let mut at_x = [0.0f64; 3];
        let mut at_y = [0.0f64; 3];

        for p in pairs {
            let x = p.source.x;
            let y = p.source.y;
            let xp = p.target.x;
            let yp = p.target.y;

            // Row in A is [x, y, 1]
            at_a[0][0] += x * x;
            at_a[0][1] += x * y;
            at_a[0][2] += x;

            at_a[1][0] += y * x;
            at_a[1][1] += y * y;
            at_a[1][2] += y;

            at_a[2][0] += x;
            at_a[2][1] += y;
            at_a[2][2] += 1.0;

            at_x[0] += x * xp;
            at_x[1] += y * xp;
            at_x[2] += xp;

            at_y[0] += x * yp;
            at_y[1] += y * yp;
            at_y[2] += yp;
        }

        let inv_at_a = invert_3x3(&at_a).ok_or_else(|| {
            "Degenerate collinear landmarks; cannot invert normal equations matrix".to_string()
        })?;

        let a = inv_at_a[0][0] * at_x[0] + inv_at_a[0][1] * at_x[1] + inv_at_a[0][2] * at_x[2];
        let c = inv_at_a[1][0] * at_x[0] + inv_at_a[1][1] * at_x[1] + inv_at_a[1][2] * at_x[2];
        let tx = inv_at_a[2][0] * at_x[0] + inv_at_a[2][1] * at_x[1] + inv_at_a[2][2] * at_x[2];

        let b = inv_at_a[0][0] * at_y[0] + inv_at_a[0][1] * at_y[1] + inv_at_a[0][2] * at_y[2];
        let d = inv_at_a[1][0] * at_y[0] + inv_at_a[1][1] * at_y[1] + inv_at_a[1][2] * at_y[2];
        let ty = inv_at_a[2][0] * at_y[0] + inv_at_a[2][1] * at_y[1] + inv_at_a[2][2] * at_y[2];

        Ok(AffineTransform {
            a,
            b,
            c,
            d,
            tx,
            ty,
        })
    }
}

fn invert_3x3(m: &[[f64; 3]; 3]) -> Option<[[f64; 3]; 3]> {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if det.abs() < 1e-12 {
        return None;
    }

    let inv_det = 1.0 / det;
    Some([
        [
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * inv_det,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * inv_det,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * inv_det,
        ],
        [
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * inv_det,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * inv_det,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * inv_det,
        ],
        [
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * inv_det,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * inv_det,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * inv_det,
        ],
    ])
}

