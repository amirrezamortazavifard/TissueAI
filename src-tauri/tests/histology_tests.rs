use tissueai_lib::histology::{HistologyAnalysis, StainVector};
use tissueai_lib::scientific_models::SpatialCalibration;

#[test]
fn test_tissue_mask_detection() {
    let width = 10;
    let height = 10;
    // Top half bright glass (250, 250, 250), bottom half tissue (120, 80, 160)
    let mut rgb = Vec::with_capacity(width * height * 3);
    for y in 0..height {
        for _ in 0..width {
            if y < 5 {
                rgb.extend_from_slice(&[250, 250, 250]);
            } else {
                rgb.extend_from_slice(&[120, 80, 160]);
            }
        }
    }

    let mask = HistologyAnalysis::detect_tissue_mask(&rgb, width, height, 230);
    // First 50 pixels are background (false), remaining 50 are tissue (true)
    for i in 0..50 {
        assert!(!mask[i], "Pixel {} should be background glass", i);
    }
    for i in 50..100 {
        assert!(mask[i], "Pixel {} should be detected as tissue", i);
    }
}

#[test]
fn test_he_color_deconvolution() {
    let stains = vec![
        StainVector { name: "Hematoxylin".to_string(), r: 0.65, g: 0.70, b: 0.29 },
        StainVector { name: "Eosin".to_string(), r: 0.07, g: 0.99, b: 0.11 },
    ];

    let width = 2;
    let height = 2;
    // Pure hematoxylin-ish tinted pixels
    let rgb = vec![
        100, 110, 180,
        100, 110, 180,
        100, 110, 180,
        100, 110, 180,
    ];

    let results = HistologyAnalysis::deconvolve(&rgb, width, height, &stains).expect("Deconvolution failed");
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].stain_name, "Hematoxylin");
    assert_eq!(results[1].stain_name, "Eosin");
    // Hematoxylin optical density should be positive and non-zero
    assert!(results[0].optical_density[0] > 0.0);
}

#[test]
fn test_morphometry_feature_extraction() {
    let width = 10;
    let height = 10;
    let mut labels = vec![0u32; width * height];
    let mut intensity = vec![50u8; width * height];

    // Label 1: a 4x4 square from (2,2) to (5,5)
    for y in 2..6 {
        for x in 2..6 {
            labels[y * width + x] = 1;
            intensity[y * width + x] = 180;
        }
    }

    let calib = SpatialCalibration::new_microns(0.5);
    let features = HistologyAnalysis::extract_morphometry(&labels, &intensity, width, height, Some(&calib));

    assert_eq!(features.len(), 1);
    let f = &features[0];
    assert_eq!(f.cell_id, 1);
    assert_eq!(f.area_px, 16.0);
    // Area in microns: 16 * (0.5 * 0.5) = 4.0 µm²
    assert_eq!(f.area_microns, Some(4.0));
    assert_eq!(f.mean_intensity, 180.0);
    assert!(f.circularity > 0.0);
}

