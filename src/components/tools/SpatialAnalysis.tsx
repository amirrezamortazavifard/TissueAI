import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Compass,
  GitFork,
  Upload,
  Play,
  AlertCircle,
  Layers,
  BarChart3,
} from "lucide-react";
import { useNotification } from "../../contexts/NotificationContext";
import {
  ColocalizationResult,
  DirectionalityResult,
} from "../../types/spatial-analysis";
import {
  AffineTransform,
  LandmarkPair,
  RegistrationMetrics,
} from "../../types/registration";

type ActiveTab = "colocalization" | "directionality" | "registration";

export default function SpatialAnalysis() {
  const notif = useNotification();
  const [activeTab, setActiveTab] = useState<ActiveTab>("colocalization");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tab 1: Colocalization State
  const [ch1Path, setCh1Path] = useState<string | null>(null);
  const [ch2Path, setCh2Path] = useState<string | null>(null);
  const [ch1Preview, setCh1Preview] = useState<string | null>(null);
  const [ch2Preview, setCh2Preview] = useState<string | null>(null);
  const [colocResult, setColocResult] = useState<ColocalizationResult | null>(null);
  const [pdmHeatmapUrl, setPdmHeatmapUrl] = useState<string | null>(null);

  // Tab 2: Directionality State
  const [dirImagePath, setDirImagePath] = useState<string | null>(null);
  const [dirImagePreview, setDirImagePreview] = useState<string | null>(null);
  const [numBins, setNumBins] = useState(36);
  const [dirResult, setDirResult] = useState<DirectionalityResult | null>(null);

  // Tab 3: Registration State
  const [fixedPath, setFixedPath] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [fixedPreview, setFixedPreview] = useState<string | null>(null);
  const [movingPreview, setMovingPreview] = useState<string | null>(null);
  const [alignedPreview, setAlignedPreview] = useState<string | null>(null);
  const [regMetrics, setRegMetrics] = useState<RegistrationMetrics | null>(null);
  const [estimatedAffine, setEstimatedAffine] = useState<AffineTransform | null>(null);
  const [landmarks] = useState<LandmarkPair[]>([
    { source: { x: 50, y: 50 }, target: { x: 55, y: 52 } },
    { source: { x: 200, y: 50 }, target: { x: 205, y: 54 } },
    { source: { x: 125, y: 180 }, target: { x: 130, y: 185 } },
  ]);

  // Helper to load image bytes and create preview
  const loadImageBytes = async (path: string): Promise<{ bytes: number[]; preview: string }> => {
    const raw = await invoke<number[]>("read_file_bytes", { path });
    const b64 = btoa(raw.map((b) => String.fromCharCode(b)).join(""));
    const preview = `data:image/png;base64,${b64}`;
    return { bytes: raw, preview };
  };

  // Run Colocalization
  const handleRunColocalization = async () => {
    if (!ch1Path || !ch2Path) {
      setError("Please load both Channel 1 and Channel 2 images.");
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);
      const ch1Data = await invoke<number[]>("read_file_bytes", { path: ch1Path });
      const ch2Data = await invoke<number[]>("read_file_bytes", { path: ch2Path });

      // Run Colocalization Engine
      const result = await invoke<ColocalizationResult>("spatial_colocalization_analyze", {
        params: { ch1: ch1Data, ch2: ch2Data },
      });
      setColocResult(result);

      // Compute PDM Map
      const pdm = await invoke<number[]>("spatial_colocalization_pdm", {
        params: { ch1: ch1Data, ch2: ch2Data },
      });

      // Render PDM to small preview canvas
      if (pdm.length > 0) {
        const side = Math.floor(Math.sqrt(pdm.length));
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(side, side);
          for (let i = 0; i < pdm.length; i++) {
            const v = pdm[i];
            const idx = i * 4;
            if (v > 0) {
              imgData.data[idx] = Math.min(255, Math.floor(v * 2)); // Red for positive correlation
              imgData.data[idx + 1] = 0;
              imgData.data[idx + 2] = 0;
            } else {
              imgData.data[idx] = 0;
              imgData.data[idx + 1] = 0;
              imgData.data[idx + 2] = Math.min(255, Math.floor(-v * 2)); // Blue for segregation
            }
            imgData.data[idx + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);
          setPdmHeatmapUrl(canvas.toDataURL());
        }
      }

      notif.success("Colocalization analysis completed successfully.");
    } catch (e: any) {
      setError(`Colocalization analysis failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Directionality
  const handleRunDirectionality = async () => {
    if (!dirImagePath) {
      setError("Please select an image for directionality analysis.");
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);
      const raw = await invoke<number[]>("read_file_bytes", { path: dirImagePath });

      // Load dimension from image
      const img = new Image();
      img.src = dirImagePreview || "";
      await new Promise<void>((res) => (img.onload = () => res()));

      const result = await invoke<DirectionalityResult>("spatial_directionality_analyze", {
        params: {
          image: raw,
          width: img.naturalWidth || 256,
          height: img.naturalHeight || 256,
          num_bins: numBins,
        },
      });
      setDirResult(result);
      notif.success("Directionality analysis completed.");
    } catch (e: any) {
      setError(`Directionality failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Registration
  const handleRunRegistration = async () => {
    if (!fixedPath || !movingPath) {
      setError("Please select both Fixed and Moving images.");
      return;
    }
    try {
      setIsProcessing(true);
      setError(null);

      // 1. Estimate Affine Matrix from Landmarks
      const affine = await invoke<AffineTransform>("reg_estimate_affine", { pairs: landmarks });
      setEstimatedAffine(affine);

      // 2. Resample moving image to fixed coordinate space
      const movingRaw = await invoke<number[]>("read_file_bytes", { path: movingPath });
      const fixedRaw = await invoke<number[]>("read_file_bytes", { path: fixedPath });

      const imgFixed = new Image();
      imgFixed.src = fixedPreview || "";
      await new Promise<void>((res) => (imgFixed.onload = () => res()));

      const imgMoving = new Image();
      imgMoving.src = movingPreview || "";
      await new Promise<void>((res) => (imgMoving.onload = () => res()));

      const fw = imgFixed.naturalWidth || 256;
      const fh = imgFixed.naturalHeight || 256;
      const mw = imgMoving.naturalWidth || 256;
      const mh = imgMoving.naturalHeight || 256;

      const resampledBytes = await invoke<number[]>("reg_apply_transform", {
        params: {
          src_bytes: movingRaw,
          src_width: mw,
          src_height: mh,
          dst_width: fw,
          dst_height: fh,
          transform: affine,
        },
      });

      // Create preview for aligned image
      const b64 = btoa(resampledBytes.map((b) => String.fromCharCode(b)).join(""));
      setAlignedPreview(`data:image/png;base64,${b64}`);

      // 3. Compute Metrics
      const metrics = await invoke<RegistrationMetrics>("reg_evaluate_metrics", {
        params: { img_a: fixedRaw, img_b: resampledBytes },
      });
      setRegMetrics(metrics);

      notif.success("Image registration completed with affine transform.");
    } catch (e: any) {
      setError(`Registration failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full gap-3 p-3">
      {/* Tab Navigation */}
      <div className="w-[56px] shrink-0 glass-panel flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setActiveTab("colocalization")}
          title="Colocalization (Pearson & Manders)"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "colocalization"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <Layers size={18} />
        </button>

        <button
          onClick={() => setActiveTab("directionality")}
          title="Fiber Directionality & Anisotropy"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "directionality"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <Compass size={18} />
        </button>

        <button
          onClick={() => setActiveTab("registration")}
          title="Multi-Image Landmark Registration"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            activeTab === "registration"
              ? "bg-[#5BA8F5]/20 text-[#5BA8F5] shadow-[0_0_16px_rgba(91,168,245,0.25)]"
              : "text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-white/[0.05]"
          }`}
        >
          <GitFork size={18} />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex gap-3 min-w-0">
        {/* Left Control Sidebar */}
        <div className="w-[320px] shrink-0 glass-panel p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h2 style={{ color: "var(--text-1)" }} className="text-[15px] font-semibold flex items-center gap-2">
              <Compass size={18} className="text-[#5BA8F5]" />
              Spatial Analysis & Alignment
            </h2>
            <p style={{ color: "var(--text-4)" }} className="text-[11px] mt-0.5 capitalize">
              {activeTab} Module
            </p>
          </div>

          <div className="h-[1px]" style={{ background: "var(--border-2)" }} />

          {/* TAB 1: COLOCALIZATION CONTROLS */}
          {activeTab === "colocalization" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Dual Channels
              </span>

              {/* Ch1 Selector */}
              <div className="glass-card p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-blue-400 font-medium">Channel 1 (Fluorophore A)</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {ch1Path ? ch1Path.split("\\").pop() : "No image selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setCh1Path(sel);
                      const { preview } = await loadImageBytes(sel);
                      setCh1Preview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Ch1
                </button>
              </div>

              {/* Ch2 Selector */}
              <div className="glass-card p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-emerald-400 font-medium">Channel 2 (Fluorophore B)</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {ch2Path ? ch2Path.split("\\").pop() : "No image selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setCh2Path(sel);
                      const { preview } = await loadImageBytes(sel);
                      setCh2Preview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Ch2
                </button>
              </div>

              <button
                onClick={handleRunColocalization}
                disabled={isProcessing || !ch1Path || !ch2Path}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Play size={14} /> Run Colocalization (PCC & Manders)
              </button>
            </div>
          )}

          {/* TAB 2: DIRECTIONALITY CONTROLS */}
          {activeTab === "directionality" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Input Structure Image
              </span>

              <div className="glass-card p-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] text-purple-400 font-medium">Collagen / Actin Fibers</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {dirImagePath ? dirImagePath.split("\\").pop() : "No image selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setDirImagePath(sel);
                      const { preview } = await loadImageBytes(sel);
                      setDirImagePreview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Fiber Image
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-4)]">Histogram Bins:</span>
                  <span className="font-semibold text-[var(--text-2)]">{numBins}</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="72"
                  step="6"
                  value={numBins}
                  onChange={(e) => setNumBins(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <button
                onClick={handleRunDirectionality}
                disabled={isProcessing || !dirImagePath}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Play size={14} /> Analyze Directionality & Anisotropy
              </button>
            </div>
          )}

          {/* TAB 3: REGISTRATION CONTROLS */}
          {activeTab === "registration" && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-4)]">
                Reference & Moving Pair
              </span>

              {/* Fixed Reference */}
              <div className="glass-card p-2 flex flex-col gap-1">
                <span className="text-[10px] text-cyan-400 font-medium">Fixed Image (Target Reference)</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {fixedPath ? fixedPath.split("\\").pop() : "Not selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setFixedPath(sel);
                      const { preview } = await loadImageBytes(sel);
                      setFixedPreview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Fixed
                </button>
              </div>

              {/* Moving Slide */}
              <div className="glass-card p-2 flex flex-col gap-1">
                <span className="text-[10px] text-amber-400 font-medium">Moving Image (To Align)</span>
                <p className="text-[11px] truncate text-[var(--text-2)]">
                  {movingPath ? movingPath.split("\\").pop() : "Not selected"}
                </p>
                <button
                  onClick={async () => {
                    const sel = await open({ filters: [{ name: "Images", extensions: ["png", "jpg", "tif"] }] });
                    if (sel && typeof sel === "string") {
                      setMovingPath(sel);
                      const { preview } = await loadImageBytes(sel);
                      setMovingPreview(preview);
                    }
                  }}
                  className="btn-glass text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Upload size={12} /> Select Moving
                </button>
              </div>

              {/* Landmarks */}
              <div className="glass-card p-2 flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between font-semibold text-[var(--text-3)]">
                  <span>Landmark Control Points ({landmarks.length})</span>
                </div>
                <div className="max-h-24 overflow-y-auto flex flex-col gap-1">
                  {landmarks.map((lm, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[var(--text-4)] bg-white/5 p-1 rounded">
                      <span>P{idx + 1}: ({lm.source.x},{lm.source.y})</span>
                      <span>→ ({lm.target.x},{lm.target.y})</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRunRegistration}
                disabled={isProcessing || !fixedPath || !movingPath}
                className="btn-primary mt-2 flex items-center justify-center gap-2 py-2 text-[12px]"
              >
                <Play size={14} /> Estimate Affine & Align
              </button>
            </div>
          )}
        </div>

        {/* Right Viewport & Quantitative Dashboard */}
        <div className="flex-1 glass-panel p-4 flex flex-col min-w-0">
          {error && (
            <div className="mb-3 p-2.5 rounded-xl flex items-center gap-2 text-[11px] bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={14} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">×</button>
            </div>
          )}

          {/* VIEWPORT: COLOCALIZATION */}
          {activeTab === "colocalization" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="grid grid-cols-3 gap-3 h-[240px]">
                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-blue-400 bg-black/40 px-2 py-0.5 rounded">
                    Channel 1
                  </span>
                  {ch1Preview ? (
                    <img src={ch1Preview} alt="Ch1" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Select Ch1</span>
                  )}
                </div>

                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-emerald-400 bg-black/40 px-2 py-0.5 rounded">
                    Channel 2
                  </span>
                  {ch2Preview ? (
                    <img src={ch2Preview} alt="Ch2" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Select Ch2</span>
                  )}
                </div>

                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-purple-400 bg-black/40 px-2 py-0.5 rounded">
                    PDM Spatial Map
                  </span>
                  {pdmHeatmapUrl ? (
                    <img src={pdmHeatmapUrl} alt="PDM" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Run analysis to view PDM</span>
                  )}
                </div>
              </div>

              {/* Metrics Table */}
              <div className="flex-1 glass-card p-4 overflow-y-auto">
                <h3 className="text-[13px] font-semibold text-[var(--text-2)] mb-3 flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#5BA8F5]" />
                  Quantitative Colocalization Statistics
                </h3>

                {colocResult ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Pearson Correlation (PCC)</p>
                      <p className="text-[18px] font-bold text-[#5BA8F5] mt-1">
                        {colocResult.pearson_r.toFixed(4)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">-1.0 (segregation) to +1.0 (colocalized)</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Manders' M1 (Ch1 in Ch2)</p>
                      <p className="text-[18px] font-bold text-emerald-400 mt-1">
                        {colocResult.manders_m1.toFixed(4)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">Fraction of Ch1 coincident with Ch2</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Manders' M2 (Ch2 in Ch1)</p>
                      <p className="text-[18px] font-bold text-emerald-400 mt-1">
                        {colocResult.manders_m2.toFixed(4)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">Fraction of Ch2 coincident with Ch1</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Costes Auto Threshold</p>
                      <p className="text-[14px] font-semibold text-[var(--text-2)] mt-1">
                        T1: {colocResult.costes_threshold_ch1.toFixed(1)} | T2: {colocResult.costes_threshold_ch2.toFixed(1)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">N = {colocResult.sample_count} pixels</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-5)] text-[12px]">
                    No analysis results yet. Load channels and click "Run Colocalization".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWPORT: DIRECTIONALITY */}
          {activeTab === "directionality" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="h-[240px] glass-card p-2 flex items-center justify-center relative overflow-hidden">
                {dirImagePreview ? (
                  <img src={dirImagePreview} alt="Fibers" className="max-h-full object-contain rounded" />
                ) : (
                  <span className="text-[11px] text-[var(--text-5)]">Select fiber structure image</span>
                )}
              </div>

              {/* Metrics */}
              <div className="flex-1 glass-card p-4 overflow-y-auto">
                <h3 className="text-[13px] font-semibold text-[var(--text-2)] mb-3 flex items-center gap-2">
                  <Compass size={16} className="text-[#5BA8F5]" />
                  Fiber Orientation & Anisotropy Index
                </h3>

                {dirResult ? (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Dominant Angle (θ)</p>
                        <p className="text-[18px] font-bold text-[#5BA8F5] mt-1">
                          {dirResult.dominant_direction_deg.toFixed(1)}°
                        </p>
                        <span className="text-[9px] text-[var(--text-5)]">Principal alignment axis</span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Angular Dispersion (σ)</p>
                        <p className="text-[18px] font-bold text-amber-400 mt-1">
                          ±{dirResult.dispersion_deg.toFixed(1)}°
                        </p>
                        <span className="text-[9px] text-[var(--text-5)]">Standard angular deviation</span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-[var(--text-4)]">Anisotropy Index</p>
                        <p className="text-[18px] font-bold text-emerald-400 mt-1">
                          {dirResult.anisotropy_index.toFixed(3)}
                        </p>
                        <span className="text-[9px] text-[var(--text-5)]">0 (isotropic) to 1.0 (pure alignment)</span>
                      </div>
                    </div>

                    {/* Angular Histogram Bars */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)] mb-2">Angular Distribution (0° to 180°)</p>
                      <div className="flex items-end gap-1 h-20 w-full">
                        {dirResult.bin_counts.map((cnt, i) => {
                          const maxCnt = Math.max(...dirResult.bin_counts, 1);
                          const hPct = Math.min(100, (cnt / maxCnt) * 100);
                          return (
                            <div
                              key={i}
                              title={`${dirResult.bin_centers[i]?.toFixed(0)}°: ${cnt} px`}
                              className="flex-1 bg-[#5BA8F5]/80 hover:bg-[#5BA8F5] transition-all rounded-t-sm"
                              style={{ height: `${hPct}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-5)] text-[12px]">
                    Select an image and run directionality analysis to compute anisotropy.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWPORT: REGISTRATION */}
          {activeTab === "registration" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="grid grid-cols-3 gap-3 h-[240px]">
                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-cyan-400 bg-black/40 px-2 py-0.5 rounded">
                    Fixed Reference
                  </span>
                  {fixedPreview ? (
                    <img src={fixedPreview} alt="Fixed" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Select Fixed</span>
                  )}
                </div>

                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-amber-400 bg-black/40 px-2 py-0.5 rounded">
                    Original Moving
                  </span>
                  {movingPreview ? (
                    <img src={movingPreview} alt="Moving" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Select Moving</span>
                  )}
                </div>

                <div className="glass-card p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="absolute top-2 left-2 text-[10px] font-semibold text-emerald-400 bg-black/40 px-2 py-0.5 rounded">
                    Aligned (Affine Resampled)
                  </span>
                  {alignedPreview ? (
                    <img src={alignedPreview} alt="Aligned" className="max-h-full object-contain rounded" />
                  ) : (
                    <span className="text-[11px] text-[var(--text-5)]">Execute to see aligned result</span>
                  )}
                </div>
              </div>

              {/* Registration Metrics */}
              <div className="flex-1 glass-card p-4 overflow-y-auto">
                <h3 className="text-[13px] font-semibold text-[var(--text-2)] mb-3 flex items-center gap-2">
                  <GitFork size={16} className="text-[#5BA8F5]" />
                  Registration Accuracy & Affine Transformation Matrix
                </h3>

                {estimatedAffine && regMetrics ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Mean Squared Error (MSE)</p>
                      <p className="text-[18px] font-bold text-amber-400 mt-1">
                        {regMetrics.mse.toFixed(2)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">Pixel intensity difference</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <p className="text-[10px] text-[var(--text-4)]">Normalized Cross Correlation</p>
                      <p className="text-[18px] font-bold text-emerald-400 mt-1">
                        {regMetrics.ncc.toFixed(4)}
                      </p>
                      <span className="text-[9px] text-[var(--text-5)]">1.0 = perfect alignment</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-[10px]">
                      <p className="text-[var(--text-4)] mb-1">Affine Matrix [A, B, Tx; C, D, Ty]</p>
                      <div className="font-mono bg-black/30 p-1.5 rounded text-[var(--text-2)]">
                        [{estimatedAffine.a.toFixed(2)}, {estimatedAffine.b.toFixed(2)}, {estimatedAffine.tx.toFixed(1)}]<br />
                        [{estimatedAffine.c.toFixed(2)}, {estimatedAffine.d.toFixed(2)}, {estimatedAffine.ty.toFixed(1)}]
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-5)] text-[12px]">
                    Select fixed and moving images with landmarks to calculate affine registration.
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
