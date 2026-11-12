/// Exact Euclidean Distance Transform (EDT) for binary masks (options.md SEG-05)
/// For each foreground pixel (true), computes Euclidean distance to the nearest background pixel (false).
pub struct DistanceTransform;

impl DistanceTransform {
    /// 2D Euclidean Distance Transform using Meijster/Saito separable 1D parabolic method
    /// Time complexity: O(width * height) linear time.
    pub fn compute_edt(mask: &[bool], width: usize, height: usize) -> Vec<f32> {
        let mut dist = vec![0.0f32; width * height];
        if width == 0 || height == 0 {
            return dist;
        }

        let inf = (width * width + height * height) as f32;

        // Phase 1: 1D transform along columns
        let mut g = vec![inf; width * height];
        for x in 0..width {
            // Forward pass
            let mut d = if !mask[x] { 0.0 } else { inf };
            g[x] = d;
            for y in 1..height {
                d = if !mask[y * width + x] {
                    0.0
                } else {
                    d + 1.0
                };
                g[y * width + x] = d;
            }

            // Backward pass
            d = if !mask[(height - 1) * width + x] {
                0.0
            } else {
                g[(height - 1) * width + x]
            };
            for y in (0..(height - 1)).rev() {
                d = if !mask[y * width + x] {
                    0.0
                } else {
                    (d + 1.0).min(g[y * width + x])
                };
                g[y * width + x] = d;
            }
        }

        // Phase 2: 1D transform along rows using parabolic upper envelopes
        let mut s = vec![0usize; width];
        let mut t = vec![0usize; width];

        for y in 0..height {
            let row_offset = y * width;
            let mut q = 0usize;
            s[0] = 0;
            t[0] = 0;

            for u in 1..width {
                while q > 0 {
                    let s_q = s[q];
                    let t_q = t[q];
                    let g_sq = g[row_offset + s_q];
                    let g_u = g[row_offset + u];
                    let sep = ((u * u + (g_u * g_u).round() as usize)
                        .saturating_sub(s_q * s_q + (g_sq * g_sq).round() as usize))
                        / (2 * (u - s_q));
                    if t_q < sep {
                        break;
                    }
                    q -= 1;
                }

                let s_q = s[q];
                let g_sq = g[row_offset + s_q];
                let g_u = g[row_offset + u];
                let sep = ((u * u + (g_u * g_u).round() as usize)
                    .saturating_sub(s_q * s_q + (g_sq * g_sq).round() as usize))
                    / (2 * (u - s_q));

                if sep < width {
                    q += 1;
                    s[q] = u;
                    t[q] = sep;
                }
            }

            for u in (0..width).rev() {
                while q > 0 && t[q] > u {
                    q -= 1;
                }
                let s_q = s[q];
                let dx = (u as f32) - (s_q as f32);
                let dy = g[row_offset + s_q];
                dist[row_offset + u] = (dx * dx + dy * dy).sqrt();
            }
        }

        for i in 0..dist.len() {
            if !mask[i] {
                dist[i] = 0.0;
            }
        }

        dist
    }
}

