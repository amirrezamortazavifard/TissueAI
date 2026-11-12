use tissueai_lib::roi::{
    BooleanEngine, BooleanOp, BoundingRect, GeometryEngine, Point2D, RoiItem, RoiManager,
    RoiShape,
};
use tissueai_lib::scientific_models::scientific_image::SpatialCalibration;

#[test]
fn test_polygon_shoelace_area_and_perimeter() {
    // Right triangle: (0,0), (10,0), (0,10) -> Area should be 50.0
    let points = vec![
        Point2D { x: 0.0, y: 0.0 },
        Point2D { x: 10.0, y: 0.0 },
        Point2D { x: 0.0, y: 10.0 },
    ];

    let area = GeometryEngine::polygon_area(&points);
    assert!((area - 50.0).abs() < 1e-6);

    let perim = GeometryEngine::polygon_perimeter(&points);
    // 10 + 10 + sqrt(200) = 20 + 14.1421356 = 34.1421356
    let expected_perim = 20.0 + (200.0f64).sqrt();
    assert!((perim - expected_perim).abs() < 1e-5);

    let centroid = GeometryEngine::polygon_centroid(&points);
    assert!((centroid.x - (10.0 / 3.0)).abs() < 1e-5);
    assert!((centroid.y - (10.0 / 3.0)).abs() < 1e-5);
}

#[test]
fn test_shape_metrics_and_feret_diameter() {
    // 100x100 Square
    let shape = RoiShape::Rectangle {
        x: 0.0,
        y: 0.0,
        width: 100.0,
        height: 100.0,
    };

    let metrics = GeometryEngine::compute_shape_metrics(&shape);
    assert_eq!(metrics.area_px, 10000.0);
    assert_eq!(metrics.perimeter_px, 400.0);

    // Circularity of square: 4 * pi * 10000 / (400^2) = pi / 4 ≈ 0.785398
    assert!((metrics.circularity - (std::f64::consts::PI / 4.0)).abs() < 1e-4);

    // Diagonal is Feret Max: sqrt(100^2 + 100^2) = 141.421356
    assert!((metrics.feret_max_px - (20000.0f64).sqrt()).abs() < 1e-4);
    assert_eq!(metrics.feret_min_px, 100.0);
}

#[test]
fn test_boolean_rectangle_operations() {
    let rect_a = BoundingRect {
        x: 0.0,
        y: 0.0,
        width: 10.0,
        height: 10.0,
    };
    let rect_b = BoundingRect {
        x: 5.0,
        y: 5.0,
        width: 10.0,
        height: 10.0,
    };

    // Intersection
    let inter = BooleanEngine::intersect_rects(&rect_a, &rect_b).unwrap();
    assert_eq!(inter.x, 5.0);
    assert_eq!(inter.y, 5.0);
    assert_eq!(inter.width, 5.0);
    assert_eq!(inter.height, 5.0);

    // Union
    let u = BooleanEngine::union_rects(&rect_a, &rect_b);
    assert_eq!(u.x, 0.0);
    assert_eq!(u.y, 0.0);
    assert_eq!(u.width, 15.0);
    assert_eq!(u.height, 15.0);
}

#[test]
fn test_roi_manager_measurements_and_geojson() {
    let manager = RoiManager::new();
    let cal = SpatialCalibration::new_microns(0.25); // 0.25 µm/px

    let item = RoiItem {
        id: "roi-test-1".to_string(),
        name: "Tumor Island".to_string(),
        shape: RoiShape::Rectangle {
            x: 100.0,
            y: 200.0,
            width: 400.0,
            height: 400.0,
        },
        color: "#FF1744".to_string(),
        group_name: "Tumor Regions".to_string(),
        slide_id: Some("slide-42".to_string()),
        is_visible: true,
        measurements: None,
    };

    let added = manager.add(item, Some(&cal));
    assert!(added.measurements.is_some());
    let m = added.measurements.unwrap();

    // 400x400 px = 160,000 px^2
    // With 0.25 µm/px: physical area = 160,000 * 0.0625 = 10,000 µm^2
    assert_eq!(m.area_px, 160000.0);
    assert!((m.area_physical - 10000.0).abs() < 1e-4);
    assert_eq!(m.unit_name, "µm");

    // Export GeoJSON
    let geojson = manager.export_geojson(Some("slide-42")).unwrap();
    assert!(geojson.contains("FeatureCollection"));
    assert!(geojson.contains("Tumor Island"));
    assert!(geojson.contains("Polygon"));
}

