/// Zhang-Suen 2D Binary Skeletonization Thinning Algorithm (options.md SKEL-01)
pub struct ZhangSuenThinning;

impl ZhangSuenThinning {
    /// Reduces binary foreground shapes to 1-pixel-wide topological skeletons
    pub fn thin(mask: &[bool], width: usize, height: usize) -> Vec<bool> {
        let mut skeleton = mask.to_vec();
        if width < 3 || height < 3 {
            return skeleton;
        }

        let mut to_delete = Vec::new();
        let mut changed = true;

        while changed {
            changed = false;

            // Sub-iteration 1
            for y in 1..(height - 1) {
                for x in 1..(width - 1) {
                    let idx = y * width + x;
                    if !skeleton[idx] {
                        continue;
                    }

                    let p = get_8_neighbors(&skeleton, x, y, width);
                    let b = count_neighbors(&p);
                    let a = count_transitions(&p);

                    // Conditions for sub-iteration 1:
                    // 1. 2 <= B(P1) <= 6
                    // 2. A(P1) == 1
                    // 3. P2 * P4 * P6 == 0
                    // 4. P4 * P6 * P8 == 0
                    if (2..=6).contains(&b)
                        && a == 1
                        && (!p[0] || !p[2] || !p[4])
                        && (!p[2] || !p[4] || !p[6])
                    {
                        to_delete.push(idx);
                    }
                }
            }

            if !to_delete.is_empty() {
                changed = true;
                for &idx in &to_delete {
                    skeleton[idx] = false;
                }
                to_delete.clear();
            }

            // Sub-iteration 2
            for y in 1..(height - 1) {
                for x in 1..(width - 1) {
                    let idx = y * width + x;
                    if !skeleton[idx] {
                        continue;
                    }

                    let p = get_8_neighbors(&skeleton, x, y, width);
                    let b = count_neighbors(&p);
                    let a = count_transitions(&p);

                    // Conditions for sub-iteration 2:
                    // 1. 2 <= B(P1) <= 6
                    // 2. A(P1) == 1
                    // 3. P2 * P4 * P8 == 0
                    // 4. P2 * P6 * P8 == 0
                    if (2..=6).contains(&b)
                        && a == 1
                        && (!p[0] || !p[2] || !p[6])
                        && (!p[0] || !p[4] || !p[6])
                    {
                        to_delete.push(idx);
                    }
                }
            }

            if !to_delete.is_empty() {
                changed = true;
                for &idx in &to_delete {
                    skeleton[idx] = false;
                }
                to_delete.clear();
            }
        }

        skeleton
    }
}

// 8-neighborhood ordered clockwise starting from North (P2 to P9)
// P9 P2 P3
// P8 P1 P4
// P7 P6 P5
#[inline(always)]
fn get_8_neighbors(img: &[bool], x: usize, y: usize, width: usize) -> [bool; 8] {
    [
        img[(y - 1) * width + x],       // P2 (N)
        img[(y - 1) * width + (x + 1)], // P3 (NE)
        img[y * width + (x + 1)],       // P4 (E)
        img[(y + 1) * width + (x + 1)], // P5 (SE)
        img[(y + 1) * width + x],       // P6 (S)
        img[(y + 1) * width + (x - 1)], // P7 (SW)
        img[y * width + (x - 1)],       // P8 (W)
        img[(y - 1) * width + (x - 1)], // P9 (NW)
    ]
}

#[inline(always)]
fn count_neighbors(p: &[bool; 8]) -> usize {
    p.iter().filter(|&&v| v).count()
}

#[inline(always)]
fn count_transitions(p: &[bool; 8]) -> usize {
    let mut count = 0;
    for i in 0..8 {
        if !p[i] && p[(i + 1) % 8] {
            count += 1;
        }
    }
    count
}

