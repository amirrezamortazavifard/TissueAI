use tissueai_lib::registration::{
    AffineTransform, LandmarkEstimator, LandmarkPair, RegistrationEvaluator,
};
use tissueai_lib::roi::geometry::Point2D;

#[test]
fn test_affine_transform_composition_and_inversion() {
    let t = AffineTransform::translation(10.0, -20.0);
    let r = AffineTransform::rotation(std::f64::consts::FRAC_PI_4); // 45 deg
    let s = AffineTransform::scale(2.0, 2.0);

    let composite = s.compose(&r).compose(&t);
    let inv = composite.inverse().expect("Composite transform must be invertible");

    let p = Point2D { x: 50.0, y: 75.0 };
    let transformed = composite.transform_point(&p);
    let recovered = inv.transform_point(&transformed);

    assert!((recovered.x - p.x).abs() < 1e-4);
    assert!((recovered.y - p.y).abs() < 1e-4);
}

#[test]
fn test_landmark_affine_least_squares_estimation() {
    // True ground-truth transform: scale 1.5, translate (10.0, 20.0)
    let ground_truth = AffineTransform {
        a: 1.5,
        b: 0.0,
        c: 0.0,
        d: 1.5,
        tx: 10.0,
        ty: 20.0,
    };

    let p1 = Point2D { x: 0.0, y: 0.0 };
    let p2 = Point2D { x: 100.0, y: 0.0 };
    let p3 = Point2D { x: 0.0, y: 100.0 };
    let p4 = Point2D { x: 100.0, y: 100.0 };

    let pairs = vec![
        LandmarkPair {
            source: p1.clone(),
            target: ground_truth.transform_point(&p1),
        },
        LandmarkPair {
            source: p2.clone(),
            target: ground_truth.transform_point(&p2),
        },
        LandmarkPair {
            source: p3.clone(),
            target: ground_truth.transform_point(&p3),
        },
        LandmarkPair {
            source: p4.clone(),
            target: ground_truth.transform_point(&p4),
        },
    ];

    let estimated = LandmarkEstimator::estimate_affine(&pairs).expect("Estimation must succeed");

    assert!((estimated.a - 1.5).abs() < 1e-4);
    assert!((estimated.d - 1.5).abs() < 1e-4);
    assert!((estimated.tx - 10.0).abs() < 1e-4);
    assert!((estimated.ty - 20.0).abs() < 1e-4);
}

#[test]
fn test_resampling_and_registration_metrics() {
    let width = 20;
    let height = 20;
    let mut img_a = vec![0u8; width * height];
    for y in 5..15 {
        for x in 5..15 {
            img_a[y * width + x] = 200;
        }
    }

    // Perfect alignment with itself
    let metrics_self = RegistrationEvaluator::evaluate(&img_a, &img_a);
    assert_eq!(metrics_self.mse, 0.0);
    assert!((metrics_self.ncc - 1.0).abs() < 1e-4);

    // Apply translation of 2 pixels in X and 2 pixels in Y
    let transform = AffineTransform::translation(2.0, 2.0);
    let img_b = transform.resample_bilinear(&img_a, width, height, width, height);

    let metrics_shifted = RegistrationEvaluator::evaluate(&img_a, &img_b);
    assert!(metrics_shifted.mse > 0.0);

    let diff = RegistrationEvaluator::difference_image(&img_a, &img_b);
    assert_eq!(diff.len(), width * height);
}

