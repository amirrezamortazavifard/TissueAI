use crate::roi::geometry::Point2D;
use serde::{Deserialize, Serialize};

/// 2D Affine Transformation Matrix (options.md REG-02, REG-03)
/// Represented as:
/// [ a  c  tx ]
/// [ b  d  ty ]
/// [ 0  0  1  ]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AffineTransform {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub tx: f64,
    pub ty: f64,
}

impl Default for AffineTransform {
    fn default() -> Self {
        Self::identity()
    }
}

impl AffineTransform {
    pub fn identity() -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: 0.0,
            ty: 0.0,
        }
    }

    pub fn translation(tx: f64, ty: f64) -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx,
            ty,
        }
    }

    pub fn rotation(angle_rad: f64) -> Self {
        let cos_a = angle_rad.cos();
        let sin_a = angle_rad.sin();
        Self {
            a: cos_a,
            b: sin_a,
            c: -sin_a,
            d: cos_a,
            tx: 0.0,
            ty: 0.0,
        }
    }

    pub fn scale(sx: f64, sy: f64) -> Self {
        Self {
            a: sx,
            b: 0.0,
            c: 0.0,
            d: sy,
            tx: 0.0,
            ty: 0.0,
        }
    }

    /// Multiply this transform with another (this * other)
    pub fn compose(&self, other: &Self) -> Self {
        Self {
            a: self.a * other.a + self.c * other.b,
            b: self.b * other.a + self.d * other.b,
            c: self.a * other.c + self.c * other.d,
            d: self.b * other.c + self.d * other.d,
            tx: self.a * other.tx + self.c * other.ty + self.tx,
            ty: self.b * other.tx + self.d * other.ty + self.ty,
        }
    }

    /// Inverts the affine transformation matrix
    pub fn inverse(&self) -> Option<Self> {
        let det = self.a * self.d - self.b * self.c;
        if det.abs() < 1e-12 {
            return None;
        }

        let inv_det = 1.0 / det;
        let inv_a = self.d * inv_det;
        let inv_b = -self.b * inv_det;
        let inv_c = -self.c * inv_det;
        let inv_d = self.a * inv_det;
        let inv_tx = (self.c * self.ty - self.d * self.tx) * inv_det;
        let inv_ty = (self.b * self.tx - self.a * self.ty) * inv_det;

        Some(Self {
            a: inv_a,
            b: inv_b,
            c: inv_c,
            d: inv_d,
            tx: inv_tx,
            ty: inv_ty,
        })
    }

    /// Transforms a single 2D point: (x', y') = M * (x, y)
    pub fn transform_point(&self, p: &Point2D) -> Point2D {
        Point2D {
            x: self.a * p.x + self.c * p.y + self.tx,
            y: self.b * p.x + self.d * p.y + self.ty,
        }
    }

    /// Resamples an image buffer using inverse mapping with bilinear interpolation (options.md REG-05)
    pub fn resample_bilinear(
        &self,
        src: &[u8],
        src_w: usize,
        src_h: usize,
        dst_w: usize,
        dst_h: usize,
    ) -> Vec<u8> {
        let mut dst = vec![0u8; dst_w * dst_h];
        let inv = match self.inverse() {
            Some(m) => m,
            None => return dst,
        };

        for dy in 0..dst_h {
            for dx in 0..dst_w {
                let target_p = Point2D {
                    x: dx as f64,
                    y: dy as f64,
                };
                let src_p = inv.transform_point(&target_p);

                let sx = src_p.x;
                let sy = src_p.y;

                if sx >= 0.0 && sx < (src_w - 1) as f64 && sy >= 0.0 && sy < (src_h - 1) as f64 {
                    let x0 = sx.floor() as usize;
                    let y0 = sy.floor() as usize;
                    let x1 = x0 + 1;
                    let y1 = y0 + 1;

                    let fx = (sx - x0 as f64) as f32;
                    let fy = (sy - y0 as f64) as f32;

                    let p00 = src[y0 * src_w + x0] as f32;
                    let p10 = src[y0 * src_w + x1] as f32;
                    let p01 = src[y1 * src_w + x0] as f32;
                    let p11 = src[y1 * src_w + x1] as f32;

                    let val = (1.0 - fx) * (1.0 - fy) * p00
                        + fx * (1.0 - fy) * p10
                        + (1.0 - fx) * fy * p01
                        + fx * fy * p11;

                    dst[dy * dst_w + dx] = val.round().clamp(0.0, 255.0) as u8;
                }
            }
        }

        dst
    }
}

