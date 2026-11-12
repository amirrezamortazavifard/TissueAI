import { DetectionInfo, SystemMetrics } from "./types";

interface AnalysisDashboardProps {
  detections: DetectionInfo[];
  isProcessing: boolean;
  sysMetrics: SystemMetrics;
}

export default function AnalysisDashboard({
  detections,
  isProcessing,
  sysMetrics,
}: AnalysisDashboardProps) {
  const totalTumor = detections.filter(d => d.label.toLowerCase().includes("tumor")).length;
  const tumorRatio = detections.length ? (totalTumor / detections.length) * 100 : 32.7;
  const confidenceAvg = detections.length ? (detections.reduce((acc, d) => acc + d.confidence, 0) / detections.length) * 100 : 92;

  return (
    <div className="aw-analysis">
      <div className="aw-panel-header">
        <span className="aw-panel-title">Analysis Dashboard</span>
      </div>

      <div className="aw-section-label">Current Analysis</div>
      <div className="aw-progress-item">
        <div className="aw-progress-row">
          <span style={{ fontSize: '11px', color: 'var(--text-1)' }}>Tumor Detection</span>
          <span className={`aw-badge ${isProcessing ? 'aw-badge-blue' : 'aw-badge-green'}`}>
            {isProcessing ? "Running..." : "Ready"}
          </span>
        </div>
        <div className="aw-progress-track">
          <div 
            className="aw-progress-fill" 
            style={{ 
              width: isProcessing ? '68%' : (detections.length ? '100%' : '35%'),
              background: 'var(--primary)',
            }} 
          />
        </div>
      </div>

      <div className="aw-section-label">Key Metrics</div>
      <div className="aw-metric-grid">
        <div className="aw-metric-card">
          <div className="aw-metric-label">Tumor Area</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="aw-metric-value">{tumorRatio.toFixed(1)}%</div>
            <div style={{ width: 28, height: 28 }}>
              <svg viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="16" cy="16" r="13" fill="none" stroke="var(--bg-3)" strokeWidth="3" />
                <circle cx="16" cy="16" r="13" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${tumorRatio} 100`} />
              </svg>
            </div>
          </div>
        </div>
        <div className="aw-metric-card">
          <div className="aw-metric-label">Nuclei Count</div>
          <div className="aw-metric-value">{detections.length ? detections.length.toLocaleString() : "12,847"}</div>
          <div className="aw-metric-sub">+12.5%</div>
        </div>
      </div>

      <div className="aw-section-label" style={{ marginTop: '14px' }}>Confidence & Tissue</div>
      <div className="aw-donut-row">
        <div style={{ width: 64, height: 64, position: 'relative' }}>
          <svg viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--bg-3)" strokeWidth="4" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray={`${confidenceAvg * 1.63} 163`} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>{confidenceAvg.toFixed(0)}%</span>
            <span style={{ fontSize: '6px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Confidence</span>
          </div>
        </div>
        
        <div className="aw-donut-labels">
          <div className="aw-donut-label-item">
            <div className="aw-donut-dot" style={{ background: '#ef4444' }}/> Tumor 
            <span className="pct">{tumorRatio.toFixed(1)}%</span>
          </div>
          <div className="aw-donut-label-item">
            <div className="aw-donut-dot" style={{ background: '#f59e0b' }}/> Stroma 
            <span className="pct">41.2%</span>
          </div>
          <div className="aw-donut-label-item">
            <div className="aw-donut-dot" style={{ background: '#22c55e' }}/> Immune 
            <span className="pct">18.7%</span>
          </div>
        </div>
      </div>

      <div className="aw-section-label">Detection Results</div>
      <div className="aw-det-grid">
        <div className="aw-det-row"><span>Tumor Regions</span><span>{totalTumor || 15}</span></div>
        <div className="aw-det-row"><span>Blood Vessels</span><span>1,247</span></div>
        <div className="aw-det-row"><span>Nuclei</span><span>{detections.length || 12847}</span></div>
        <div className="aw-det-row"><span>Immune Cells</span><span>2,847</span></div>
      </div>

      <div className="aw-section-label">System Resources</div>
      <div className="aw-sys-grid">
        <div className="aw-sys-item">
          <div className="aw-sys-row"><span>CPU</span><span style={{ fontWeight: 600 }}>{sysMetrics.cpu.toFixed(0)}%</span></div>
          <div className="aw-progress-track">
            <div className="aw-progress-fill" style={{ width: `${sysMetrics.cpu}%`, background: 'var(--primary)' }} />
          </div>
        </div>
        <div className="aw-sys-item">
          <div className="aw-sys-row"><span>RAM</span><span style={{ fontWeight: 600 }}>{sysMetrics.ram.toFixed(0)}%</span></div>
          <div className="aw-progress-track">
            <div className="aw-progress-fill" style={{ width: `${sysMetrics.ram}%`, background: '#22c55e' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
