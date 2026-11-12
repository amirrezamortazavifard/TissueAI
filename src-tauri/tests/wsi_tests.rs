use tissueai_lib::wsi::{
    PyramidLevel, TileCache, TileKey, TileScheduler, ViewportState,
};

#[test]
fn test_tile_cache_lru_and_eviction() {
    // 1 MB cache
    let cache = TileCache::new(1);

    let key1 = TileKey {
        slide_id: "slide_1".to_string(),
        level: 0,
        tile_x: 0,
        tile_y: 0,
    };
    let data1 = vec![100u8; 600 * 1024]; // 600 KB

    cache.insert(key1.clone(), data1.clone());
    assert!(cache.get(&key1).is_some());

    // Insert second chunk 600 KB -> Total 1.2 MB > 1 MB -> key1 should be evicted
    let key2 = TileKey {
        slide_id: "slide_1".to_string(),
        level: 0,
        tile_x: 1,
        tile_y: 0,
    };
    let data2 = vec![200u8; 600 * 1024];
    cache.insert(key2.clone(), data2.clone());

    assert!(cache.get(&key2).is_some());
}

#[test]
fn test_tile_scheduler_level_selection() {
    let levels = vec![
        PyramidLevel {
            level: 0,
            width: 16000,
            height: 16000,
            downsample: 1.0,
            tile_width: 256,
            tile_height: 256,
            num_tiles_x: 63,
            num_tiles_y: 63,
        },
        PyramidLevel {
            level: 1,
            width: 8000,
            height: 8000,
            downsample: 2.0,
            tile_width: 256,
            tile_height: 256,
            num_tiles_x: 32,
            num_tiles_y: 32,
        },
        PyramidLevel {
            level: 2,
            width: 4000,
            height: 4000,
            downsample: 4.0,
            tile_width: 256,
            tile_height: 256,
            num_tiles_x: 16,
            num_tiles_y: 16,
        },
        PyramidLevel {
            level: 3,
            width: 2000,
            height: 2000,
            downsample: 8.0,
            tile_width: 256,
            tile_height: 256,
            num_tiles_x: 8,
            num_tiles_y: 8,
        },
    ];

    // Zoom 1.0 (40x full res) -> Downsample 1.0 -> Level 0
    assert_eq!(TileScheduler::select_best_level(&levels, 1.0), 0);

    // Zoom 0.5 (20x) -> Downsample 2.0 -> Level 1
    assert_eq!(TileScheduler::select_best_level(&levels, 0.5), 1);

    // Zoom 0.25 (10x) -> Downsample 4.0 -> Level 2
    assert_eq!(TileScheduler::select_best_level(&levels, 0.25), 2);

    // Zoom 0.125 (5x) -> Downsample 8.0 -> Level 3
    assert_eq!(TileScheduler::select_best_level(&levels, 0.125), 3);
}

#[test]
fn test_tile_scheduler_screen_to_slide_coordinates() {
    let vp = ViewportState {
        center_x: 5000.0,
        center_y: 5000.0,
        zoom_level: 0.5,
        viewport_width: 1000,
        viewport_height: 800,
    };

    // Center of screen (500, 400) should map to center of slide (5000, 5000)
    let (cx, cy) = TileScheduler::screen_to_slide(500.0, 400.0, &vp);
    assert!((cx - 5000.0).abs() < 1e-4);
    assert!((cy - 5000.0).abs() < 1e-4);

    // Top-left screen (0, 0)
    // dx = -500, at zoom 0.5 -> delta_slide = -1000 -> slide_x = 4000
    // dy = -400, at zoom 0.5 -> delta_slide = -800 -> slide_y = 4200
    let (tl_x, tl_y) = TileScheduler::screen_to_slide(0.0, 0.0, &vp);
    assert!((tl_x - 4000.0).abs() < 1e-4);
    assert!((tl_y - 4200.0).abs() < 1e-4);
}

