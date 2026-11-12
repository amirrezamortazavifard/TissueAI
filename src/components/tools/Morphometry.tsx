import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Network,
  Split,
  FileText,
  Upload,
  Play,
  AlertCircle,
  Copy,
  Sparkles,
} from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";
import { SkeletonStats } from "../../types/skeleton";
import { WatershedResult } from "../../types/image-processing";
import { WorkflowPipeline, PathologyReportInput } from "../../types/workflow";

type ActiveTab = "skeleton" | "watershed" | "workflow";

export default function Morphometry() {
  const notif = useNotification();
  const [activeTab, setActiveTab] = useState<ActiveTab>("skeleton");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tab 1: Skeleton State
  const [maskPath, setMaskPath] = useState<string | null>(null);
  const [maskPreview, setMaskPreview] = useState<string | null>(null);
  const [skeletonPreview, setSkeletonPreview] = useState<string | null>(null);
  const [skeletonStats, setSkeletonStats] = useState<SkeletonStats | null>(null);
  const [pixelSizeUm, setPixelSizeUm] = useState<number>(0.25);

  // Tab 2: Watershed State
  const [wsImagePath, setWsImagePath] = useState<string | null>(null);
  const [wsPreview, setWsPreview] = useState<string | null>(null);
  const [watershedResult, setWatershedResult] = useState<WatershedResult | null>(null);

  // Tab 3: Workflow & Report State
  const [pipelineStepsCount, setPipelineStepsCount] = useState<number>(0);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [slideName, setSlideName] = useState("Biopsy_Specimen_A1");
  const [specimenId, setSpecimenId] = useState("SPEC-2026-X99");
  const [totalNuclei, setTotalNuclei] = useState(1420);
  const [meanArea, setMeanArea] = useState(48.5);
  const [meanCircularity] = useState(0.86);
  const [posFraction] = useState(0.24);

  // Helper to load image bytes and preview
  const loadImageBytes = async (path: string): Promise<{ bytes: number[]; preview: string }> => {
    const raw = await invoke<number[]>("read_file_bytes", { path });
    const b64 = btoa(raw.map((b) => String.fromCharCode(b)).join(""));
    const preview = `data:image/png;base64,${b64}`;
    return { bytes: raw, preview };
  };

  // Run Skeletonization
  const handleRunSkeleton = async () => {
    if (!maskPath) {
      setError("Please select a binary mask image.");
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);
      const raw = await invoke<number[]>("read_file_bytes", { path: maskPath });

      const img = new Image();
      img.src = maskPreview || "";
      await new Promise<void>((res) => (img.onload = () => res()));

      const w = img.naturalWidth || 100;
      const h = img.naturalHeight || 100;

      // Convert grayscale/RGB bytes to boolean mask
      const boolMask: boolean[] = [];
      const step = raw.length >= w * h * 3 ? 3 : 1;
      for (let i = 0; i < w * h; i++) {
        const val = raw[i * step] || 0;
        boolMask.push(val > 128);
      }

      // Thin mask (Zhang-Suen)
      const thinned = await invoke<boolean[]>("skel_thin_mask", {
        params: { mask: boolMask, width: w, height: h },
      });

      // Analyze branch graph
      const stats = await invoke<SkeletonStats>("skel_analyze_graph", {
        params: {
          skeleton: thinned,
          width: w,
          height: h,
          pixel_size_um: pixelSizeUm,
        },
      });
      setSkeletonStats(stats);

      // Render thinned skeleton to preview canvas
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imgData = ctx.createImageData(w, h);
        for (let i = 0; i < thinned.length; i++) {
          const idx = i * 4;
          if (thinned[i]) {
            imgData.data[idx] = 91; // cyan/blue
            imgData.data[idx + 1] = 168;
            imgData.data[idx + 2] = 245;
            imgData.data[idx + 3] = 255;
          } else {
            imgData.data[idx] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setSkeletonPreview(canvas.toDataURL());
      }

      // Record step in workflow
      await invoke("workflow_record_step", {
        params: {
          command: "skel_analyze_graph",
          parameters: { width: w, height: h, pixel_size_um: pixelSizeUm },
          execution_ms: 12.5,
          success: true,
        },
      });

      notif.success("Skeletonization & graph analysis complete.");
    } catch (e: any) {
      setError(`Skeletonization failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Watershed
  const handleRunWatershed = async () => {
    if (!wsImagePath) {
      setError("Please select a binary mask or image for watershed segmentation.");
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);
      const raw = await invoke<number[]>("read_file_bytes", { path: wsImagePath });

      const img = new Image();
      img.src = wsPreview || "";
      await new Promise<void>((res) => (img.onload = () => res()));

      const w = img.naturalWidth || 100;
      const h = img.naturalHeight || 100;

      const boolMask: boolean[] = [];
      const step = raw.length >= w * h * 3 ? 3 : 1;
      for (let i = 0; i < w * h; i++) {
        const val = raw[i * step] || 0;
        boolMask.push(val > 128);
      }

      // Call proc_watershed
      const res = await invoke<WatershedResult>("proc_watershed", {
        mask: boolMask,
        width: w,
        height: h,
      });
      setWatershedResult(res);

      // Record step
      await invoke("workflow_record_step", {
        params: {
          command: "proc_watershed",
          parameters: { width: w, height: h },
          execution_ms: res.execution_time_ms,
          success: true,
        },
      });

      notif.success(`Watershed segmented ${res.cell_count} distinct cell instances.`);
    } catch (e: any) {
      setError(`Watershed failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Workflow: Refresh Pipeline
  const handleRefreshPipeline = async () => {
    try {
      const p = await invoke<WorkflowPipeline>("workflow_get_pipeline");
      setPipelineStepsCount(p.steps.length);
    } catch (e: any) {
      console.warn("Could not fetch workflow pipeline:", e);
    }
  };

  // Workflow: Generate Report
  const handleGenerateReport = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const input: PathologyReportInput = {
        slide_name: slideName,
        specimen_id: specimenId,
        pixel_size_um: pixelSizeUm,
        total_nuclei_detected: totalNuclei,
        mean_nuclear_area_um2: meanArea,
        mean_circularity: meanCircularity,
        positive_fraction: posFraction,
      };

      const md = await invoke<string>("workflow_generate_report", { input });
      setGeneratedReport(md);
      await handleRefreshPipeline();
      notif.success("Pathology report generated.");
    } catch (e: any) {
      setError(`Report generation failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full gap-3 p-3">
      {/* Tab Navigation */}
      <div className="w-[56px] shrink-0 glass-panel flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setActiveTab("skeleton")}
          title="Skeleton & Branch Graph Analysis"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "skeleton"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <Network size={18} />
        </button>

        <button
          onClick={() => setActiveTab("watershed")}
          title="Watershed Segmentation & Distance Transform"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "watershed"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <Split size={18} />
        </button>

        <button
          onClick={() => {
            setActiveTab("workflow");
            handleRefreshPipeline();
          }}
          title="Workflow Pipeline & Pathology Report"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "workflow"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <FileText size={18} />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex gap-3 min-w-0">
        {/* Left Sidebar */}
        <div className="w-[320px] shrink-0 glass-panel p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h2 style={{ color: "var(--text-1)" }} className="text-[15px] font-semibold flex items-center gap-2">
              <Network size={18} className="text-[#5BA8F5]" />
              Morphometry & Reporting
            </h2>
            <p style={{ color: "var(--text-4)" }} className="text-[11px] mt-0.5 capitalize">
              {activeTab} Mode
            </p>
          </div>

          <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

          {/* TAB 1: SKELETON CONTROLS */}
          {activeTab === "skeleton" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Vascular / Filament Mask
              </span>

              <div className="glass-card p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-cyan-400 font-medium">Binary Skeleton Input</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {maskPath ? maskPath.split("\\").pop() : "No mask selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setMaskPath(sel);
                      const { preview } = await loadImageBytes(sel);
                      setMaskPreview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Binary Mask
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-4)]">Pixel Scale (µm/px):</span>
                  <span className="font-semibold text-[var(--text-2)]">{pixelSizeUm}</span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  value={pixelSizeUm}
                  onChange={(e) => setPixelSizeUm(Number(e.target.value))}
                  className="input-glass text-[11px] px-2 py-1"
                />
              </div>

              <button
                onClick={handleRunSkeleton}
                disabled={isProcessing || !maskPath}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Play size={14} /> Thin Mask & Trace Branches
              </button>
            </div>
          )}

          {/* TAB 2: WATERSHED CONTROLS */}
          {activeTab === "watershed" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Overlapping Nuclei Mask
              </span>

              <div className="glass-card p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-emerald-400 font-medium">Binary Image</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {wsImagePath ? wsImagePath.split("\\").pop() : "No image selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setWsImagePath(sel);
                      const { preview } = await loadImageBytes(sel);
                      setWsPreview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Binary Image
                </button>
              </div>

              <button
                onClick={handleRunWatershed}
                disabled={isProcessing || !wsImagePath}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Play size={14} /> Execute Watershed Split
              </button>
            </div>
          )}

          {/* TAB 3: WORKFLOW CONTROLS */}
          {activeTab === "workflow" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Specimen & Clinical Parameters
              </span>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[var(--text-4)]">Slide Name:</label>
                <input
                  type="text"
                  value={slideName}
                  onChange={(e) => setSlideName(e.target.value)}
                  className="input-glass text-[11px] px-2 py-1"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[var(--text-4)]">Specimen ID:</label>
                <input
                  type="text"
                  value={specimenId}
                  onChange={(e) => setSpecimenId(e.target.value)}
                  className="input-glass text-[11px] px-2 py-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--text-4)]">Total Nuclei:</label>
                  <input
                    type="number"
                    value={totalNuclei}
                    onChange={(e) => setTotalNuclei(Number(e.target.value))}
                    className="input-glass text-[11px] px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-4)]">Mean Area (µm²):</label>
                  <input
                    type="number"
                    value={meanArea}
                    onChange={(e) => setMeanArea(Number(e.target.value))}
                    className="input-glass text-[11px] px-2 py-1 w-full"
                  />
                </div>
              </div>

              <div className="text-[10px] text-[var(--text-4)] bg-white/5 p-2 rounded">
                Recorded Pipeline Steps: <span className="font-semibold text-[#5BA8F5]">{pipelineStepsCount}</span>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={isProcessing}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Sparkles size={14} /> Generate Pathology Report
              </button>
            </div>
          )}
        </div>

        {/* Right Content / Dashboard */}
        <div className="flex-1 glass-panel p-4 flex flex-col min-w-0">
          {error && (
            <div className="mb-3 p-2.5 rounded-xl flex items-center gap-2 text-[11px] bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={14} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">×</button>
            </div>
          )}

          {/* VIEW: SKELETON */}
          {activeTab === "skeleton" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="grid grid-cols-2 gap-3 h-[240px]">
                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-cyan-400 bg-black/40 px-2 py-0.5 rounded">
                    Original Mask
                  </span>
                  {maskPreview ? (
                    <img src={maskPreview} alt="Mask" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Select binary mask</span>
                  )}
                </div>

                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-emerald-400 bg-black/40 px-2 py-0.5 rounded">
                    Zhang-Suen Thinning Skeleton
                  </span>
                  {skeletonPreview ? (
                    <img src={skeletonPreview} alt="Skeleton" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Run analysis to view skeleton</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 glass-card p-4 overflow-y-auto">
                <h3 className="text-[13px] font-semibold text-[var(--text-2)] mb-3 flex items-center gap-2">
                  <Network size={16} className="text-[#5BA8F5]" />
                  Filament Network Topology & Branch Lengths
                </h3>

                {skeletonStats ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Branch Count</p>
                        <p className="text-[18px] font-bold text-[#5BA8F5] mt-1">{skeletonStats.branch_count}</p>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Total Length</p>
                        <p className="text-[18px] font-bold text-emerald-400 mt-1">
                          {skeletonStats.total_length_um.toFixed(1)} µm
                        </p>
                        <span className="text-[9px] text-[var(--text-5)]">({skeletonStats.total_length_pixels} px)</span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Junction Points</p>
                        <p className="text-[18px] font-bold text-amber-400 mt-1">{skeletonStats.junction_count}</p>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Endpoints</p>
                        <p className="text-[18px] font-bold text-rose-400 mt-1">{skeletonStats.endpoint_count}</p>
                      </div>
                    </div>

                    {/* Branches List */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 max-h-48 overflow-y-auto">
                      <p className="text-[11px] font-semibold text-[var(--text-3)] mb-2">Traced Branches</p>
                      <div className="flex flex-col gap-1 text-[10px]">
                        {skeletonStats.branches.map((b) => (
                          <div key={b.id} className="flex justify-between items-center bg-black/20 p-1.5 rounded">
                            <span className="font-medium text-[#5BA8F5]">Branch #{b.id}</span>
                            <span>From ({b.start.x}, {b.start.y}) to ({b.end.x}, {b.end.y})</span>
                            <span className="font-semibold text-emerald-400">{b.length_um.toFixed(1)} µm</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-5)] text-[12px]">
                    Load a binary mask and click "Thin Mask & Trace Branches" to analyze topology.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: WATERSHED */}
          {activeTab === "watershed" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="h-[240px] glass-card p-2 flex items-center justify-center relative overflow-hidden">
                {wsPreview ? (
                  <img src={wsPreview} alt="Watershed Input" className="max-h-full object-contain rounded" />
                ) : (
                  <span className="text-[11px] text-[var(--text-5)]">Select binary image</span>
                )}
              </div>

              <div className="flex-1 glass-card p-4 overflow-y-auto">
                <h3 className="text-[13px] font-semibold text-[var(--text-2)] mb-3 flex items-center gap-2">
                  <Split size={16} className="text-[#5BA8F5]" />
                  Watershed Cell Instance Segmentation
                </h3>

                {watershedResult ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Separated Cell Count</p>
                      <p className="text-[20px] font-bold text-emerald-400 mt-1">{watershedResult.cell_count}</p>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Execution Time</p>
                      <p className="text-[20px] font-bold text-[#5BA8F5] mt-1">{watershedResult.execution_time_ms} ms</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-5)] text-[12px]">
                    Select an image and execute watershed to split touching objects.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: WORKFLOW & REPORT */}
          {activeTab === "workflow" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 glass-card p-4 overflow-y-auto flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-[13px] font-semibold text-[var(--text-2)] flex items-center gap-2">
                    <FileText size={16} className="text-[#5BA8F5]" />
                    Pathology Research Report & Audit Trail
                  </h3>

                  {generatedReport && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedReport);
                        notif.success("Report copied to clipboard.");
                      }}
                      className="btn-glass text-[10px] py-1 px-2.5 flex items-center gap-1.5"
                    >
                      <Copy size={12} /> Copy Markdown
                    </button>
                  )}
                </div>

                {generatedReport ? (
                  <pre className="flex-1 p-3 bg-black/40 rounded-xl font-mono text-[11px] text-[var(--text-2)] overflow-x-auto whitespace-pre-wrap border border-white/10">
                    {generatedReport}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-[var(--text-5)] text-[12px]">
                    Click "Generate Pathology Report" to synthesize clinical metrics and audit trail.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
