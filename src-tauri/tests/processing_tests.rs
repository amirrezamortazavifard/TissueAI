use tissueai_lib::image_processing::{DistanceTransform, Filters, Watershed};

#[test]
fn test_distance_transform_on_square() {
    let width = 20;
    let height = 20;
    let mut mask = vec![false; width * height];

    // 10x10 square in center: x from 5..15, y from 5..15
    for y in 5..15 {
        for x in 5..15 {
            mask[y * width + x] = true;
        }
    }

    let edt = DistanceTransform::compute_edt(&mask, width, height);
    println!("edt at (5,5): {}", edt[5 * width + 5]);
    println!("edt at (9,9): {}", edt[9 * width + 9]);

    // Border of square should have distance >= 1.0
    assert!(edt[5 * width + 5] >= 1.0);

    // Center of square (x=9, y=9 or 10,10) should have distance ~5.0
    let center_dist = edt[9 * width + 9];
    assert!(center_dist >= 4.0 && center_dist <= 5.5);

    // Outside pixels should have distance 0.0
    assert_eq!(edt[0], 0.0);
}

#[test]
fn test_watershed_splits_two_touching_nuclei() {
    // 40x20 image containing two touching nuclei
    // Left nucleus centered at (10, 10), radius 7
    // Right nucleus centered at (25, 10), radius 7
    // Distance between centers is 15 < 14+x (they touch and merge into an isthmus)
    let width = 40;
    let height = 20;
    let mut mask = vec![false; width * height];

    for y in 0..height {
        for x in 0..width {
            let dx1 = (x as isize) - 10;
            let dy1 = (y as isize) - 10;
            let in_nuc1 = dx1 * dx1 + dy1 * dy1 <= 49;

            let dx2 = (x as isize) - 25;
            let dy2 = (y as isize) - 10;
            let in_nuc2 = dx2 * dx2 + dy2 * dy2 <= 49;

            if in_nuc1 || in_nuc2 {
                mask[y * width + x] = true;
            }
        }
    }

    let edt = DistanceTransform::compute_edt(&mask, width, height);

    // Execute watershed segmentation with min_seed_distance = 4.0
    let (labels, cell_count) = Watershed::segment(&mask, &edt, width, height, 4.0);

    // Watershed MUST detect and separate the 2 touching cells!
    assert_eq!(cell_count, 2, "Expected watershed to separate 2 touching nuclei");

    // Center of nucleus 1 should have label 1 or 2
    let lbl1 = labels[10 * width + 10];
    let lbl2 = labels[10 * width + 25];
    assert!(lbl1 > 0);
    assert!(lbl2 > 0);
    assert_ne!(lbl1, lbl2, "The two nuclei centers must have different cell labels!");
}

#[test]
fn test_gaussian_blur_and_median_noise_removal() {
    let width = 10;
    let height = 10;
    let mut img = vec![100u8; width * height];

    // Add a single salt-and-pepper noise spike at (5, 5)
    img[5 * width + 5] = 255;

    // Median filter with radius 1
    let filtered = Filters::median_filter(&img, width, height, 1, 1);

    // Noise spike should be eliminated and restored to background 100
    assert_eq!(filtered[5 * width + 5], 100);

    // Gaussian blur
    let blurred = Filters::gaussian_blur(&img, width, height, 1, 1.0);
    assert!(blurred[5 * width + 5] < 200, "Spike should be diffused");
}

