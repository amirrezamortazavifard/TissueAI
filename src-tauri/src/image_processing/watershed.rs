use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Copy, Clone, PartialEq)]
struct PixelPriority {
    priority: i64, // distance * 1000 for integer sorting
    x: usize,
    y: usize,
}

impl Eq for PixelPriority {}

impl Ord for PixelPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher distance = higher priority for flooding from nuclei center outwards
        self.priority.cmp(&other.priority)
    }
}

impl PartialOrd for PixelPriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct Watershed;

impl Watershed {
    /// Find local maxima in distance transform to act as nuclei markers/seeds
    pub fn find_local_maxima(
        dist: &[f32],
        width: usize,
        height: usize,
        min_distance_threshold: f32,
    ) -> Vec<(usize, usize)> {
        let mut seeds = Vec::new();
        if width < 3 || height < 3 {
            return seeds;
        }

        for y in 1..(height - 1) {
            for x in 1..(width - 1) {
                let val = dist[y * width + x];
                if val < min_distance_threshold {
                    continue;
                }

                // Check 8-neighborhood
                let mut is_max = true;
                for dy in [-1, 0, 1] {
                    for dx in [-1, 0, 1] {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = (x as isize + dx) as usize;
                        let ny = (y as isize + dy) as usize;
                        let n_val = dist[ny * width + nx];
                        if n_val > val {
                            is_max = false;
                            break;
                        }
                    }
                    if !is_max {
                        break;
                    }
                }

                if is_max {
                    seeds.push((x, y));
                }
            }
        }

        seeds
    }

    /// Marker-controlled watershed algorithm to split touching cell nuclei (SEG-06)
    pub fn segment(
        mask: &[bool],
        dist: &[f32],
        width: usize,
        height: usize,
        min_seed_distance: f32,
    ) -> (Vec<u32>, u32) {
        let mut labels = vec![0u32; width * height];
        if width == 0 || height == 0 {
            return (labels, 0);
        }

        let seeds = Self::find_local_maxima(dist, width, height, min_seed_distance);
        if seeds.is_empty() {
            // Fallback: entire connected component
            let mut label = 0u32;
            for i in 0..labels.len() {
                if mask[i] {
                    if label == 0 {
                        label = 1;
                    }
                    labels[i] = label;
                }
            }
            return (labels, label);
        }

        let mut queue = BinaryHeap::new();
        let mut current_label = 1u32;

        for (sx, sy) in seeds {
            let idx = sy * width + sx;
            if labels[idx] == 0 && mask[idx] {
                labels[idx] = current_label;
                queue.push(PixelPriority {
                    priority: (dist[idx] * 1000.0) as i64,
                    x: sx,
                    y: sy,
                });
                current_label += 1;
            }
        }

        let total_cells = current_label - 1;

        // Flooding simulation with priority queue
        let neighbors: [(isize, isize); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

        while let Some(PixelPriority { x, y, .. }) = queue.pop() {
            let current_lbl = labels[y * width + x];

            for (dx, dy) in neighbors {
                let nx = x as isize + dx;
                let ny = y as isize + dy;

                if nx >= 0 && nx < width as isize && ny >= 0 && ny < height as isize {
                    let unx = nx as usize;
                    let uny = ny as usize;
                    let n_idx = uny * width + unx;

                    if mask[n_idx] && labels[n_idx] == 0 {
                        labels[n_idx] = current_lbl;
                        queue.push(PixelPriority {
                            priority: (dist[n_idx] * 1000.0) as i64,
                            x: unx,
                            y: uny,
                        });
                    }
                }
            }
        }

        (labels, total_cells)
    }
}

