use tissueai_lib::skeleton::{SkeletonAnalyzer, ZhangSuenThinning};

#[test]
fn test_zhang_suen_thinning_on_thick_rectangle() {
    let width = 30;
    let height = 30;
    let mut mask = vec![false; width * height];

    // Horizontal bar of thickness 6 from x=5..25, y=12..18
    for y in 12..18 {
        for x in 5..25 {
            mask[y * width + x] = true;
        }
    }

    let initial_fg = mask.iter().filter(|&&v| v).count();
    assert_eq!(initial_fg, 6 * 20); // 120 pixels

    let skeleton = ZhangSuenThinning::thin(&mask, width, height);
    let skel_fg = skeleton.iter().filter(|&&v| v).count();

    println!("Skeleton foreground pixels: {}", skel_fg);
    // Skeleton should be thinned down significantly from 120 to a line
    assert!(skel_fg < 35, "Skeleton must thin 120 foreground pixels down to a single-pixel line");
    assert!(skel_fg >= 12, "Skeleton line should retain topological continuity");
}

#[test]
fn test_skeleton_graph_endpoints_and_branch_tracing() {
    let width = 25;
    let height = 25;
    let mut skeleton = vec![false; width * height];

    // Single horizontal 1-pixel line from x=5 to x=20 at y=12 (16 pixels)
    for x in 5..=20 {
        skeleton[12 * width + x] = true;
    }

    let stats = SkeletonAnalyzer::analyze(&skeleton, width, height, 0.5); // 0.5 um/px

    assert_eq!(stats.endpoint_count, 2, "Straight line must have exactly 2 endpoints");
    assert_eq!(stats.junction_count, 0, "Straight line must have 0 junctions");
    assert_eq!(stats.slab_count, 14, "Straight line has 14 intermediate slab pixels");
    assert_eq!(stats.branch_count, 1, "Must trace exactly 1 branch");

    let branch = &stats.branches[0];
    assert!((branch.length_pixels - 15.0).abs() < 1.0);
    assert!((branch.length_um - 7.5).abs() < 0.5);
}

#[test]
fn test_skeleton_branching_y_junction() {
    let width = 30;
    let height = 30;
    let mut skeleton = vec![false; width * height];

    // Center junction at (15, 15)
    skeleton[15 * width + 15] = true;

    // Branch 1: Upwards from (15, 15) to (15, 5)
    for y in 5..15 {
        skeleton[y * width + 15] = true;
    }

    // Branch 2: Down-Left from (15, 15) to (5, 25)
    for i in 1..10 {
        skeleton[(15 + i) * width + (15 - i)] = true;
    }

    // Branch 3: Down-Right from (15, 15) to (25, 25)
    for i in 1..10 {
        skeleton[(15 + i) * width + (15 + i)] = true;
    }

    let stats = SkeletonAnalyzer::analyze(&skeleton, width, height, 1.0);

    assert!(stats.junction_count >= 1, "Y-shape must have at least 1 junction point");
    assert_eq!(stats.endpoint_count, 3, "Y-shape must have 3 distinct branch endpoints");
    assert!(stats.branch_count >= 3, "Must detect at least 3 branches radiating from junction");
}
