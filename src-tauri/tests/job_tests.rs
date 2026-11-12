use tissueai_lib::jobs::{JobManager, JobStatus};

#[test]
fn test_job_lifecycle_and_cancellation() {
    let manager = JobManager::new();
    let (job_id, cancel_token) = manager.create_job("wsi_batch_segmentation", 100);

    let initial = manager.get_job(&job_id).expect("Job should exist");
    assert_eq!(initial.status, JobStatus::Queued);
    assert_eq!(initial.progress.percentage, 0.0);

    // Start job
    manager.start_job(&job_id);
    let running = manager.get_job(&job_id).expect("Job should exist");
    assert_eq!(running.status, JobStatus::Running);

    // Progress update
    manager.update_progress(&job_id, 45, "Processing tile 45/100");
    let in_progress = manager.get_job(&job_id).expect("Job should exist");
    assert_eq!(in_progress.progress.current_step, 45);
    assert_eq!(in_progress.progress.percentage, 45.0);

    // Cancel job
    manager.cancel_job(&job_id).expect("Cancel should succeed");
    assert!(cancel_token.load(std::sync::atomic::Ordering::Relaxed));
    let cancelled = manager.get_job(&job_id).expect("Job should exist");
    assert_eq!(cancelled.status, JobStatus::Cancelled);
    assert!(cancelled.finished_at.is_some());
}

#[test]
fn test_job_completion_with_results() {
    let manager = JobManager::new();
    let (job_id, _) = manager.create_job("stain_deconvolution", 50);

    manager.start_job(&job_id);
    manager.update_progress(&job_id, 50, "Synthesizing stain channels");

    let summary = serde_json::json!({
        "channels": ["Hematoxylin", "DAB"],
        "cells_segmented": 1420
    });
    manager.finish_job(&job_id, Some(summary));

    let completed = manager.get_job(&job_id).expect("Job should exist");
    assert_eq!(completed.status, JobStatus::Completed);
    assert_eq!(completed.progress.percentage, 100.0);
    assert!(completed.result_summary.is_some());
}

