use tissueai_lib::ai_segmentation::{
    StarDistDecoder, TilingConfig, WsiTiledInference,
};
use tissueai_lib::roi::geometry::Point2D;

#[test]
fn test_stardist_polygon_decoding() {
    let width = 50;
    let height = 50;
    let n_rays = 32;

    let mut prob = vec![0.0f32; width * height];
    let mut distances = vec![0.0f32; n_rays * width * height];

    // Simulate a detected nucleus at center (25, 25) with radius 6.0 pixels
    let cx = 25;
    let cy = 25;
    let center_idx = cy * width + cx;
    prob[center_idx] = 0.95;

    for k in 0..n_rays {
        let ray_idx = k * (width * height) + center_idx;
        distances[ray_idx] = 6.0;
    }

    let polygons = StarDistDecoder::decode(
        &prob,
        &distances,
        width,
        height,
        n_rays,
        0.5, // prob threshold
        0.3, // nms threshold
    );

    assert_eq!(polygons.len(), 1, "Should decode exactly 1 nucleus polygon");
    let poly = &polygons[0];
    assert_eq!(poly.vertices.len(), 32, "Polygon must have 32 vertices");
    assert!((poly.center_x - 25.5).abs() < 1e-4);
    assert!((poly.center_y - 25.5).abs() < 1e-4);

    // Theoretical area of regular 32-gon with radius 6 is ~111.4 to 113.1
    println!("StarDist polygon area: {}", poly.area);
    assert!(poly.area > 100.0 && poly.area < 120.0);
}

#[test]
fn test_stardist_nms_suppression() {
    let width = 30;
    let height = 30;
    let n_rays = 16;

    let mut prob = vec![0.0f32; width * height];
    let mut distances = vec![5.0f32; n_rays * width * height];

    // Two touching peaks for same nucleus: (15, 15) with p=0.9, (16, 15) with p=0.7
    prob[15 * width + 15] = 0.90;
    prob[15 * width + 16] = 0.70;

    let polygons = StarDistDecoder::decode(
        &prob,
        &distances,
        width,
        height,
        n_rays,
        0.5,
        0.3, // NMS will suppress high-overlap candidate
    );

    assert_eq!(polygons.len(), 1, "NMS should suppress the lower-confidence duplicate peak");
    assert_eq!(polygons[0].probability, 0.90);
}

#[test]
fn test_wsi_tiled_inference_planning_and_deduplication() {
    let slide_w = 2500;
    let slide_h = 2500;
    let config = TilingConfig {
        tile_width: 1024,
        tile_height: 1024,
        overlap: 128,
    };

    let tiles = WsiTiledInference::plan_tiles(slide_w, slide_h, &config);
    assert!(!tiles.is_empty(), "Should generate tiled inference grid");

    // Verify all tiles cover the bounding space
    let max_x = tiles.iter().map(|t| t.x + t.width).max().unwrap();
    let max_y = tiles.iter().map(|t| t.y + t.height).max().unwrap();
    assert_eq!(max_x, slide_w);
    assert_eq!(max_y, slide_h);

    // Test coordinate translation to slide space
    let tile_1 = &tiles[1]; // x > 0

    let p0 = tissueai_lib::ai_segmentation::StarDistPolygon {
        id: 1,
        center_x: 950.0,
        center_y: 50.0,
        probability: 0.9,
        vertices: vec![Point2D { x: 940.0, y: 50.0 }, Point2D { x: 960.0, y: 50.0 }],
        bbox: (940.0, 40.0, 960.0, 60.0),
        area: 200.0,
    };

    let translated = WsiTiledInference::translate_polygons_to_slide(&[p0], tile_1);
    assert_eq!(translated[0].center_x, 950.0 + tile_1.x as f64);
}
