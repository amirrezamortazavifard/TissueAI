pub mod recorder;
pub mod report;

pub use recorder::{WorkflowManager, WorkflowPipeline, WorkflowStep};
pub use report::{PathologyReportInput, ResearchReportGenerator};
