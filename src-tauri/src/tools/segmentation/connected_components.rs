use std::collections::VecDeque;

use super::data_models::ThresholdResultItem;

/// Component analysis result for a single connected component.
#[derive(Debug, Clone)]
pub struct ComponentInfo {
    pub label: usize,
    pub area: usize,
    pub perimeter: f64,
    pub circularity: f64,
    pub centroid_x: f64,
    pub centroid_y: f64,
    pub bounding_x: i32,
    pub bounding_y: i32,
    pub bounding_width: i32,
    pub bounding_height: i32,
    pub pixel_positions: Vec<(usize, usize)>,
}

/// BFS flood-fill connected components labeling with 4-connectivity.
/// Returns (labeled_mask, component_count, components).
pub fn find_connected_components(
    binary_mask: &[Vec<bool>],
    width: usize,
    height: usize,
    min_object_size: usize,
) -> (Vec<Vec<i32>>, usize, Vec<ComponentInfo>) {
    let mut labeled = vec![vec![0i32; width]; height];
    let mut components = Vec::new();
    let mut current_label = 0;

    let directions: [(i32, i32); 4] = [(0, 1), (0, -1), (1, 0), (-1, 0)];

    for y in 0..height {
        for x in 0..width {
            if binary_mask[y][x] && labeled[y][x] == 0 {
                current_label += 1;
                let mut queue = VecDeque::new();
                let mut pixels = Vec::new();
                queue.push_back((x, y));
                labeled[y][x] = current_label as i32;

                while let Some((cx, cy)) = queue.pop_front() {
                    pixels.push((cx, cy));

                    for &(dx, dy) in &directions {
                        let nx = cx as i32 + dx;
                        let ny = cy as i32 + dy;
                        if nx >= 0
                            && nx < width as i32
                            && ny >= 0
                            && ny < height as i32
                        {
                            let ux = nx as usize;
                            let uy = ny as usize;
                            if binary_mask[uy][ux] && labeled[uy][ux] == 0 {
                                labeled[uy][ux] = current_label as i32;
                                queue.push_back((ux, uy));
                            }
                        }
                    }
                }

                if pixels.len() >= min_object_size {
                    let info = analyze_component(current_label, &pixels, width, height);
                    components.push(info);
                } else {
                    // Remove label for small components
                    for &(px, py) in &pixels {
                        labeled[py][px] = 0;
                    }
                    current_label -= 1;
                }
            }
        }
    }

    (labeled, components.len(), components)
}

/// Analyze a single connected component: area, perimeter, circularity, centroid, bounding box.
fn analyze_component(
    label: usize,
    pixels: &[(usize, usize)],
    width: usize,
    height: usize,
) -> ComponentInfo {
    let area = pixels.len();

    // Create a temporary set for fast lookup
    let mut pixel_set = vec![vec![false; width]; height];
    for &(x, y) in pixels {
        pixel_set[y][x] = true;
    }

    // Calculate perimeter: count boundary pixels
    let mut perimeter = 0.0;
    let directions: [(i32, i32); 4] = [(0, 1), (0, -1), (1, 0), (-1, 0)];
    for &(x, y) in pixels {
        let mut is_boundary = false;
        for &(dx, dy) in &directions {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            if nx < 0 || nx >= width as i32 || ny < 0 || ny >= height as i32 || !pixel_set[ny as usize][nx as usize]
            {
                is_boundary = true;
                break;
            }
        }
        if is_boundary {
            perimeter += 1.0;
        }
    }

    // Circularity = 4 * pi * area / perimeter^2
    let circularity = if perimeter > 0.0 {
        4.0 * std::f64::consts::PI * area as f64 / (perimeter * perimeter)
    } else {
        0.0
    };

    // Centroid
    let mut sum_x: f64 = 0.0;
    let mut sum_y: f64 = 0.0;
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0usize;
    let mut max_y = 0usize;

    for &(x, y) in pixels {
        sum_x += x as f64;
        sum_y += y as f64;
        if x < min_x { min_x = x; }
        if y < min_y { min_y = y; }
        if x > max_x { max_x = x; }
        if y > max_y { max_y = y; }
    }

    let centroid_x = sum_x / area as f64;
    let centroid_y = sum_y / area as f64;

    ComponentInfo {
        label,
        area,
        perimeter,
        circularity,
        centroid_x,
        centroid_y,
        bounding_x: min_x as i32,
        bounding_y: min_y as i32,
        bounding_width: (max_x as i32 - min_x as i32) + 1,
        bounding_height: (max_y as i32 - min_y as i32) + 1,
        pixel_positions: pixels.to_vec(),
    }
}

/// Convert ComponentInfo to ThresholdResultItem with real-world area conversion.
pub fn components_to_results(
    components: &[ComponentInfo],
    pixels_per_unit: f64,
    unit_name: &str,
) -> Vec<ThresholdResultItem> {
    components
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let real_area = c.area as f64 / (pixels_per_unit * pixels_per_unit);
            ThresholdResultItem {
                display_index: i + 1,
                label: c.label,
                area: c.area as f64,
                perimeter: c.perimeter,
                circularity: c.circularity,
                centroid_x: c.centroid_x,
                centroid_y: c.centroid_y,
                bounding_x: c.bounding_x,
                bounding_y: c.bounding_y,
                bounding_width: c.bounding_width,
                bounding_height: c.bounding_height,
                calculated_area_with_unit: format!("{:.2} {}", real_area, unit_name),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_component() {
        let mask = vec![
            vec![false, false, false],
            vec![false, true, false],
            vec![false, false, false],
        ];
        let (labeled, count, components) = find_connected_components(&mask, 3, 3, 1);
        assert_eq!(count, 1);
        assert_eq!(components[0].area, 1);
        assert_eq!(labeled[1][1], 1);
    }

    #[test]
    fn test_two_components() {
        let mask = vec![
            vec![true, false, true],
            vec![false, false, false],
            vec![true, false, true],
        ];
        let (_, count, _) = find_connected_components(&mask, 3, 3, 1);
        assert_eq!(count, 4);
    }

    #[test]
    fn test_min_size_filter() {
        let mask = vec![
            vec![true, false, false],
            vec![false, false, false],
            vec![false, false, true],
        ];
        let (_, count, _) = find_connected_components(&mask, 3, 3, 2);
        assert_eq!(count, 0, "Components below min size should be filtered");
    }
}
