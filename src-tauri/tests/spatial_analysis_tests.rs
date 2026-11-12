use tissueai_lib::spatial_analysis::{
    ColocalizationEngine, DirectionalityEngine,
};

#[test]
fn test_colocalization_perfect_correlation() {
    let mut ch1 = vec![0u8; 100];
    let mut ch2 = vec![0u8; 100];

    // Signals with baseline offset so all pixels are above background threshold
    for i in 0..100 {
        ch1[i] = (100 + (i as u8)) as u8;
        ch2[i] = (100 + (i as u8)) as u8;
    }

    let result = ColocalizationEngine::analyze(&ch1, &ch2);
    assert!((result.pearson_r - 1.0).abs() < 1e-4);
    assert!(result.manders_m1 > 0.95);
    assert!(result.manders_m2 > 0.95);

    let pdm = ColocalizationEngine::compute_pdm_map(&ch1, &ch2);
    assert_eq!(pdm.len(), 100);
}

#[test]
fn test_colocalization_segregated_channels() {
    let mut ch1 = vec![0u8; 100];
    let mut ch2 = vec![0u8; 100];

    // Left half bright for ch1, right half bright for ch2
    for i in 0..50 {
        ch1[i] = 200;
        ch2[i] = 0;
    }
    for i in 50..100 {
        ch1[i] = 0;
        ch2[i] = 200;
    }

    let result = ColocalizationEngine::analyze(&ch1, &ch2);
    assert!(result.pearson_r < -0.8, "Should have strong negative correlation");
}

#[test]
fn test_directionality_horizontal_stripes() {
    let width = 30;
    let height = 30;
    let mut image = vec![0u8; width * height];

    // Create horizontal bright bars: y % 4 == 0 or 1
    for y in 0..height {
        for x in 0..width {
            if y % 4 < 2 {
                image[y * width + x] = 220;
            } else {
                image[y * width + x] = 20;
            }
        }
    }

    let result = DirectionalityEngine::analyze(&image, width, height, 36)
        .expect("Directionality analysis must succeed");

    println!("Dominant direction: {} deg", result.dominant_direction_deg);
    println!("Anisotropy index: {}", result.anisotropy_index);

    // Horizontal bars have horizontal fiber direction (approx 0 deg or 180 deg)
    assert!(
        result.dominant_direction_deg < 25.0 || result.dominant_direction_deg > 155.0,
        "Dominant direction should be horizontal (near 0 or 180 deg)"
    );
    assert!(result.anisotropy_index > 0.5, "Should exhibit high anisotropy for parallel stripes");
}
