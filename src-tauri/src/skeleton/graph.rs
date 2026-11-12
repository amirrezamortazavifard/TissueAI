use crate::roi::geometry::Point2D;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PixelType {
    Background = 0,
    Endpoint = 1,
    Slab = 2,
    Junction = 3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkeletonBranch {
    pub id: usize,
    pub start: Point2D,
    pub end: Point2D,
    pub length_pixels: f64,
    pub length_um: f64,
    pub pixel_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkeletonStats {
    pub endpoint_count: usize,
    pub junction_count: usize,
    pub slab_count: usize,
    pub branch_count: usize,
    pub total_length_pixels: f64,
    pub total_length_um: f64,
    pub branches: Vec<SkeletonBranch>,
}

pub struct SkeletonAnalyzer;

impl SkeletonAnalyzer {
    /// Classifies each skeleton pixel as Endpoint, Slab, or Junction (options.md SKEL-02)
    pub fn classify_pixels(skeleton: &[bool], width: usize, height: usize) -> Vec<PixelType> {
        let mut types = vec![PixelType::Background; width * height];
        if width < 3 || height < 3 {
            return types;
        }

        for y in 1..(height - 1) {
            for x in 1..(width - 1) {
                let idx = y * width + x;
                if !skeleton[idx] {
                    continue;
                }

                let mut n = 0;
                for dy in [-1isize, 0, 1] {
                    for dx in [-1isize, 0, 1] {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = (x as isize + dx) as usize;
                        let ny = (y as isize + dy) as usize;
                        if skeleton[ny * width + nx] {
                            n += 1;
                        }
                    }
                }

                types[idx] = match n {
                    0 | 1 => PixelType::Endpoint,
                    2 => PixelType::Slab,
                    _ => PixelType::Junction,
                };
            }
        }

        types
    }

    /// Traces and measures skeleton branches, endpoints, and junctions (options.md SKEL-03, SKEL-04)
    pub fn analyze(
        skeleton: &[bool],
        width: usize,
        height: usize,
        pixel_size_um: f64,
    ) -> SkeletonStats {
        let types = Self::classify_pixels(skeleton, width, height);
        let px_scale = if pixel_size_um > 0.0 { pixel_size_um } else { 1.0 };

        let mut endpoint_count = 0;
        let mut junction_count = 0;
        let mut slab_count = 0;

        for &t in &types {
            match t {
                PixelType::Endpoint => endpoint_count += 1,
                PixelType::Junction => junction_count += 1,
                PixelType::Slab => slab_count += 1,
                PixelType::Background => {}
            }
        }

        // Trace branches from each endpoint or junction
        let mut visited = vec![false; width * height];
        let mut branches = Vec::new();
        let mut total_len_px = 0.0f64;

        for y in 1..(height - 1) {
            for x in 1..(width - 1) {
                let start_idx = y * width + x;
                if types[start_idx] != PixelType::Endpoint && types[start_idx] != PixelType::Junction {
                    continue;
                }

                // Look for unvisited neighbors
                for dy in [-1isize, 0, 1] {
                    for dx in [-1isize, 0, 1] {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = (x as isize + dx) as usize;
                        let ny = (y as isize + dy) as usize;
                        let next_idx = ny * width + nx;

                        if skeleton[next_idx] && !visited[next_idx] {
                            // Trace branch
                            let mut curr_x = nx;
                            let mut curr_y = ny;
                            let mut branch_len = ((dx * dx + dy * dy) as f64).sqrt();
                            let mut count = 1;
                            visited[start_idx] = true;
                            visited[next_idx] = true;

                            while types[curr_y * width + curr_x] == PixelType::Slab {
                                // Find next step along slab
                                let mut found_next = false;
                                for sdy in [-1isize, 0, 1] {
                                    for sdx in [-1isize, 0, 1] {
                                        if sdx == 0 && sdy == 0 {
                                            continue;
                                        }
                                        let snx = (curr_x as isize + sdx) as usize;
                                        let sny = (curr_y as isize + sdy) as usize;
                                        let s_idx = sny * width + snx;
                                        if skeleton[s_idx] && !visited[s_idx] {
                                            visited[s_idx] = true;
                                            branch_len += ((sdx * sdx + sdy * sdy) as f64).sqrt();
                                            count += 1;
                                            curr_x = snx;
                                            curr_y = sny;
                                            found_next = true;
                                            break;
                                        }
                                    }
                                    if found_next {
                                        break;
                                    }
                                }
                                if !found_next {
                                    break;
                                }
                            }

                            visited[curr_y * width + curr_x] = true;

                            total_len_px += branch_len;
                            branches.push(SkeletonBranch {
                                id: branches.len() + 1,
                                start: Point2D {
                                    x: x as f64,
                                    y: y as f64,
                                },
                                end: Point2D {
                                    x: curr_x as f64,
                                    y: curr_y as f64,
                                },
                                length_pixels: branch_len,
                                length_um: branch_len * px_scale,
                                pixel_count: count,
                            });
                        }
                    }
                }
            }
        }

        SkeletonStats {
            endpoint_count,
            junction_count,
            slab_count,
            branch_count: branches.len(),
            total_length_pixels: total_len_px,
            total_length_um: total_len_px * px_scale,
            branches,
        }
    }
}
