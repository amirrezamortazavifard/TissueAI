use tissueai_lib::workflow::{
    PathologyReportInput, ResearchReportGenerator, WorkflowManager,
};

#[test]
fn test_workflow_step_recording_and_pipeline() {
    let manager = WorkflowManager::new();

    let step1 = manager.record_step(
        "proc_watershed_segmentation".to_string(),
        serde_json::json!({ "min_distance": 5 }),
        12.4,
        true,
    );

    let step2 = manager.record_step(
        "ai_stardist_decode".to_string(),
        serde_json::json!({ "n_rays": 32, "prob_threshold": 0.5 }),
        85.2,
        true,
    );

    assert_eq!(step1.command, "proc_watershed_segmentation");
    assert_eq!(step2.command, "ai_stardist_decode");

    let pipeline = manager.get_pipeline();
    assert_eq!(pipeline.steps.len(), 2);
    assert_eq!(pipeline.steps[0].command, "proc_watershed_segmentation");
    assert_eq!(pipeline.steps[1].command, "ai_stardist_decode");

    manager.clear();
    let empty_pipeline = manager.get_pipeline();
    assert_eq!(empty_pipeline.steps.len(), 0);
}

#[test]
fn test_research_report_generation() {
    let manager = WorkflowManager::new();
    manager.record_step(
        "wsi_open_slide".to_string(),
        serde_json::json!({ "slide_path": "sample.svs" }),
        5.1,
        true,
    );
    manager.record_step(
        "ai_stardist_decode".to_string(),
        serde_json::json!({ "model": "stardist-2d" }),
        120.0,
        true,
    );

    let pipeline = manager.get_pipeline();

    let input = PathologyReportInput {
        slide_name: "Breast_HER2_Biopsy_01.svs".to_string(),
        specimen_id: "SP-2026-998".to_string(),
        pixel_size_um: 0.252,
        total_nuclei_detected: 4520,
        mean_nuclear_area_um2: 48.6,
        mean_circularity: 0.84,
        positive_fraction: 0.325,
    };

    let report_md = ResearchReportGenerator::generate_markdown(&input, &pipeline);
    println!("{}", report_md);

    assert!(report_md.contains("TissueAI Quantitative Pathology & Morphometric Report"));
    assert!(report_md.contains("SP-2026-998"));
    assert!(report_md.contains("4520"));
    assert!(report_md.contains("48.6"));
    assert!(report_md.contains("32.5%"));
    assert!(report_md.contains("wsi_open_slide"));
    assert!(report_md.contains("ai_stardist_decode"));
}
