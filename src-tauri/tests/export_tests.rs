use tissueai_lib::export::Exporter;
use tissueai_lib::roi::manager::RoiItem;
use tissueai_lib::roi::geometry::RoiShape;
use tissueai_lib::roi::measurement::RoiMeasurements;

#[test]
fn test_ome_xml_and_csv_export() {
    let rois = vec![
        RoiItem {
            id: "roi_01".to_string(),
            name: "Nucleus Alpha".to_string(),
            shape: RoiShape::Rectangle { x: 10.0, y: 20.0, width: 30.0, height: 40.0 },
            color: "#00ff00".to_string(),
            group_name: "Nuclei".to_string(),
            slide_id: Some("slide_a".to_string()),
            parent_id: None,
            class_id: Some("c1".to_string()),
            class_name: Some("Tumor".to_string()),
            tags: vec![],
            is_locked: false,
            notes: None,
            is_visible: true,
            measurements: Some(RoiMeasurements {
                area_px: 1200.0,
                area_physical: 300.0,
                perimeter_px: 140.0,
                perimeter_physical: 35.0,
                circularity: 0.77,
                aspect_ratio: 1.33,
                feret_max_physical: 40.0,
                feret_min_physical: 30.0,
                centroid_x_physical: 25.0,
                centroid_y_physical: 40.0,
                unit_name: "µm".to_string(),
                is_calibrated: true,
                mean_intensity: None,
                min_intensity: None,
                max_intensity: None,
                std_dev_intensity: None,
            }),
        }
    ];

    let xml = Exporter::export_ome_xml(&rois);
    assert!(xml.contains("<?xml version=\"1.0\""));
    assert!(xml.contains("<ROI ID=\"ROI:roi_01\">"));
    assert!(xml.contains("<Rectangle X=\"10.00\" Y=\"20.00\" Width=\"30.00\" Height=\"40.00\""));

    let csv = Exporter::export_measurements_csv(&rois);
    assert!(csv.starts_with("id,name,class_name,area_px,area_physical,perimeter_px,perimeter_physical,circularity,unit"));
    assert!(csv.contains("\"roi_01\",\"Nucleus Alpha\",\"Tumor\",1200,300.0000,140,35.0000,0.7700,\"µm\""));
}


