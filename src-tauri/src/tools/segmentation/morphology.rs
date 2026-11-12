/// Binary morphology operations using a 3x3 cross (diamond) structuring element.

/// Erosion: a pixel remains true only if it AND all 4 direct neighbors are true.
/// Removes single-pixel noise and shrinks objects.
pub fn erode(mask: &[Vec<bool>], width: usize, height: usize) -> Vec<Vec<bool>> {
    let mut result = vec![vec![false; width]; height];

    for y in 0..height {
        for x in 0..width {
            let mut all_true = true;

            // Check center
            if !mask[y][x] {
                all_true = false;
            }

            // Check 4 neighbors (cross pattern)
            if all_true {
                if y > 0 && !mask[y - 1][x] {
                    all_true = false;
                }
            }
            if all_true {
                if y + 1 < height && !mask[y + 1][x] {
                    all_true = false;
                }
            }
            if all_true {
                if x > 0 && !mask[y][x - 1] {
                    all_true = false;
                }
            }
            if all_true {
                if x + 1 < width && !mask[y][x + 1] {
                    all_true = false;
                }
            }

            result[y][x] = all_true;
        }
    }

    result
}

/// Dilation: if a pixel is true, it sets itself and all 4 neighbors to true.
/// Fills small holes and expands objects.
pub fn dilate(mask: &[Vec<bool>], width: usize, height: usize) -> Vec<Vec<bool>> {
    let mut result = vec![vec![false; width]; height];

    for y in 0..height {
        for x in 0..width {
            if mask[y][x] {
                result[y][x] = true;
                if y > 0 {
                    result[y - 1][x] = true;
                }
                if y + 1 < height {
                    result[y + 1][x] = true;
                }
                if x > 0 {
                    result[y][x - 1] = true;
                }
                if x + 1 < width {
                    result[y][x + 1] = true;
                }
            }
        }
    }

    result
}

/// Opening = Erode then Dilate. Removes noise while preserving shape.
pub fn open(mask: &[Vec<bool>], width: usize, height: usize) -> Vec<Vec<bool>> {
    let eroded = erode(mask, width, height);
    dilate(&eroded, width, height)
}

/// Closing = Dilate then Erode. Fills small holes while preserving shape.
pub fn close(mask: &[Vec<bool>], width: usize, height: usize) -> Vec<Vec<bool>> {
    let dilated = dilate(mask, width, height);
    erode(&dilated, width, height)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_mask(rows: &[&[bool]]) -> Vec<Vec<bool>> {
        rows.iter().map(|r| r.to_vec()).collect()
    }

    #[test]
    fn test_erode_single_pixel() {
        let mask = make_mask(&[
            &[false, false, false],
            &[false, true, false],
            &[false, false, false],
        ]);
        let result = erode(&mask, 3, 3);
        assert!(!result[1][1], "Isolated pixel should be eroded");
    }

    #[test]
    fn test_erode_preserves_block() {
        let mask = make_mask(&[
            &[true, true, true],
            &[true, true, true],
            &[true, true, true],
        ]);
        let result = erode(&mask, 3, 3);
        assert!(result[1][1], "Center of block should survive erosion");
    }

    #[test]
    fn test_dilate_expands() {
        let mask = make_mask(&[
            &[false, false, false],
            &[false, true, false],
            &[false, false, false],
        ]);
        let result = dilate(&mask, 3, 3);
        assert!(result[1][0]);
        assert!(result[1][1]);
        assert!(result[1][2]);
        assert!(result[0][1]);
        assert!(result[2][1]);
    }

    #[test]
    fn test_open_removes_noise() {
        let mask = make_mask(&[
            &[false, false, false, false, false],
            &[false, true, false, true, false],
            &[false, false, false, false, false],
        ]);
        let result = open(&mask, 5, 3);
        for row in &result {
            for &pixel in row {
                assert!(!pixel, "Isolated pixels should be removed by opening");
            }
        }
    }
}
