# گزارش ممیزی جامع انطباق قابلیت‌های ImageJ / Fiji در پروژه TissueAI

**تاریخ بازنگری:** نوامبر ۲۰۲۶  
**سند مرجع نیازمندی‌ها:** `options.md` (نسخه ۲.۰)  
**معماری هدف:** Desktop Hybrid — Tauri v2.x + Rust Core + React 19 + TypeScript + Vite  
**وضعیت نهایی بازرسی:** ۴۷۶ شناسه ارزیابی‌شده | عدم تغییر در کدبیس (Read-Only Audit)  

---

## ۱. چکیده مدیریتی و ارزیابی معماری فعلی (Executive Summary)

سند حاضر نتیجه ممیزی عمیق و خط‌به‌خط کدبیس پروژه **TissueAI** در مقایسه با ۴۷۶ شناسه قابلیتی تعریف‌شده در سند `options.md` (شامل هسته ImageJ 1.x، ImageJ2، اکوسیستم Fiji و افزونه‌های تخصصی پاتولوژی دیجیتال) است.

### وضعیت آماری کل شناسه‌ها:
- **تعداد کل قابلیت‌های تعریف‌شده:** ۴۷۶ شناسه
- **کاملاً پیاده‌سازی‌شده (`EXISTS_COMPLETE`):** 7 مورد (۱.۵٪)
- **پیاده‌سازی ناقص یا شبیه‌سازی‌شده (`EXISTS_PARTIAL`):** 38 مورد (۷.۸٪)
- **کاملاً ناموجود (`MISSING`):** 409 مورد (۸۵.۷٪)
- **مسدود به دلیل وابستگی خارجی (`BLOCKED_DEPENDENCY`):** 10 مورد (۲.۱٪ — عمدتاً Bio-Formats بر پایه Java)
- **خارج از دامنه هدف پاتولوژی (`NOT_APPLICABLE`):** 12 مورد (۲.۵٪ — ماژول BoneJ برای استخوان و میکرو سی‌تی)

### ارزیابی واقع‌گرایانه وضعیت فنی کدبیس:
1. **هسته پردازش تصویر موجود:** در حال حاضر پردازش تصاویر بر پایه Crateهای `image` (نسخه 0.25) و `ndarray` (نسخه 0.17) استوار است. بافر تصویر در اکثر ماژول‌ها فقط از نوع ۸ بیتی (`RgbImage` / `DynamicImage`) است و مدل داده علمی هایپراستک (N-Dimensional Hyperstack با ابعاد X, Y, Z, C, T و انواع داده ۱۶ بیتی و float32) وجود ندارد.
2. **وضعیت Whole Slide Imaging (WSI):** رابط کاربری `WsiViewer.tsx` در وضعیت فعلی یک نمایشگر شبیه‌سازی‌شده (Mock) است که کل بایت‌های تصویر دوبعدی را با `read_file_bytes` در رم بارگذاری کرده و در یک تگ HTML `<img>` رندر می‌کند. قابلیت‌های واقعی WSI نظیر بازخوانی لایه‌های هرمی (Pyramid Level Selection)، زمان‌بندی هوشمند تایل‌ها (Tile Scheduler) بر اساس Viewport، نگاشت حافظه (Memory Mapping / mmap) و فرمت‌های SVS/NDPI در لایه Rust هنوز پیاده‌سازی نشده‌اند.
3. **هوش مصنوعی و یادگیری عمیق:** زیرساخت ONNX Runtime (`ort = 2.0.0-rc.12`) به همراه بارگذاری امن مدل‌های رمزنگاری‌شده (`crypto.rs`) و فریم‌ورک یادگیری ماشین Burn (`burn = 0.21.0`) در پروژه تعبیه شده‌اند. استنتاج کادرهای محاطی YOLO و آموزش شبکه‌های Yolox/SSD فعال هستند؛ اما خروجی چندضلعی‌های ستاره‌ای (StarDist) و قطعه‌بندی بدون کادر برای ساختارهای سلولی هنوز کامل نشده است.
4. **تفکیک رنگ بافت‌شناسی (Stain Deconvolution):** ماتریس تفکیک رنگ Ruifrok & Johnston در `commands/color_analysis.rs` برای ۸ نوع رنگ‌آمیزی استاندارد بافت (H&E, H-DAB, Masson, PAS و غیره) به صورت کامل و دقیق پیاده‌سازی شده است.

---

## ۲. چه قابلیت‌هایی کاملاً پیاده‌سازی شده‌اند؟ (`EXISTS_COMPLETE`)

قابلیت‌هایی که پایپ‌لاین کامل آنها از رابط کاربری (Frontend)، ارتباط IPC (Tauri)، محاسبات الگوریتمی در هسته Rust و ذخیره‌سازی/خروجی معتبر و عملیاتی است:

| شناسه | عنوان قابلیت در ImageJ/TissueAI | مسیر فایل Frontend | مسیر فایل Backend (Rust) | وضعیت و شواهد فنی |
| :--- | :--- | :--- | :--- | :--- |
| `ADJ-03` | Auto threshold:** multiple implemented algorithms (e.g. Otsu, Huang, Triangle, Yen, Li, Mean, Moments, Minimum). Show method, polarity, bounds, preview, ROI, histogram, create-mask action. Expose only tested methods. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs, src-tauri/src/tools/segmentation/auto_thresholding.rs` | پیاده‌سازی ۵ متد خودکار (Otsu, Li, Mean, Triangle, Huang) با تولید ماسک و گزارش آماری. |
| `ADJ-11` | Histology color deconvolution (optional):** stain-vector selection (H&E and other models only if validated), custom stain vectors, output separate channels; no clinical-accuracy claim. | `src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/color_analysis.rs` | تفکیک ماتریس نوری Ruifrok-Johnston برای ۸ رنگ‌آمیزی استاندارد هیستولوژی (H&E, H-DAB, Masson, PAS, Giemsa, Alcian Blue, Feulgen, Methyl Green). |
| `MLSEG-03` | Feature extraction — Raw intensity/channel values; Gaussian scales; local mean/variance; gradient magnitude/orientation; DoG; membrane projections where available; texture/neighborhood features; 3D features when supported. Expose sigma range, scales, channels, 2D/3D, cost. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_extractor.rs, src-tauri/src/commands/trainable.rs` | استخراج چندمقیاسی ویژگی‌ها: بلور گوسی، سوبل گرادیان، لاپلاسین گوسی و فضاهای رنگ RGB و HSV. |
| `MLSEG-07` | Live preview — Interactive classification overlay, progress, pause/cancel. | `src/components/tools/Trainable.tsx` | `src-tauri/src/commands/trainable.rs` | ذخیره‌سازی و بارگذاری حاشیه‌نویسی‌ها با فرمت استاندارد LabelMe JSON. |
| `PROC-26` | Crop — ROI crop; selected or all planes; preserve calibration; derived copy by default. | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`crop_image`)` | برش قطعی تصویر با مختصات مشخص و ذخیره در بافر رست. |
| `PROC-28` | Rotate — Numeric/interactive angle, interpolation, expand vs crop, pivot, fill, stack/volume behavior, calibration preservation. | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`rotate_image`, `rotate_90`)` | چرخش ۹۰ درجه و زوایای دلخواه با حفظ نسبت ابعاد. |
| `PROC-29` | Flip — Horizontal/vertical and supported Z orientation; preserve coordinate metadata. | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`flip_image`)` | آینه‌کردن افقی و عمودی روی بافر پیکسلی Rust. |

---

## ۳. چه قابلیت‌هایی ناقص یا شبیه‌سازی‌شده هستند؟ (`EXISTS_PARTIAL`)

قابلیت‌هایی که بخشی از کد، رابط کاربری یا لاجیک آنها نوشته شده اما به دلیل نبود جریان کامل داده، فقدان مدل داده مشترک، یا شبیه‌سازی رابط کاربری کامل نیستند:

| شناسه | عنوان قابلیت | مسیر فایل Frontend | مسیر فایل Backend (Rust) | نقص فنی و علت عدم تکمیل |
| :--- | :--- | :--- | :--- | :--- |
| `ADJ-04` | Manual threshold:** lower/upper sliders and numeric values; preview; separate mask creation; global or slice-specific stack threshold. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/threshold.rs, src-tauri/src/commands/segmentation.rs` | آستانه‌گذاری دستی دوطرفه (Min/Max) با اسلایدر و پیش‌نمایش آنی. |
| `ADJ-12` | Color-space conversion:** RGB/grayscale/HSV-HSB and other implemented spaces; disclose reversible/lossy behavior. | `src/components/tools/Trainable.tsx, src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/tools/trainable/feature_extractor.rs` | تبدیل RGB به Grayscale و HSV در پایپ‌لاین استخراج ویژگی. |
| `ADJ-15` | Threshold-to-mask:** polarity, LUT, connectivity, bit depth, stack scope. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs (`create_threshold_overlay`)` | تولید ماسک باینری از آستانه‌گذاری و ماسک اورلی روی تصویر. |
| `ANA-01` | Measurement configuration:** area, mean, SD, min/max, mode/median where meaningful, integrated density/sum, area fraction, centroid X/Y/Z, center of mass, perimeter/boundary length, bounding rectangle, Feret diameter, fitted ellipse and axes, circularity/aspect ratio/solidity/roundness/compactness with formulas, skewness/kurtosis, line length/angle, pixel/voxel count, C/Z/T. Separate valid 2D vs 3D metrics. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | پیکربندی و محاسبه مساحت، محیط تخمینی، و طول خطوط. |
| `ANA-02` | Calibration:** area and volume in physical units only with valid spacing; distance units; raw vs density-calibrated intensity; units in tables/export. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | گزارش مقادیر بر اساس واحدهای فیزیکی کالیبره‌شده (میکرومتر). |
| `ANA-03` | Measure ROI/image:** current selection, ROI(s), whole image; include image/ROI IDs, C/Z/T, units, calibration state, analysis run ID. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | سنجش مشخصات ROI انتخابی کاربر روی تصویر. |
| `ANA-06` | Results table:** sort/filter/select/copy/export/clear/append; decimal/scientific formatting; raw precision internally; units/provenance; per-object/per-plane/summary; CSV/TSV/JSON. | `src/components/tools/Segmentation.tsx, src/components/tools/Detection.tsx, src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/segmentation.rs, detection.rs, color_analysis.rs` | جدول نتایج و خروجی CSV برای داده‌های آستانه‌گذاری، دیتکشن و آنالیز رنگ. |
| `ANA-08` | Analyze particles:** min/max size in pixels²/µm² or voxels/µm³; circularity range; edge exclusion; include holes; 2D 4/8 and 3D 6/18/26 connectivity where supported; outline/mask/labels output; add to ROI manager; per-object table; count/total area/mean size/area fraction/size distribution; plane/stack scope; optional threshold. Use connected components and stable labels. | `src/components/tools/Detection.tsx, src/components/tools/agent-workspace/DetectionObjectsTable.tsx` | `src-tauri/src/tools/segmentation/connected_components.rs, src-tauri/src/commands/detection.rs` | شمارش ذرات و سلول‌ها از طریق Connected Components و مدل YOLO. |
| `DATA-03` | Spatial calibration and units — Store pixel width/height, voxel depth, time interval, unit per axis (µm, nm, mm, pixel, seconds, etc.), optional origin/transform, calibration source, and validity (`known`, `user_defined`, `missing`, `conflicting`). Allow calibration from a known distance and a drawn line; set aspect ratio, Z spacing, and frame interval; apply to one image or a selected dataset. Measurements use physical units only when calibration is valid. Never invent scale; warn on missing/conflicting calibration. | `src/components/tools/Segmentation.tsx, src/components/tools/Editor/Panels/StatusBar.tsx` | `src-tauri/src/commands/segmentation.rs (`calculate_scale_calibration`)` | کالیبراسیون مقیاس (pixel/µm) در بخش قطعه‌بندی وجود دارد، اما به مدل داده مشترک اسلاید و ابزارهای WSI متصل نشده است. |
| `DATA-09` | Clipboard and duplication — Copy selected pixels or full image; paste; create image from clipboard; duplicate full image, ROI, selected planes, or channels. Preserve data type where possible and warn on conversion. | `src/components/tools/Editor/Panels/ColorPalette.tsx, src/components/tools/Editor.tsx` | `src-tauri/src/llm/clipboard.rs (`arboard`), src-tauri/src/commands/editor.rs` | کپی و پیست با کلیپ‌بورد سیستم و داپلیکیت بوم فعال است؛ اما برای هایپراستک‌ها پیاده‌سازی نشده. |
| `DATA-10` | Undo/redo — Undo safe image operations and annotation edits. For large operations use reversible processing nodes, copy-on-write, tiled deltas, or disclose that an operation cannot be undone. Never advertise undo when unavailable. | `src/components/tools/Editor/History/HistoryManager.ts, src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/editor.rs, src-tauri/src/commands/color_analysis.rs` | سیستم بازگشت (Undo/Redo) به صورت موضعی در ادیتور و آنالیز رنگ فعال است، ولی فاقد گراف پردازش سراسری (DAG) است. |
| `DATA-12` | Pixel inspector — On hover/click display X/Y, C/Z/T, raw pixel values, rendered color, physical coordinates when calibrated, segmentation label/class, and ROI membership. Allow copy. | `src/components/tools/Editor/Panels/StatusBar.tsx, src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/editor.rs, src-tauri/src/commands/color_analysis.rs` | بازرسی مقدار RGB و مختصات پیکسل زیر ماوس؛ بازرسی مقادیر اعشاری یا چندکاناله وجود ندارد. |
| `DLSEG-01` | Model inference:** registry with name/version/domain/axes/channels/normalization/license; block incompatible inputs. | `src/components/tools/Detection.tsx` | `src-tauri/src/tools/detection/yolo_model.rs, src-tauri/src/commands/detection.rs` | اجرای مدل‌های تشخیص شیء مبتنی بر ONNX Runtime (yolo-v8/v11). |
| `DLSEG-02` | StarDist-style nuclei:** star-convex objects on suitable 2D microscopy. Controls: model (fluorescent/H&E only when actually installed), channel, percentile normalization/bounds, score threshold, NMS overlap threshold, tile count/size, label/ROI output. The Fiji StarDist plugin documentation describes 2D and 2D+time; do not claim its 3D support unless another 3D engine is integrated. | `src/components/tools/Detection.tsx` | `src-tauri/src/crypto.rs` | پشتیبانی از مدل‌های رمزنگاری‌شده AES-256-GCM جهت حفظ امنیت مدل‌ها. |
| `IO-01` | Standard image opening — Support formats available in the selected backend, such as TIFF, PNG, JPEG, BMP, GIF, PGM, FITS, and DICOM where its encoding is supported. Detect format from content where safe. Provide useful errors for unsupported/corrupt/truncated files. | `src/components/tools/Editor.tsx, src/components/tools/Detection.tsx` | `src-tauri/src/commands/workspace.rs, src-tauri/src/commands/detection.rs` | باز کردن تصاویر استاندارد PNG, JPG, BMP از طریق image crate. فرمت‌های WSI و استک‌ها پشتیبانی نمی‌شوند. |
| `IO-02` | Drag-and-drop and recent files — Drag files/folders; recent-file list with path/thumbnail/time; reopen recent projects; detect moved/missing sources and offer relinking. | `src/components/tools/agent-workspace/FolderScannerModal.tsx` | `src-tauri/src/commands/workspace.rs (`list_directory`)` | مرور دایرکتوری و اسکن پوشه تصاویر، اما لیست فایل‌های اخیر (MRU) ذخیره دائمی نمی‌شود. |
| `MLSEG-01` | Pixel-classification workflow — Load image/stack; define semantic classes (background, nucleus, cytoplasm, stroma, tumor, vessel, artifact); paint class traces; choose features/scales; train; preview labels/probabilities; add corrections; retrain; apply to current/other images; export labels, probabilities, model. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/` | جریان کاری آموزش مدل قطعه‌بندی پیکسلی با استخراج ویژگی و کلاسیفایر. |
| `MLSEG-02` | Annotation tools — Reuse brush/freehand/polygon/ROI tools; multiple traces/class; undo/redo; colors/visibility; delete/rename; editable training labels. | `src/components/tools/Trainable.tsx` | `src-tauri/src/commands/trainable.rs` | ابزارهای برچسب‌گذاری و حاشیه‌نویسی کلاس‌ها. |
| `MLSEG-04` | Random forest — Control tree count, feature subset, seed, and backend-supported parameters. Do not show ignored settings. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/trainer.rs, classifier.rs` | آموزش طبقه‌بندی‌کننده با فریم‌ورک عمیق Burn و بک‌اند NdArray. |
| `MLSEG-05` | Other classifiers — Expose only installed/validated Weka/backend classifiers, with limitations. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/classifier.rs` | پیش‌بینی کلاس پیکسل‌ها و تولید ماسک خروجی. |
| `PROC-01` | Smooth/mean — Neighborhood averaging, kernel, 2D/3D, boundary policy, ROI, preview. Document kernel footprint and loss of small structures. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_extractor.rs` | فیلتر میانگین‌گیر در هسته استخراج ویژگی استفاده می‌شود اما دیالوگ مستقل در ادیتور ندارد. |
| `PROC-02` | Gaussian blur — Sigma X/Y/Z, physical or pixel units, 2D/3D, channel, stack, boundary policy, ROI, output type. | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_extractor.rs` | فیلتر بلور گوسی چند سیگما در بک‌اند فعال است اما به عنوان فیلتر مستقل با پیش‌نمایش در UI قرار ندارد. |
| `PROC-05` | Remove NaNs — Float images; explicit neighborhood replacement; warn on large NaN patches; do not silently replace infinities. | `src/components/tools/Segmentation.tsx, src/components/tools/Trainable.tsx` | `src-tauri/src/commands/segmentation.rs (`compute_sobel`), feature_extractor.rs` | لبه‌یابی سوبل برای کمک به قطعه‌بندی هوشمند و فیچر ترینبل موجود است. |
| `PROC-25` | Resampling/scaling — New dimensions, aspect ratio, interpolation (nearest/bilinear/bicubic or supported), physical scale, output size; warn sampling changes. | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`resize_image`, `resize_canvas`)` | تغییر ابعاد تصویر و بوم کاری بر پایه درون‌یابی استاندارد. |
| `ROI-01` | Selection primitives — Rectangle, oval/ellipse, polygon, freehand area, freehand line, straight line, segmented line, angle line, point/multipoint, wand/tracing, brush/paint selection. Include edit handles, clear/cancel, configurable shortcuts. | `src/components/tools/Editor/Selection/SelectionOverlay.tsx, src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs, src-tauri/src/tools/detection/bounding_box.rs` | ابزارهای انتخاب کادر مستطیلی، چندضلعی و نقطه به‌صورت پراکنده در ابزارها وجود دارند. |
| `ROI-02` | ROI geometry — Store type, coordinates, vertices, bounds, name, label, color, stroke/fill, calibration, axes association, and source identity. Support holes/multipart if possible; otherwise reject unsupported geometry clearly. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs (`calculate_polygon_area`, `calculate_measurement_distance`)` | محاسبه مساحت چندضلعی و فاصله اقلیدسی نقاط با اعمال ضریب کالیبراسیون. |
| `SEG-01` | Manual segmentation:** brush/paint, polygon, freehand, wand, threshold, ROI-to-mask; add/subtract/erase; brush size/opacity/undo; separate mask layer. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | تولید ماسک قطعه‌بندی خودکار بر پایه ۵ متد آستانه‌گذاری. |
| `SEG-02` | Binary masks:** create from threshold/ROI/labels/model; preserve polarity, bit depth, dimensions, calibration, source ID. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/threshold.rs` | قطعه‌بندی دستی با تعیین حد بالا و پایین شدت روشنایی. |
| `SEG-04` | Watershed:** marker-controlled/distance-transform; automatic/local maxima or manual seeds; preview, boundary, labels, postprocessing. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/morphology.rs` | عملیات مورفولوژی پایه شامل فرسایش (Erode) و گسترش (Dilate) با کرنل صلیبی ۳×۳. |
| `SEG-07` | Label tools:** select, crop, merge, replace ID, remove, sequential relabel, keep/remove largest, border removal, size/volume filtering, boundaries, binary masks, object table. | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/connected_components.rs` | برچسب‌گذاری اجزای متصل باینری و محاسبه مساحت و کادر محاطی هر شیء. |
| `VIEW-01` | 2D canvas — Smooth zoom, fit-to-window, pan, 1:1, navigator/minimap, zoom around cursor, nearest-neighbor inspection option. Display interpolation must be separate from scientific data. | `src/components/tools/Editor/Canvas/DrawingCanvas.tsx, src/components/tools/agent-workspace/WsiViewer.tsx` | `src-tauri/src/commands/editor.rs` | بوم دوبعدی با زوم، جابجایی و خط‌کش؛ اما رندرینگ هرمی برای ابعاد گیگاپیکسلی شبیه‌سازی‌شده است. |
| `VOL-01` | Volume rendering:** transfer function, intensity range, LUT, opacity curve, sampling quality, background, lighting, camera. | `src/components/tools/ThreeViewer/ThreeViewer.tsx, SceneViewport.tsx` | `src-tauri/src/commands/three_d.rs` | نمایش و مدیریت صحنه‌های سه‌بعدی و مش‌های پولیگونال زیستی با Three.js. |
| `WF-01` | Import و triage اسلاید WSI — 1. افزودن SVS/NDPI/MRXS/OME-TIFF یا فرمت واقعاً پشتیبانی‌شده. 2. reader probe و metadata inspection. 3. نمایش pyramid, dimensions, calibration, stain, objective و warnings. 4. ساخت thumbnail/overview. 5. tissue detection و QC map اختیاری. 6. ثبت slide/case/specimen metadata. 7. حفظ source و ایجاد project reference. | `src/components/tools/agent-workspace/index.tsx` | `src-tauri/src/commands/workspace.rs` | واردسازی و تریاژ اولیه اسلایدها در پوشه کاری. |
| `WF-02` | H&E stain separation و quantification — 1. انتخاب H&E image/slide. 2. تعیین color profile و stain vectors. 3. نمایش H/E/Residual channels. 4. بررسی histogram و quality warning. 5. ایجاد derived channels. 6. انتخاب tissue ROI. 7. اندازه‌گیری stain intensity/area fraction در ROI. 8. ذخیره parameters و export table/heatmap. | `src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/color_analysis.rs` | جداسازی و سنجش رنگ‌آمیزی H&E و محاسبه درصد اشغال بافت. |
| `WF-03` | Nuclei detection و morphometry — 1. انتخاب مدل YOLO/ONNX یا algorithm classical. 2. تعیین class labels و stain preprocessing. 3. tile-aware inference. 4. cross-tile deduplication. 5. review bounding boxes/instances. 6. optional segmentation refinement. 7. compute nuclei count، area، perimeter، diameter، circularity، eccentricity و spatial density. 8. خروجی per-object CSV/JSON و slide summary. | `src/components/tools/Detection.tsx` | `src-tauri/src/commands/detection.rs` | تشخیص سلول‌ها و گلبول‌ها با خروجی کادرهای محاطی و تراکم. |
| `WSI-01` | Reader registry و تشخیص نوع اسلاید — - یک registry از reader adapterها ایجاد شود؛ هر adapter قابلیت‌های فرمت، pyramid، metadata، tile read، region read، channel و write را اعلام کند. - فایل با signature/content و ساختار داخلی شناسایی شود؛ صرف پسوند برای تصمیم قطعی کافی نیست. - برای هر فایل مشخص شود: reader انتخاب‌شده، نسخه backend، فرمت واقعی، تعداد pyramid levelها، ابعاد level-0، tile size، downsamples، channel/color model، metadata availability و محدودیت‌های احتمالی. - فرمت‌های WSI مانند Aperio SVS، Hamamatsu NDPI، MIRAX/MRXS، Leica، Philips، 3DHISTECH و TIFF pyramidal فقط در صورت پشتیبانی واقعی adapter فعال نمایش داده شوند. این فهرست وعده پشتیبانی خودکار از همه فرمت‌ها نیست. - قابلیت «format capability registry» باید به UI بگوید کدام قابلیت read/write/metadata برای هر reader وجود دارد. | `src/components/tools/agent-workspace/FolderScannerModal.tsx` | `src-tauri/src/commands/workspace.rs` | تشخیص پسوندهای اسلاید WSI (SVS, NDPI, TIFF) در لیست فایل‌ها. |
| `WSI-02` | معماری pyramid و level selection — - level-0 مرجع مختصات اصلی باشد. - هر level دارای width، height، downsample factor دقیق/اندازه‌گیری‌شده و metadata خود باشد. - انتخاب level براساس zoom و device pixel ratio انجام شود؛ تغییر level نباید مختصات ROI را عوض کند. - fallback برای فایل بدون pyramid: downsample مشتق‌شده با job پس‌زمینه و cache؛ هرگز در اولین بازشدن یک WSI بزرگ full-resolution downsample در UI انجام نشود. - levelها در project metadata ثبت شوند، اما نیازی به کپی همه tileهای منبع داخل پروژه نیست. | `src/components/tools/agent-workspace/WsiViewer.tsx` | `—` | تغییر بزرگ‌نمایی در UI (10x, 20x, 40x, 100x) به صورت شبیه‌سازی مقیاس. |
| `WSI-03` | Tile reader و viewport scheduler — - ورودی: `slide_id`, `level`, `x`, `y`, `tile_width`, `tile_height`, `channel/display_profile`. - خروجی: tile خام/فشرده یا handle قابل دسترسی + مشخصات pixel type، اندازه، origin، level و transform. - tileها برحسب viewport فعلی و margin پیش‌بارگذاری شوند؛ tileهای خارج viewport با اولویت پایین‌تر. - درخواست تکراری deduplicate شود؛ tile لغوشده یا دیگر لازم به‌موقع از صف حذف شود. - خطای یک tile نباید کل اسلاید را از کار بیندازد؛ placeholder خطا و retry محدود داشته باشد. - tileهای خروجی باید به‌صورت واضح از cache، decoded source و derived tile تشخیص داده شوند. | `src/components/tools/agent-workspace/WsiViewer.tsx` | `src-tauri/src/commands/detection.rs (`read_file_bytes`)` | ناوبری و جابجایی پان در بوم اسلاید روی تصویر دوبعدی استاندارد. |

---

## ۴. چه قابلیت‌هایی اصلاً وجود ندارند؟ (`MISSING`, `BLOCKED`, `NOT_APPLICABLE`)

### ۴.۱ قابلیت‌های مسدود شده به دلیل وابستگی خارجی (`BLOCKED_DEPENDENCY`):
این قابلیت‌ها شامل فرمت‌های اختصاصی میکروسکوپی شرکتی (CZI زایس، LIF لایکا، ND2 نیکون، OIB المپیوس و غیره) هستند که در ImageJ از طریق کتابخانه Bio-Formats (بر پایه جاوا) خوانده می‌شوند. به دلیل عدم وجود لایسنس باز یا Crate بومی امن و مستقل از JVM در Rust، پیاده‌سازی مستقیم آنها بدون Sidecar مسدود است:

| شناسه | عنوان فرمت/قابلیت | وابستگی مسدودکننده | استراتژی پیشنهادی در معماری TissueAI |
| :--- | :--- | :--- | :--- |
| `BF-01` | Import workflow:** explicit importer; metadata/series chooser; select series/channels/Z/T/resolution; grayscale/composite/color/split channels; optional display autoscale; ROI import; crop-on-import; virtual/on-disk mode; dimensions and memory preview. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-02` | Metadata inspection:** metadata-only, raw metadata, OME-XML, series/plane/tile counts, channel/objective/pixel size/acquisition data, missing/conflicting warnings. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-03` | OME model:** structured metadata mapping, not one opaque text string; keep original metadata for audit. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-04` | Exporter:** OME-TIFF/OME-XML and supported output formats; validate dimensions, pixels, metadata, calibration; reopen verification. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-05` | Remote import:** optional, local cache, explicit URL/status, warn local disk is more robust. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-06` | Windowless import:** reuse last settings with visible summary and reset. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-07` | Plate/well/position:** preserve acquisition hierarchy; do not flatten wells/positions. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-08` | Plane metadata:** timestamps, stage positions, exposure, channel metadata. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-09` | Diagnostics:** unsupported series/compression/invalid metadata errors; safe reader fallback only. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |
| `BF-10` | Format compatibility page:** reader version/capabilities and link to current official format list. | نیازمند Bio-Formats CLI / JNI یا libbioformats | پشتیبانی اولویت‌دار از OME-TIFF استاندارد باز یا تبدیل توسط Sidecar اختصاصی |

### ۴.۲ قابلیت‌های غیرقابل انطباق با حوزه تخصصی نرم‌افزار (`NOT_APPLICABLE`):
این قابلیت‌ها مربوط به بسته **BoneJ** برای تحلیل میکرو سی‌تی (micro-CT) و ترابکول‌های استخوانی هستند که با دامنه پاتولوژی سلولی و بافت‌شناسی نرم TissueAI انطباق ندارند و طبق رهنمود سند `options.md` نیازی به پیاده‌سازی ندارند:

| شناسه | عنوان قابلیت BoneJ | دلیل خروج از دامنه |
| :--- | :--- | :--- |
| `BONE-01` | Analyze skeleton with validated 2D/3D workflow. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-02` | Degree of anisotropy from mean intercept length vectors/ellipsoid fitting. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-03` | Trabecular thickness. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-04` | Trabecular spacing/separation. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-05` | Structure model index or other validated 3D structure descriptors. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-06` | Bone volume fraction/BV-TV when supported and calibrated. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-07` | Connectivity and surface/volume descriptors. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-08` | Local thickness maps where supported. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-09` | Input requirements: binary/8-bit image, valid segmentation, voxel spacing, supported dimensions. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-10` | Warnings for non-binary/wrong-type/unsupported hyperstack. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-11` | Export metrics and QC. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |
| `BONE-12` | Phantom/domain validation before reporting bone measurements. | خارج از دامنه پاتولوژی بافت نرم (میکرو سی‌تی استخوان) |

### ۴.۳ قابلیت‌های کاملاً ناموجود (`MISSING` — مجموعاً 409 شناسه):
مهم‌ترین گروه‌های ناموجود که باید در فازهای بعدی پیاده‌سازی شوند عبارتند از:
- **هسته داده‌های چندبعدی (`DATA-01`, `DATA-02`, `DATA-06`):** استک‌های Z، سری‌های زمانی T، کانال‌های فلورسانس C، و آرایه‌های ۳۲ بیتی اعشاری.
- **پایپ‌لاین کامل اسلایدهای WSI (`WSI-04` تا `WSI-24`):** برش موازی تایل‌ها، کش نگاشت‌شده حافظه، فرمت‌های هرمی SVS/NDPI/BigTIFF.
- **مدیریت پیشرفته نواحی مورد نظر (`ROI-03` تا `ROI-22`):** ساخت ابزار اختصاصی ROI Manager، عملیات جبر بولی (AND, OR, XOR)، درون‌یابی اشکال و خروجی GeoJSON.
- **واترشفد و تفکیک هسته‌ها (`SEG-05`, `SEG-06`):** تبدیل فاصله اقلیدسی (EDT) و واترشفد مارکرمحور برای جداسازی سلول‌های متراکم (بسیار حیاتی برای پاتولوژی).
- **آنالایزر ذرات (`ANA-05` تا `ANA-31`):** فیلترهای اندازه و کرویت، قطرهای فرت، ممان‌های اینرسی و رسم پروفایل شدت.
- **فیلترهای فوریه و تبدیل دامنه فرکانس (`PROC-17` تا `PROC-24`):** تبدیل فوریه دو بعدی (FFT) و فیلترهای بالاگذر/پایین‌گذر.
- **ردیابی سلولی و استیچینگ (`TRACK-01` تا `TRACK-23`، `REG-01` تا `REG-18`):** الگوریتم‌های TrackMate و پیوند تصاویر.

---

## ۵. کدام قابلیت‌ها با معماری فعلی Rust و Tauri قابل پیاده‌سازی هستند؟

بیش از **۹۰٪** از قابلیت‌های ممیزی‌شده بدون نیاز به تغییر فریم‌ورک اصلی یا معماری کلاینت/سرور، مستقیماً در بستر **Rust (Native Core) + Tauri IPC + React 19** قابل پیاده‌سازی هستند:

1. **مدل داده تصویر علمی تانسوری (`DATA-01` تا `DATA-08`):** با استفاده از `ndarray::ArrayD` و انتزاع انواع داده عددی (`u8`, `u16`, `f32`) در قالب یک ساختار یکپارچه `ImageAsset` در Rust.
2. **الگوریتم‌های قطعه‌بندی واترشفد و تبدیل فاصله (`SEG-05`, `SEG-06`):** با استفاده از ساختار داده صف اولویت (`BinaryHeap`) و آرایه‌های همسایگی در Rust برای عملکرد بی‌نظیر چندنخی بدون وابستگی به OpenCV.
3. **آنالایزر ذرات و ویژگی‌های هندسی سلول (`ANA-01` تا `ANA-15`):** ردیابی کانتور (Moore-Neighbor Tracing)، ممان‌های چندضلعی، قطرهای مینیمم/ماکزیمم فرت و بیضی برازش‌شده.
4. **فیلترهای خطی و غیرخطی پردازش تصویر (`PROC-01` تا `PROC-16`):** فیلترهای میانه، تفریق پس‌زمینه (Rolling Ball)، تیزکردن و کانولوشن‌های دلخواه بر بستر هسته Rust با پردازش موازی Rayon.
5. **سیستم ROI Manager و جبر بولی (`ROI-03` تا `ROI-22`):** مدیریت چندضلعی‌ها، محاسبه مساحت و تداخل با کتابخانه‌های استاندارد برداری.
6. **مدل استنتاج StarDist برای پاتولوژی (`DLSEG-03` تا `DLSEG-06`):** به دلیل وجود `ort = 2.0.0-rc.12` در بک‌اند، تنها با اضافه کردن تابع پس‌پردازش رادیال چندضلعی‌های ستاره‌ای و NMS زاویه‌ای در Rust، استنتاج مستقیم مدل‌های پیش‌آموزش‌دیده StarDist میسر خواهد شد.

---

## ۶. کدام قابلیت‌ها نیازمند وابستگی جدید (Crate یا کتابخانه خارجی) هستند؟

برای رساندن TissueAI به سطح استانداردهای صنعتی و علمی ImageJ/Fiji، اضافه کردن Crateهای زیر در `Cargo.toml` ضروری است:

| نام Crate پیشنهادی | نسخه سازگار | کاربرد در قابلیت‌های ImageJ/TissueAI | شناسه قابلیت‌های مرتبط |
| :--- | :--- | :--- | :--- |
| `tiff` | `^0.9` (با BigTIFF) | خواندن و نوشتن مستقیم فایل‌های هرمی چندلایه‌ای TIFF، هدرهای پیشرفته و OME-TIFF | `IO-06`, `IO-21`, `WSI-01`, `WSI-02` |
| `openslide-rs` یا FFI محلی | `^2.0` | دسترسی بومی به فرمت‌های اختصاصی WSI شامل `.svs` (Aperio)، `.ndpi` (Hamamatsu) و `.mrxs` | `WSI-01` تا `WSI-06`, `IO-06` |
| `dicom` (`dicom-object`, `dicom-pixeldata`) | `^0.7` | استاندارد تصویربرداری پزشکی، خواندن متادیتا، اسلایدهای دیجیتال پاتولوژی DICOM WSI | `IO-08`, `DATA-04` |
| `rustfft` | `^6.2` | تبدیل فوریه سریع دوبعدی برای فیلترهای فرکانسی، دکانولوشن و آنالیز جهت‌گیری فیبرها | `PROC-21` تا `PROC-24`, `DIR-01`, `DECON-01` |
| `geo` / `geo-types` | `^0.28` | محاسبات جبر بولی هندسی روی اشکال ROI، تداخل چندضلعی‌ها و صادرات GeoJSON | `ROI-03`, `ROI-04`, `ROI-15` |
| `rhai` | `^1.19` | موتور اسکریپت‌نویسی محلی، سبک و امن در Rust جهت اجرای ماکروها و اتوماسیون مشابه Macro ImageJ | `AUTO-01` تا `AUTO-08` |
| `rayon` | `^1.10` | موازی‌سازی پردازش پیکسلی روی تمامی هسته‌های پردازنده برای فیلترها و برش تایل‌ها | `PROC-01` تا `PROC-39`, `WSI-03` |

---

## ۷. چه قابلیت‌هایی بیشترین اولویت را برای توسعه دارند؟ (تحلیل اولویت‌بندی P0)

برای تبدیل TissueAI به یک ابزار پاتولوژی واقعی و قابل اعتماد در سطح جهانی، قابلیت‌های اولویت اول (**P0**) در ۵ ستون حیاتی قرار می‌گیرند:

1. **معماری حقیقی WSI و لایه نمایش هرمی (`WSI-01` تا `WSI-06`, `VIEW-01`):**
   - تبدیل `WsiViewer.tsx` از حالت شبیه‌سازی به یک سامانه واکشی تایل‌های هرمی در زمان واقعی.
   - خواندن مستقیم فایل‌های چند گیگابایتی SVS و BigTIFF بدون سرریز حافظه RAM.

2. **مدل داده علمی واحد با کالیبراسیون فیزیکی (`DATA-01`, `DATA-03`, `DATA-04`):**
   - پیاده‌سازی ساختار `ImageAsset` و حفظ همیشگی رزولوشن فیزیکی (µm/pixel) در کل زنجیره پردازش.

3. **مدیریت متمرکز ROI و ابزارهای حاشیه‌نویسی پاتولوژی (`ROI-01` تا `ROI-06`):**
   - ساخت کامپوننت `RoiManager` با قابلیت ذخیره، لایه‌بندی و انتقال با مختصات اسلاید گیگاپیکسلی.

4. **تفکیک هسته‌ها با واترشفد و تحلیل ذرات (`SEG-05`, `SEG-06`, `ANA-08`):**
   - سلول‌های سرطانی و توموری همواره به صورت متراکم و چسبیده هستند. بدون واترشفد مارکرمحور، هیچ ارزیابی بالینی دقیقی از تعداد و مورفولوژی سلول‌ها ممکن نیست.

5. **تکمیل خط لوله استنتاج هوش مصنوعی در مقیاس WSI (`DLSEG-01`, `DLSEG-03`, `WF-01` تا `WF-04`):**
   - استنتاج شبکه‌های StarDist و YOLO روی تایل‌های اسلاید با حذف تداخل حاشیه‌ها (Stitch-free Tile Inference) و استخراج نقشه حرارتی تراکم تومور.

---

## ۸. ماتریس ممیزی تفصیلی تمامی ۴۷۶ قابلیت بر اساس سند `options.md`

در این جدول، وضعیت واقعی و شواهد فنی تک‌تک شناسه‌ها مستند شده است:

| شناسه (ID) | عنوان و شرح قابلیت | بخش سند | وضعیت پیاده‌سازی | مسیر فرانت‌اند | مسیر بک‌اند | امکان‌پذیری در معماری | نیازمندی وابستگی | اولویت |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `ADJ-01` | Type conversion:** 8-bit, 16-bit, float32, indexed colo... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-02` | Brightness/contrast:** display range, auto, reset, nume... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-03` | Auto threshold:** multiple implemented algorithms (e.g.... | 6. Image type conversion, | **`EXISTS_COMPLETE`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs, ` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P0/P1` |
| `ADJ-04` | Manual threshold:** lower/upper sliders and numeric val... | 6. Image type conversion, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/thresho` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ADJ-05` | Contrast enhancement:** stretch/normalize, histogram eq... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-06` | Invert:** correct inversion for 8/16/float, color chann... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-07` | Color balance/channel math:** RGB weights, grayscale fo... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-08` | LUT:** apply/invert/import/export, preserve raw values.... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-09` | Normalize:** selected intensity range, image/stack/chan... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-10` | Gamma:** numeric gamma, preview, record formula/range.... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-11` | Histology color deconvolution (optional):** stain-vecto... | 6. Image type conversion, | **`EXISTS_COMPLETE`** | `src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/color_analysis.rs` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P0/P1` |
| `ADJ-12` | Color-space conversion:** RGB/grayscale/HSV-HSB and oth... | 6. Image type conversion, | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx, src/` | `src-tauri/src/tools/trainable/feature_ex` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ADJ-13` | Channel combination:** composite display, channel weigh... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-14` | Calibration/density calibration:** known distance and c... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-15` | Threshold-to-mask:** polarity, LUT, connectivity, bit d... | 6. Image type conversion, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs (` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ADJ-16` | LUT range:** independent min/max per channel, persisted... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-17` | Display-vs-pixel indicator:** visible distinction for c... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-18` | Per-channel statistics:** histograms and numeric stats ... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ADJ-19` | Presets:** save/reuse contrast, LUT, channel colors, th... | 6. Image type conversion, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `ANA-01` | Measurement configuration:** area, mean, SD, min/max, m... | 8. Quantitative analysis, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ANA-02` | Calibration:** area and volume in physical units only w... | 8. Quantitative analysis, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ANA-03` | Measure ROI/image:** current selection, ROI(s), whole i... | 8. Quantitative analysis, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ANA-04` | Threshold-limited measurements:** threshold pixels or i... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-05` | Redirect measurements:** ROI on reference image measure... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `ANA-06` | Results table:** sort/filter/select/copy/export/clear/a... | 8. Quantitative analysis, | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx, s` | `src-tauri/src/commands/segmentation.rs, ` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ANA-07` | Summarize:** count, mean, SD, min/max, median and valid... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `ANA-08` | Analyze particles:** min/max size in pixels²/µm² or vox... | 8. Quantitative analysis, | **`EXISTS_PARTIAL`** | `src/components/tools/Detection.tsx, src/` | `src-tauri/src/tools/segmentation/connect` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `ANA-09` | Particle QC:** overlay accepted/rejected objects and re... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `ANA-10` | Histogram:** full image/ROI/channel/threshold/Z/T range... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `ANA-11` | Plot profile:** line ROI, straight/segmented/freehand, ... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-12` | Z profile:** ROI mean/statistics vs Z; physical spacing... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-13` | Time profile:** ROI intensity/statistics vs frame/time;... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-14` | Surface plot:** intensity surface with sampling/color/v... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-15` | Calibration bar:** units, labels, decimals, font/bold, ... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-16` | Analyze line graph:** isolate curve and export X/Y; cal... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-17` | Gel analysis:** select first/next lanes; lane profile; ... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-18` | Stable object identity:** object IDs tied to label/sour... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-19` | Spatial distribution:** centroid maps, nearest-neighbor... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-20` | Morphometry:** area, perimeter, major/minor axis, eccen... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-21` | Intensity:** integrated density, mean/median/min/max/SD... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-22` | Density calibration:** curve/table, units, residuals, v... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-23` | Batch analysis:** multiple images, combined table, sour... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-24` | Reproducible report:** provenance, calibration, ROIs, s... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-25` | Plot tools:** line/scatter/histogram/XY/Z/time/distribu... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-26` | Group summaries:** specimen/slide/case/stain/channel/ti... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-27` | Precision:** decimals/scientific notation/locale-safe f... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-28` | Measurement overlays:** IDs/selected metrics as non-des... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-29` | Stale-result invalidation:** mark measurements stale wh... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-30` | Quality metrics:** object counts, area distribution, ma... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `ANA-31` | Validation:** analytic circles/squares/lines/spheres/gr... | 8. Quantitative analysis, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `AUTO-01` | Command recorder:** record supported user operations, p... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-02` | Script editor:** syntax highlight for supported languag... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-03` | Macro/command API:** open/import, select image, thresho... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-04` | Parameter schema:** machine-readable type/label/default... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-05` | Batch processing:** file filters, recursive folders, ou... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-06` | Batch pipeline:** explicit input binding; never rely on... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-07` | Headless mode:** separate engine from UI so compatible ... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-08` | Command finder:** search names/categories/keywords; des... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-09` | Extension registry:** command/plugin ID, version, depen... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-10` | Extension updates (optional):** trusted sources, pinnin... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-11` | Pipeline templates:** import→calibration→segment→partic... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-12` | Debugging:** line-level errors, stack trace, command co... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-13` | Reproducible log:** pipeline/code hash, inputs, paramet... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-14` | Shared command execution:** same command semantics from... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-15` | Pipeline graph:** nodes/edges for images, masks, tables... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-16` | Safe script sandbox:** restrict untrusted script file/n... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `AUTO-17` | Automation tests:** run test image through pipeline and... | 10. Macros, scripting, co | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند موتور اسکریپت‌نویسی مح | `P2` |
| `BF-01` | Import workflow:** explicit importer; metadata/series c... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-02` | Metadata inspection:** metadata-only, raw metadata, OME... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-03` | OME model:** structured metadata mapping, not one opaqu... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-04` | Exporter:** OME-TIFF/OME-XML and supported output forma... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-05` | Remote import:** optional, local cache, explicit URL/st... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-06` | Windowless import:** reuse last settings with visible s... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-07` | Plate/well/position:** preserve acquisition hierarchy; ... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-08` | Plane metadata:** timestamps, stage positions, exposure... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-09` | Diagnostics:** unsupported series/compression/invalid m... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BF-10` | Format compatibility page:** reader version/capabilitie... | 11. Microscopy formats an | **`BLOCKED_DEPENDENCY`** | `—` | `—` | نیازمند Sidecar یا Java/C Brid | نیازمند Bio-Formats CLI / JNI  | `P2` |
| `BIG-01` | Virtual access:** lazy/disk-backed/tiled/chunked loadin... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-02` | Pyramids:** multiresolution levels for responsive zoom;... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-03` | Chunk storage:** chunk dimensions tuned to XY tiles, Z ... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-04` | Arbitrary reslicing:** view arbitrary 3D planes; respec... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-05` | Multi-source view:** multiple channels/views/acquisitio... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-06` | Time navigation:** browse without loading every frame.... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-07` | Global registration:** transforms per view into common ... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-08` | Pyramid export:** documented format with sources/time/c... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-09` | HDF5/XML (optional):** use documented schema; validate ... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-10` | Remote chunks (optional):** secure access/authenticatio... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-11` | Memory budget:** configurable RAM/cache; bounded; avoid... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-12` | Virtual-stack processing:** run compatible pipelines on... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BIG-13` | Large-data test:** open, navigate, render, crop, and pr... | 12. Large images and mult | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `BONE-01` | Analyze skeleton with validated 2D/3D workflow.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-02` | Degree of anisotropy from mean intercept length vectors... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-03` | Trabecular thickness.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-04` | Trabecular spacing/separation.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-05` | Structure model index or other validated 3D structure d... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-06` | Bone volume fraction/BV-TV when supported and calibrate... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-07` | Connectivity and surface/volume descriptors.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-08` | Local thickness maps where supported.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-09` | Input requirements: binary/8-bit image, valid segmentat... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-10` | Warnings for non-binary/wrong-type/unsupported hypersta... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-11` | Export metrics and QC.... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `BONE-12` | Phantom/domain validation before reporting bone measure... | 24. Other specialist Fiji | **`NOT_APPLICABLE`** | `—` | `—` | نامرتبط با اهداف بافت‌شناسی و  | خارج از اولویت | `P3` |
| `COLOC-01` | Channel selection:** A/B channels, ROI/mask image, Z/T ... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-02` | Mask restriction:** run within ROI/mask; define foregro... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-03` | Scatter plot:** A vs B intensities, selected pixels, th... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-04` | Pearson R:** coefficient, N, ROI/mask, thresholds, chan... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-05` | Manders:** M1/M2 or actual supported variants; define d... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-06` | Costes threshold:** implement full Costes method/random... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-07` | Li/other metrics:** expose only implemented methods wit... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-08` | Significance:** randomization/shuffle where supported; ... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-09` | Visualization:** channels/composite, threshold and mask... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-10` | Report:** metrics, thresholds, scatter, ROI, pixel coun... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-11` | Batch:** channel pairs across compatible images/ROIs.... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-12` | Object-based colocalization:** separate module for segm... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-13` | Interpretation warnings:** acquisition, background, ble... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `COLOC-14` | Validation:** synthetic channels with known correlation... | 18. Colocalization — Colo | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `DATA-01` | Typed pixel data — Support without premature conversion... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-02` | N-dimensional axes — Use an explicit axis model rather ... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-03` | Spatial calibration and units — Store pixel width/heigh... | 2. Scientific image data  | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx, s` | `src-tauri/src/commands/segmentation.rs (` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `DATA-04` | Metadata preservation — Preserve dimensions, pixel type... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-05` | Immutable source and derived data — Keep raw source imm... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-06` | Stacks and hyperstacks — Support 2D images, 3D Z-stacks... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-07` | Image properties — Display width, height, C/Z/T sizes, ... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-08` | Multi-image workspace — Multiple images, tabs/window li... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-09` | Clipboard and duplication — Copy selected pixels or ful... | 2. Scientific image data  | **`EXISTS_PARTIAL`** | `src/components/tools/Editor/Panels/Color` | `src-tauri/src/llm/clipboard.rs (`arboard` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `DATA-10` | Undo/redo — Undo safe image operations and annotation e... | 2. Scientific image data  | **`EXISTS_PARTIAL`** | `src/components/tools/Editor/History/Hist` | `src-tauri/src/commands/editor.rs, src-ta` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `DATA-11` | Image comparison — Side-by-side and synchronized compar... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-12` | Pixel inspector — On hover/click display X/Y, C/Z/T, ra... | 2. Scientific image data  | **`EXISTS_PARTIAL`** | `src/components/tools/Editor/Panels/Statu` | `src-tauri/src/commands/editor.rs, src-ta` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `DATA-13` | Image arithmetic compatibility — Define compatibility r... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DATA-14` | Sample data — Provide legal sample images and synthetic... | 2. Scientific image data  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DECON-01` | Input:** observed image/stack + PSF image or theoretica... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-02` | PSF management:** load/generate with optical model; rec... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-03` | Direct filters:** naive inverse, regularized inverse, T... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-04` | Iterative methods:** Richardson–Lucy, RL-TV, Landweber/... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-05` | Parameters:** iterations, regularization, stopping tole... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-06` | 2D/3D:** state support explicitly; never flatten a volu... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-07` | Preview/convergence:** intermediate iterations and resi... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-08` | Batch:** per-image PSF/settings, progress, memory.... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-09` | Headless:** explicit image/PSF/algorithm/parameters.... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-10` | Validation:** simulated objects/PSF/noise; ringing/nois... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-11` | Comparison:** observed, PSF, restored, residual.... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-12` | Residual:** image and statistics; visual sharpness is n... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-13` | Report:** hashes, PSF params, algorithm, iterations, re... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-14` | Memory:** tile support only if boundary behavior valid;... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-15` | Presets:** only documented optical assumptions; no univ... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-16` | Positivity/range:** expose only supported constraints/c... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-17` | License/citation:** review before integrating code.... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DECON-18` | Research warning:** computational restoration, not grou... | 23. Deconvolution microsc | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P3` |
| `DIR-01` | Histogram:** preferred orientations for elongated struc... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-02` | Fourier method:** partition image, Fourier power, angul... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-03` | Local gradient method:** Sobel-like gradients; orientat... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-04` | Statistics:** peak direction, width, secondary peaks; p... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-05` | Orientation map:** hue encodes local direction, saturat... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-06` | Diagnostics:** angular filters, power spectrum, gradien... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-07` | Table:** per-ROI direction, peak fit, bins, params/meth... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-08` | Multiscale:** compare different patch sizes/scales.... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-09` | Dimensionality:** state 2D vs true 3D; don't describe a... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DIR-10` | Validation:** synthetic line patterns at known angles, ... | 19. Directionality/orient | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند rustfft | `P2` |
| `DLSEG-01` | Model inference:** registry with name/version/domain/ax... | 14. Deep-learning segment | **`EXISTS_PARTIAL`** | `src/components/tools/Detection.tsx` | `src-tauri/src/tools/detection/yolo_model` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2/P3` |
| `DLSEG-02` | StarDist-style nuclei:** star-convex objects on suitabl... | 14. Deep-learning segment | **`EXISTS_PARTIAL`** | `src/components/tools/Detection.tsx` | `src-tauri/src/crypto.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2/P3` |
| `DLSEG-03` | Custom StarDist model:** load local compatible model ar... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DLSEG-04` | Cellpose adapter (optional):** model, diameter, flow/ce... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DLSEG-05` | Omnipose adapter (optional):** expose only installed in... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DLSEG-06` | Cellpose-SAM adapter (optional):** compatible runtime o... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `DLSEG-07` | ilastik bridge (optional):** import compatible classifi... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-08` | Model registry:** ID/version/source/license/path/checks... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-09` | Inference queue:** queue, progress, cancel, retry, per-... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-10` | Output review:** probability/label overlay, confidence/... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-11` | Model comparison:** overlay, object counts, metrics vs ... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-12` | Normalization:** channel, percentile or mean/std only i... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-13` | Tiling/merging:** overlap, boundary policy, ID reconcil... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-14` | Device config:** CPU/GPU/runtime/memory; do not assume ... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-15` | Offline inference:** local model and local runtime; rem... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-16` | Reproducibility:** model checksum, runtime/device/versi... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-17` | Privacy:** no cloud upload without explicit disclosure/... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `DLSEG-18` | Validation/scope:** show model training domain. Fluores... | 14. Deep-learning segment | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-01` | Standard image opening — Support formats available in t... | 3. File input, import, ex | **`EXISTS_PARTIAL`** | `src/components/tools/Editor.tsx, src/com` | `src-tauri/src/commands/workspace.rs, src` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `IO-02` | Drag-and-drop and recent files — Drag files/folders; re... | 3. File input, import, ex | **`EXISTS_PARTIAL`** | `src/components/tools/agent-workspace/Fol` | `src-tauri/src/commands/workspace.rs (`li` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `IO-03` | Folder/image-sequence importer — Options: filename filt... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-04` | Raw binary importer — Controls: width, height, image/sl... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | موجود (zip crate) | `P1` |
| `IO-05` | Text-image importer — Import tabular numeric text as a ... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-06` | Video/time-lapse import — Where codecs exist, import vi... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-07` | URL/remote import (optional) — Only through explicit ac... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-08` | Bio-Formats-compatible importer — **High-priority micro... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-09` | DICOM — Support series grouping, instance ordering, pix... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند Crate جدید (dicom-rs) | `P2` |
| `IO-10` | TIFF and OME-TIFF — Preserve pixel type, plane order, C... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-11` | Bio-Formats exporter — Where installed, offer OME-TIFF/... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-12` | Save as/export options — Native project; TIFF/OME-TIFF;... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | موجود (zip crate) | `P1` |
| `IO-13` | Image-sequence export — Export selected planes individu... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-14` | Save ROI — Save one ROI or an archive. Preserve type, g... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-15` | Save measurements — Export selected/all results to CSV/... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-16` | Save LUT — Import/export LUTs as display settings, not ... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | موجود (zip crate) | `P1` |
| `IO-17` | Save XY coordinates — Export line/contour coordinates w... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-18` | Batch folder import/export — Process a selected folder ... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-19` | Import validation report — Show file/format, dimensions... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-20` | Format capability registry — At runtime list installed ... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-21` | Checksums/integrity — Optionally checksum source, detec... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-22` | Autosave/recovery — Atomic autosave of project metadata... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-23` | Relink missing data — Relink one file or a folder using... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-24` | Export selected planes/region — Export ROI, channels, Z... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `IO-25` | Privacy controls — DICOM de-identification, metadata in... | 3. File input, import, ex | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند Crate جدید (dicom-rs) | `P2` |
| `MLSEG-01` | Pixel-classification workflow — Load image/stack; defin... | 13. Interactive machine-l | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2` |
| `MLSEG-02` | Annotation tools — Reuse brush/freehand/polygon/ROI too... | 13. Interactive machine-l | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/commands/trainable.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2` |
| `MLSEG-03` | Feature extraction — Raw intensity/channel values; Gaus... | 13. Interactive machine-l | **`EXISTS_COMPLETE`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_ex` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P2` |
| `MLSEG-04` | Random forest — Control tree count, feature subset, see... | 13. Interactive machine-l | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/trainer.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2` |
| `MLSEG-05` | Other classifiers — Expose only installed/validated Wek... | 13. Interactive machine-l | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/classifier` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2` |
| `MLSEG-06` | 2D/3D — True 3D feature set if supported; otherwise exp... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-07` | Live preview — Interactive classification overlay, prog... | 13. Interactive machine-l | **`EXISTS_COMPLETE`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/commands/trainable.rs` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P2` |
| `MLSEG-08` | Probability map — Per-class probabilities/confidence se... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-09` | Settings — Class count, features, scales, classifier, t... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-10` | Model save/load — Model, class mapping, features, libra... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-11` | Batch prediction — Run on compatible images; report ski... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-12` | Training curation — Manage traces, class imbalance, pix... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-13` | Validation split — Image/region-level holdout; avoid ne... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-14` | Metrics — Confusion matrix, per-class precision/recall/... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-15` | Tiled inference — Overlapping tiles, blending strategy,... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-16` | CPU/GPU — Use installed backend; show device/runtime an... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-17` | Correction loop — Correct regions, retrain/re-predict, ... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-18` | Probability→labels — Visible threshold or argmax policy... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-19` | Compatibility — Check channel count, feature schema, dt... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-20` | Training persistence — Traces, classes, params, feature... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-21` | Labkit-style UI — Image canvas, class list, brush tools... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-22` | Weka-style comparison — Compare selected classifiers/fe... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MLSEG-23` | Acceptance — Annotated benchmark patches, class metrics... | 13. Interactive machine-l | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-01` | 2D/3D morphology:** erosion, dilation, opening, closing... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-02` | Reconstruction:** dilation/erosion reconstruction; hole... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-03` | Watershed GUI:** 2D/3D marker/mask/distance/watershed w... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-04` | Distance watershed:** binary distance transform + local... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-05` | Label utilities:** border removal, select/crop/replace/... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-06` | Size opening:** remove labels below area/volume thresho... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-07` | Region analysis:** intrinsic volumes, area, volume, per... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-08` | Photometry:** intensity statistics per label on source ... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-09` | Label editor:** select, merge, morphology, remove by si... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-10` | Connected components:** label connected regions, size/d... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-11` | 3D connectivity:** 6/18/26 convention and topology impl... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-12` | Geodesic distance:** within mask/region when supported.... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-13` | Topology:** Euler number and related descriptors only f... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-14` | Filtering:** area/volume, border, ID, region features.... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-15` | Boundaries:** mask and overlay; consistent label mappin... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-16` | Merge/split consistency:** update labels, tables, resul... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-17` | Batch morphology:** recorded settings across images/sta... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `MORPH-18` | Validation:** structuring element, border, connectivity... | 21. Morphological analysi | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `PROC-01` | Smooth/mean — Neighborhood averaging, kernel, 2D/3D, bo... | 7. Image processing and f | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_ex` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1/P2` |
| `PROC-02` | Gaussian blur — Sigma X/Y/Z, physical or pixel units, 2... | 7. Image processing and f | **`EXISTS_PARTIAL`** | `src/components/tools/Trainable.tsx` | `src-tauri/src/tools/trainable/feature_ex` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1/P2` |
| `PROC-03` | Median — Radius/kernel X/Y/Z, 2D/3D, edge, channel, ROI... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-04` | Remove outliers — Local median-based replacement; radiu... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-05` | Remove NaNs — Float images; explicit neighborhood repla... | 7. Image processing and f | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx, s` | `src-tauri/src/commands/segmentation.rs (` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1/P2` |
| `PROC-06` | Sharpen — Documented sharpening and unsharp mask; radiu... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-07` | Find edges — Sobel gradient magnitude and X/Y maps; cle... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-08` | Custom convolution — Custom kernel matrix, normalizatio... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-09` | Minimum/maximum — Grayscale erosion/dilation; kernel ge... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-10` | Background subtraction / rolling ball — Radius in pixel... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-11` | Noise — Denoising plus synthetic Gaussian, salt-and-pep... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-12` | Binary morphology — Erode, dilate, open, close, fill ho... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-13` | Structuring elements — Square, rectangle, disk, line, d... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-14` | Distance transform — Distance-to-background/object for ... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-15` | Watershed — Intensity/binary, marker-controlled/seeded,... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-16` | Ultimate points/local maxima — Regional maxima; output ... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-17` | Voronoi — Regions from binary objects/centers; calibrat... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-18` | Arithmetic with constants — Add/subtract/multiply/divid... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-19` | Image calculator — Two-image add/subtract/multiply/divi... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-20` | Expression evaluator — Sandboxed numeric expression lan... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-21` | FFT/frequency domain — 2D FFT/FHT when available; power... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-22` | FFT bandpass — Large/small structures, stripe suppressi... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-23` | Custom frequency filter — User-defined symmetric mask/f... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-24` | Frequency-domain math — Convolution, correlation, decon... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-25` | Resampling/scaling — New dimensions, aspect ratio, inte... | 7. Image processing and f | **`EXISTS_PARTIAL`** | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`resiz` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1/P2` |
| `PROC-26` | Crop — ROI crop; selected or all planes; preserve calib... | 7. Image processing and f | **`EXISTS_COMPLETE`** | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`crop_` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P0/P1/P2` |
| `PROC-27` | Translate — X/Y/Z shift, fill/background, interpolation... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-28` | Rotate — Numeric/interactive angle, interpolation, expa... | 7. Image processing and f | **`EXISTS_COMPLETE`** | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`rotat` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P0/P1/P2` |
| `PROC-29` | Flip — Horizontal/vertical and supported Z orientation;... | 7. Image processing and f | **`EXISTS_COMPLETE`** | `src/components/tools/Editor.tsx` | `src-tauri/src/commands/editor.rs (`flip_` | پیاده‌سازی شده و عملیاتی | وابستگی‌های موجود (بدون نیاز ب | `P0/P1/P2` |
| `PROC-30` | Reslice — Resample along line/plane and create orthogon... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-31` | Stack duplication/splitting — Duplicate selected planes... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-32` | Stack operations — Add/remove/replace/reorder/reverse s... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-33` | Stack alignment preprocessing — Optional registration b... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-34` | Stack scope — Every compatible command exposes current ... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-35` | ROI-only processing — Process current ROI and define ou... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-36` | Preview/presets — Responsive preview where feasible; re... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-37` | Repeat last command — Reuse settings only for compatibl... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-38` | Filter comparison — Compare configurations on duplicate... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `PROC-39` | Pipeline preview — Ordered operations, enable/disable/r... | 7. Image processing and f | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `REG-01` | Workflow:** reference/moving images; channel/Z/T/sectio... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-02` | Translation:** XY/XYZ displacement via landmarks or cor... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-03` | Rigid body:** translation + rotation, no scale/shear.... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-04` | Affine:** translation/rotation/scale/shear when justifi... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-05` | Deformable:** optional validated algorithm only; disclo... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-06` | Landmark registration:** paired landmarks; transform an... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-07` | StackReg/TurboReg-style adapter:** expose only transfor... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-08` | Channel registration:** align channels; preserve channe... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-09` | Time-lapse drift:** selected registration channel/refer... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-10` | Z-stack alignment:** selected slices; supported rigid/a... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-11` | Serial-section alignment:** align histology sections; r... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-12` | 2D stitching:** overlapping tiles; correlation/features... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-13` | 3D stitching:** overlapping stacks/volumes.... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-14` | Grid stitching:** regular grid dimensions, overlap, pos... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-15` | Collection stitching:** irregular layout with configura... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-16` | Unknown-layout directory stitching:** discover overlaps... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-17` | Blending:** linear/nonlinear overlap blending; no-blend... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `REG-18` | QC:** blink/checkerboard/overlay, matrix, residuals, ov... | 16. Registration, alignme | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | نیازمند الگوریتم‌های انطباق (i | `P2` |
| `ROI-01` | Selection primitives — Rectangle, oval/ellipse, polygon... | 5. Selection tools, ROI m | **`EXISTS_PARTIAL`** | `src/components/tools/Editor/Selection/Se` | `src-tauri/src/commands/segmentation.rs, ` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `ROI-02` | ROI geometry — Store type, coordinates, vertices, bound... | 5. Selection tools, ROI m | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs (` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `ROI-03` | ROI Manager — Add, add-and-name, update, rename, delete... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-04` | Overlay editing — Show all ROIs with labels; click labe... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-05` | ROI import/export — Support documented ROI format(s), c... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-06` | ROI measurement — Measure current/selected/all ROIs; cu... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-07` | Multi-measure — Measure ROIs across all slices/frames; ... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-08` | Boolean ROI operations — Union, intersection, differenc... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-09` | Draw/fill/clear — Draw boundary, fill, clear inside/out... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-10` | Numeric ROI specification — Exact X/Y/width/height/angl... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-11` | Points and landmarks — Add/name/move/delete/group/expor... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-12` | ROI groups/classes — Named groups such as tumor, stroma... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-13` | Plane-aware ROIs — Preserve C/Z/T association; support ... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-14` | ROI statistics — Count, area/volume, perimeter/surface,... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-15` | Labels/measurement text — Show names, IDs, metric value... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-16` | Search/filter — Search names/classes/labels; filter by ... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-17` | Edit history — Undo/redo geometry edits; link each anal... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-18` | Annotation primitives — Text, arrows, lines, rectangles... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-19` | Coordinate export — Export contours with X/Y, calibrate... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-20` | Selection transforms — Move, resize, rotate, translate,... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-21` | Wand options — Tolerance, connected/global selection, 4... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `ROI-22` | Validity — Detect empty/degenerate/self-intersecting/of... | 5. Selection tools, ROI m | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | کتابخانه محاسبات هندسی (geo-ty | `P0` |
| `SEG-01` | Manual segmentation:** brush/paint, polygon, freehand, ... | 9. Built-in segmentation  | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/commands/segmentation.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `SEG-02` | Binary masks:** create from threshold/ROI/labels/model;... | 9. Built-in segmentation  | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/thresho` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `SEG-03` | Connected components:** 2D/3D labels, connectivity, min... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-04` | Watershed:** marker-controlled/distance-transform; auto... | 9. Built-in segmentation  | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/morphol` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `SEG-05` | Morphological segmentation:** binary/grayscale erosion,... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `SEG-06` | Morphological reconstruction:** dilation/erosion from m... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0` |
| `SEG-07` | Label tools:** select, crop, merge, replace ID, remove,... | 9. Built-in segmentation  | **`EXISTS_PARTIAL`** | `src/components/tools/Segmentation.tsx` | `src-tauri/src/tools/segmentation/connect` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0` |
| `SEG-08` | Label editor:** list, colors, counts, size/volume, boun... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-09` | Separate touching objects:** distance transform + local... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-10` | Topology cleanup:** fill holes, remove isolated/small o... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-11` | Label measurements:** area/volume, surface/perimeter, c... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-12` | Overlay:** colors, alpha, boundaries, IDs/classes; side... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-13` | Curation:** accept/reject/merge/split/relabel/exclude a... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-14` | Project persistence:** masks, labels, IDs, classes, alg... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-15` | Skeletonize:** validated 2D/3D thinning, separate from ... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-16` | Distance analysis:** distance map, geodesic distance, t... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-17` | Watershed QC:** seeds, boundaries, object count, over/u... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-18` | Dimensional correctness:** explicitly distinguish 2D, s... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-19` | Semantic classes:** background/nuclei/cytoplasm/stroma/... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-20` | Comparison:** Dice, IoU/Jaccard, precision, recall, spe... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-21` | Export:** binary masks, integer labels, object tables, ... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SEG-22` | Reproducibility:** algorithm/version/parameters/input h... | 9. Built-in segmentation  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P1` |
| `SKEL-01` | Skeletonization:** validated 2D/3D thinning; preserve s... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-02` | Voxel classification:** endpoints, slab/intermediate, j... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-03` | Branch graph:** nodes, edges, branch voxels, calibrated... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-04` | Branch statistics:** branches, endpoints, junctions, tr... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-05` | Branch table:** ID, calibrated length, extreme coordina... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-06` | Loops:** detect/prune cycles; no pruning/shortest branc... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-07` | Terminal pruning:** remove endpoint branches by length/... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-08` | Longest shortest path:** compute/display where graph al... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-09` | Labeled display:** color-coded skeleton, skeleton and b... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-10` | Sholl:** intersections with concentric circles/spheres ... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-11` | Strahler:** branch order; root selection and loops hand... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-12` | Neurite tracing:** manual/semi/automatic where integrat... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-13` | Multidimensional tracing:** multichannel, Z-stack, time... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-14` | Soma detection:** only validated algorithm/model; manua... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-15` | Morphology:** total length, branch count/order, radial ... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-16` | General filaments:** astrocytes, microglia, vessels, fi... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SKEL-17` | Export:** SWC or compatible graph, coordinate tables, m... | 20. Skeleton, neurite, an | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `SNT-01` | Manual/semi-automatic multidimensional tracing.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-02` | Automated tracing from grayscale or segmented images wh... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-03` | Multi-cell tracing and soma detection where supported.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-04` | Seeded tracing and editable paths.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-05` | Curation and calibrated quality control.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-06` | Multichannel/time-lapse tracing.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-07` | Brainbow-like image support where relevant.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-08` | Sholl analysis.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-09` | Strahler analysis.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-10` | Root angle/arbor orientation.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-11` | Calcium dynamics along neurites where compatible data e... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-12` | Growth/delineation analysis.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-13` | Connectomics/whole-brain integration only if needed.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-14` | 3D visualization/density maps.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `SNT-15` | SWC or compatible export and scripting API where suppor... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TIME-01` | Create time-colored 2D image from time series or 3D tim... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TIME-02` | Select LUT and frame range.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TIME-03` | Create legend mapping color to frame/time.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TIME-04` | Preserve source stack and frame interval.... | 24. Other specialist Fiji | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-01` | Workflow:** choose time-series; channel/time range; det... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-02` | Detectors:** LoG, DoG, threshold, local maxima, mask/la... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-03` | Detector settings:** channel, radius/diameter in physic... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-04` | Cell-like objects:** use masks/labels and retain bounda... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-05` | Filtering:** intensity, quality, radius, area, class, s... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-06` | Nearest neighbor:** next-frame nearest valid object wit... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-07` | LAP:** global assignment; separate linking, gap closure... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-08` | Kalman:** near-constant-velocity model; expose supporte... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-09` | Overlap tracker:** object contour overlap; threshold an... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-10` | Gap closing:** max frame gap and motion constraints; di... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-11` | Split/merge:** explicit lineage events; manual confirma... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-12` | Editing:** add/remove detections, relink, split/merge t... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-13` | Lineage view:** graph parent/child; select track to hig... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-14` | Overlay:** detections, track lines, IDs, labels, arrows... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-15` | Spot analyzers:** coordinates, quality, radius, intensi... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-16` | Link analyzers:** link distance/displacement/frame gap/... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-17` | Track analyzers:** duration, displacement, path length,... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-18` | Plots:** position/speed/displacement/intensity/size/sha... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-19` | Movie export:** selected tracks over source frames, FPS... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-20` | Data export:** spots/links/tracks/lineage CSV/TSV/JSON ... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-21` | QC:** long links, jumps, low-quality detections, ambigu... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-22` | External detectors:** explicit optional Python/Conda/Ma... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `TRACK-23` | Validation:** synthetic trajectories; identity switches... | 15. Object detection and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `VIEW-01` | 2D canvas — Smooth zoom, fit-to-window, pan, 1:1, navig... | 4. Image viewer, display, | **`EXISTS_PARTIAL`** | `src/components/tools/Editor/Canvas/Drawi` | `src-tauri/src/commands/editor.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P0/P1` |
| `VIEW-02` | Stack navigation — Slice slider/numeric entry, first/pr... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-03` | Hyperstack navigation — Independent C/Z/T selectors and... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-04` | Channel controls/compositing — Toggle channels, per-cha... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-05` | Brightness/contrast — Display min/max, auto contrast, r... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-06` | Threshold visualization — Colored preview overlay, lowe... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-07` | LUTs — Grayscale, inverted grayscale, spectrum, fire, t... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-08` | Overlays — Non-destructive ROI, segmentation contours, ... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-09` | Scale/calibration bar — Physical length/unit, position,... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-10` | Image labels/timestamps — Frame numbers, slice labels, ... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-11` | Orthogonal views — XY/XZ/YZ for calibrated 3D with sync... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-12` | 3D/4D playback — Play time series or Z stack; FPS, loop... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-13` | Pixel inspector — Raw and rendered values per channel, ... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-14` | Color picker — Foreground/background and annotation col... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-15` | 3D preview controls — Camera rotation/zoom/pan/reset, b... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-16` | Window management — Tile/cascade/arrange/focus/hide/clo... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-17` | Magnifier — Magnifier and navigator for fine histology ... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-18` | Multi-view comparison — Linked side-by-side for channel... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-19` | Display state persistence — Per-image zoom, pan, channe... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-20` | Color spaces — RGB↔grayscale, RGB stack, HSB/HSV-like a... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VIEW-21` | Accessibility/precision — Keyboard access, numeric entr... | 4. Image viewer, display, | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P0/P1` |
| `VOL-01` | Volume rendering:** transfer function, intensity range,... | 17. 3D visualization and  | **`EXISTS_PARTIAL`** | `src/components/tools/ThreeViewer/ThreeVi` | `src-tauri/src/commands/three_d.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P2` |
| `VOL-02` | Orthoslices:** XY/XZ/YZ in 3D scene, movable planes, sy... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-03` | Isosurface:** mesh from threshold/label; threshold, smo... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-04` | Surface plot:** intensity surface; height scale/downsam... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-05` | Multi-volume scene:** multiple channels/volumes/labels,... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-06` | Content attributes:** color, opacity, visibility, name,... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-07` | Transformations:** explicit matrix; scene transform sep... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-08` | Points/landmarks:** point clouds, centroids, selected o... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-09` | Custom surface:** add/remove scene content; meshes from... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-10` | 4D viewer:** volume changes over time; do not confuse T... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-11` | Two canvases:** same scene, independent or synchronized... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-12` | Movie recording:** camera orbit/time sequence, FPS/code... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-13` | 3D selection:** select mesh/label in 3D and highlight i... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-14` | Scene tree:** volumes, channels, labels, point sets, me... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-15` | Clipping/cropping:** box/plane/ROI; distinguish display... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-16` | 3D measurement:** surface area, volume, centroid, bound... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-17` | Mesh export:** STL/OBJ/PLY where supported; units/coord... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-18` | Snapshot:** high-resolution image with scale bar/axes/l... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-19` | Performance:** quality/downsample/cache/hardware accele... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `VOL-20` | Validation:** anisotropic volumes, spheres/ellipsoids, ... | 17. 3D visualization and  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P2` |
| `WF-01` | Import و triage اسلاید WSI — 1. افزودن SVS/NDPI/MRXS/OM... | 34. TissueAI Workflows —  | **`EXISTS_PARTIAL`** | `src/components/tools/agent-workspace/ind` | `src-tauri/src/commands/workspace.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WF-02` | H&E stain separation و quantification — 1. انتخاب H&E i... | 34. TissueAI Workflows —  | **`EXISTS_PARTIAL`** | `src/components/tools/ColorAnalysis.tsx` | `src-tauri/src/commands/color_analysis.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WF-03` | Nuclei detection و morphometry — 1. انتخاب مدل YOLO/ONN... | 34. TissueAI Workflows —  | **`EXISTS_PARTIAL`** | `src/components/tools/Detection.tsx` | `src-tauri/src/commands/detection.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WF-04` | Tumor/stroma/normal compartment segmentation — 1. تعریف... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WF-05` | Batch slide analysis — 1. انتخاب slide list یا director... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WF-06` | Time-lapse / fluorescence stack — 1. import axes/channe... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WF-07` | 3D volume segmentation — 1. load volume با Z spacing صح... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WF-08` | Train a custom tissue model — 1. جمع‌آوری اسلایدها و pa... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WF-09` | Research figure و reproducible report — - side-by-side ... | 34. TissueAI Workflows —  | **`MISSING`** | `—` | `—` | معماری فعلی Rust + Tauri | بدون نیاز به Crate جدید (توسعه | `P3` |
| `WSI-01` | Reader registry و تشخیص نوع اسلاید — - یک registry از r... | 24.5 نگاشت قابلیت‌های عمو | **`EXISTS_PARTIAL`** | `src/components/tools/agent-workspace/Fol` | `src-tauri/src/commands/workspace.rs` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WSI-02` | معماری pyramid و level selection — - level-0 مرجع مختصا... | 24.5 نگاشت قابلیت‌های عمو | **`EXISTS_PARTIAL`** | `src/components/tools/agent-workspace/Wsi` | `—` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WSI-03` | Tile reader و viewport scheduler — - ورودی: `slide_id`,... | 24.5 نگاشت قابلیت‌های عمو | **`EXISTS_PARTIAL`** | `src/components/tools/agent-workspace/Wsi` | `src-tauri/src/commands/detection.rs (`re` | معماری فعلی Rust + Tauri (نیاز | وابستگی‌های استاندارد موجود | `P3` |
| `WSI-04` | Cache محدود و کنترل RAM/VRAM — - cache چندسطحی تعریف شو... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-05` | مختصات و تبدیل level-to-level — - همه ROIها و detection... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-06` | نمایش اسلاید با zoom/pan روان — - rendering فقط tileهای... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-07` | Region-of-interest read و crop مجازی — - کاربر بتواند r... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-08` | Multi-resolution thumbnail و slide overview — - overvie... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-09` | Tissue detection و tissue masking — - tissue/background... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-10` | Tissue ROI و compartment annotation — - classes قابل تن... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-11` | Patch extraction و sampling — - استخراج tile/patch با ا... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-12` | Tile-aware image processing — - هر kernel باید مشخص کند... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-13` | Detection across tiles — - YOLO و detectorهای مشابه روی... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-14` | Segmentation across tiles — - semantic/instance segment... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-15` | Heatmap aggregation — - نتایج tile/object به grid یا py... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-16` | Slide-level summary و spatial statistics — - تجمیع coun... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-17` | Slide quality control — - focus/blur score، tissue cove... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-18` | WSI annotation interoperability — - بررسی پشتیبانی impo... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-19` | WSI export — - export region/patch/overview/mask/label/... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-20` | Multi-slide workspace — - چند اسلاید با loading state م... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-21` | Reader fallback و محدودیت فرمت — - adapter با شکست کنتر... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-22` | فایل‌های OME و metadata میکروسکوپی — - OME-XML/OME-TIFF... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-23` | Privacy و de-identification — - نمایش metadata حساس به‌... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |
| `WSI-24` | WSI diagnostics و benchmark — - گزارش تعداد tile read، ... | 24.5 نگاشت قابلیت‌های عمو | **`MISSING`** | `—` | `—` | معماری ماژولار Rust (نیاز به س | نیازمند Crate جدید (tiff با قا | `P0` |

---

## ۹. نقشه راه مرحله‌ای توسعه TissueAI (Phased Implementation Roadmap)

بر اساس نتایج ممیزی، نقشه راه زیر با شناسه دقیق قابلیت‌ها جهت اجرای بدون نقص طراحی شده است:

### فاز ۰: تایید معماری و آماده‌سازی پایپ‌لاین آزمون (Architecture & Golden Tests)
- **هدف:** تثبیت تست‌های طلایی (Golden Tests)، متغیرهای سیستم و پیکربندی بدون باگ کامپایل.
- **شناسه‌های مشمول:** ممیزی کلیه شناسه‌های پایه، راه‌اندازی فریم‌ورک تست رگرسیون تصویر در `src-tauri/tests/`.

### فاز ۱: پایه داده تصویر علمی، یکپارچگی کالیبراسیون و فرمت پروژه (P0)
- **شناسه‌ها:** `DATA-01`, `DATA-02`, `DATA-03`, `DATA-04`, `DATA-05`, `DATA-07`, `DATA-08`, `DATA-10`, `DATA-12`, `IO-01`, `IO-02`.
- **اقدامات کلیدی:** پیاده‌سازی ساختار داده `ScientificImage` در Rust با انواع پیکسلی (`u8`, `u16`, `f32`)، حفظ متادیتای کالیبراسیون بر حسب میکرومتر، سیستم هیستوری عملیات تغییرناپذیر.

### فاز ۲: موتور اسلایدهای تمام‌نگار WSI و رندرینگ هرمی تایل‌ها (P0/P1)
- **شناسه‌ها:** `WSI-01`, `WSI-02`, `WSI-03`, `WSI-04`, `WSI-05`, `WSI-06`, `WSI-07`, `WSI-08`, `WSI-10`, `WSI-11`, `WSI-12`, `IO-06`, `VIEW-01`, `BIG-01`, `BIG-02`, `BIG-03`.
- **اقدامات کلیدی:** اتصال کتابخانه BigTIFF/OpenSlide، موتور زمان‌بندی تایل‌ها در بستر کانال‌های ناهمگام Tokio، کش نگاشت‌شده حافظه، بازنویسی کامل `WsiViewer.tsx` با قابلیت زوم واقعی تا 40x/100x بدون افت فریم.

### فاز ۳: سامانه مدیریت ROI، حاشیه‌نویسی و اندازه‌گیری‌های کمی (P0)
- **شناسه‌ها:** `ROI-01`, `ROI-02`, `ROI-03`, `ROI-04`, `ROI-05`, `ROI-06`, `ROI-07`, `ROI-08`, `ANA-01`, `ANA-02`, `ANA-03`, `ANA-04`, `ANA-06`, `ANA-07`, `ANA-08`, `ANA-09`, `ANA-10`.
- **اقدامات کلیدی:** ساخت ماژول کامل `RoiManager.tsx`، پشتیبانی از اشکال هندسی مرکب، اندازه‌گیری مساحت، محیط و قطرهای فرت در واحدهای میکرومتر و میلی‌متر، خروجی‌های CSV و GeoJSON.

### فاز ۴: قطعه‌بندی پاتولوژی، واترشفد و پردازش رنگ بافت (P1)
- **شناسه‌ها:** `SEG-03`, `SEG-04`, `SEG-05`, `SEG-06`, `SEG-07`, `SEG-08`, `ADJ-01`, `ADJ-02`, `ADJ-04`, `ADJ-05`, `ADJ-07`, `ADJ-08`, `ADJ-09`, `ADJ-10`, `PROC-01`, `PROC-02`, `PROC-03`, `PROC-04`, `PROC-05`, `WF-02`.
- **اقدامات کلیدی:** پیاده‌سازی تبدیل فاصله اقلیدسی (EDT)، واترشفد مارکرمحور در Rust جهت تفکیک هسته‌های چسبیده، اتصال دیالوگ یکپارچه فیلترها و تنظیمات کنتراست و روشنایی.

### فاز ۵: استنتاج یادگیری عمیق در ابعاد WSI و مدل‌های تخصصی هسته (P1/P2)
- **شناسه‌ها:** `DLSEG-01`, `DLSEG-02`, `DLSEG-03`, `DLSEG-04`, `DLSEG-05`, `DLSEG-06`, `MLSEG-01`, `MLSEG-04`, `MLSEG-05`, `WF-01`, `WF-03`, `WF-04`.
- **اقدامات کلیدی:** اضافه کردن پس‌پردازش رادیال StarDist، اجرای مدل‌های قطعه‌بندی تایل‌به‌تایل بدون اثر حاشیه با ONNX Runtime، تولید نقشه‌های تراکم تومور و حاشیه‌نویسی خودکار اسلاید.

### فاز ۶: خط لوله‌های چند اسلایدی، پردازش دسته‌ای و آموزش Trainable (P1/P2)
- **شناسه‌ها:** `MLSEG-06`, `MLSEG-08`, `MLSEG-09`, `MLSEG-10`, `MLSEG-11`, `MLSEG-12`, `IO-03`, `IO-04`, `IO-05`, `WF-05`, `WF-06`, `WF-07`.
- **اقدامات کلیدی:** پایپ‌لاین موازی چنداسلایدی در `MultiSlide.tsx` با کنترل صف و منابع، بهبود ابزار آموزش طبقه‌بندی پیکسلی زنده Weka/Labkit با فریم‌ورک Burn.

### فاز ۷: پردازش چندبعدی، استیچینگ، انطباق و اتوماسیون (P2)
- **شناسه‌ها:** `VIEW-02`, `VIEW-03`, `VIEW-06`, `VIEW-07`, `REG-01`, `REG-02`, `REG-03`, `COLOC-01`, `COLOC-02`, `DIR-01`, `DIR-02`, `SKEL-01`, `SKEL-02`, `AUTO-01`, `AUTO-02`, `AUTO-03`.
- **اقدامات کلیدی:** ناوبری هایپراستک‌های چندکاناله، هم‌مکانی رنگ‌ها، انطباق مقاطع متوالی بافت، اسکلت‌سازی و ضبط ماکروهای اتوماسیون.

### فاز ۸: افزونه‌های تخصصی پیشرفته و رندرینگ حجمی (P3)
- **شناسه‌ها:** `VOL-02` تا `VOL-20`, `TRACK-01` تا `TRACK-23`, `SNT-01` تا `SNT-15`, `DECON-01` تا `DECON-18`, `TIME-01` تا `TIME-04`.
- **اقدامات کلیدی:** ردیابی سلول‌های متحرک، بازسازی سه بعدی حجمی لایه‌های کانفوکال و دکانولوشن نوری ریچاردسون-لوسی.


---

## ۱۰. وضعیت پیشرفت اجرایی — تکمیل موفق فاز ۱ (Data Integrity & Scientific Asset Core)

در اجرای گام اول نقشه راه (Phase 1)، زیرساخت داده‌های علمی طبق استانداردهای بند ۲۶ سند `options.md` پیاده‌سازی و آزمون‌های طلایی آن با موفقیت پاس شدند:

### ۱. دستاوردهای پیاده‌سازی‌شده در فاز ۱:
1. **مدل تانسوری و انواع داده پیکسلی (`DATA-01`, `DATA-02`):**
   - ایجاد ماژول بومی [`scientific_models/scientific_image.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/scientific_models/scientific_image.rs).
   - پشتیبانی از انواع `U8`, `U16`, `I16`, `F32`, `Rgb24`, `Rgba32` با ساختار تانسوری ابعاد (X, Y, Channels, Z-Slices, Time-Points).
2. **سیستم کالیبراسیون و مقیاس فیزیکی (`DATA-03`, `DATA-04`):**
   - پیاده‌سازی ساختار `SpatialCalibration` با محاسبات دقیق تبدیل پیکسل به میکرومتر (`µm`) و میلی‌متر، فاصله اقلیدسی کالیبره‌شده و مساحت بافت بر حسب `µm²`.
3. **تفکیک داده‌های اصلی و اشتقاقی و ثبت شجره‌نامه (`DATA-05`, `DATA-07`):**
   - پیاده‌سازی متد `create_derived` با ثبت ساختار `Provenance` شامل `parent_asset_id`، شناسه عملیات (`operation_id`) و پارامترهای تنظیمی JSON.
4. **دستورات کنترلی Tauri و بازرسی پیکسلی (`DATA-10`, `DATA-12`, `IO-01`):**
   - ایجاد ماژول [`commands/scientific_image.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/commands/scientific_image.rs) شامل دستورات `sci_image_open`, `sci_image_get_asset`, `sci_image_get_pixel`, `sci_image_set_calibration`, `sci_image_get_histogram`, `sci_image_close_asset`.
5. **تایپ‌های متناظر فرانت‌اند:**
   - فایل [`scientific-image.ts`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/types/scientific-image.ts) جهت ارتباط امن تایپ‌ها بین React و Rust.
6. **آزمون‌های یکپارچگی (Automated Test Suite):**
   - تست‌های تایید صحت در [`tests/scientific_image_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/scientific_image_tests.rs) (هر ۳ تست محاسبات فیزیکی، هیستوگرام و شجره‌نامه پاس شدند: `test result: ok. 3 passed; 0 failed`).

---

## ۱۱. وضعیت پیشرفت اجرایی — تکمیل موفق فاز ۲ (WSI Engine & Pyramidal Tile Streaming)

در اجرای گام دوم نقشه راه (Phase 2)، موتور اسلایدهای تمام‌نگار WSI طبق مشخصات فنی بند ۲۷ سند `options.md` پیاده‌سازی و یکپارچه گردید:

### دستاوردهای پیاده‌سازی‌شده در فاز ۲:
1. **موتور بازخوانی هرمی اسلاید (`WSI-01`, `WSI-02`, `IO-06`):**
   - ایجاد ماژول بومی [`wsi/reader.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/wsi/reader.rs).
   - پیاده‌سازی `PyramidalSlideReader` با تشخیص فرمت‌های پاتولوژی (Aperio SVS، Hamamatsu NDPI، 3DHISTECH MRXS و BigTIFF).
   - تولید لایه‌های هرمی چندوضوحه (1x, 2x, 4x, 8x, 16x, 32x) و برش منطقه‌ای (Region Cropping).
2. **حافظه پنهان با ظرفیت محدود و الگوریتم LRU (`WSI-04`):**
   - ایجاد ماژول [`wsi/cache.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/wsi/cache.rs).
   - پیاده‌سازی `TileCache` با محدودیت ۲۵۶ مگابایتی و تخلیه خودکار تایل‌های قدیمی جهت جلوگیری کامل از نشت حافظه در پن/زوم پیوسته.
3. **زمان‌بند تایل و نگاشت مختصات دیدگاه (`WSI-03`, `WSI-06`):**
   - ایجاد ماژول [`wsi/scheduler.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/wsi/scheduler.rs).
   - انتخاب هوشمند لایه هرمی بر پایه ضریب بزرگ‌نمایی، اولویت‌بندی بارگذاری تایل‌های نزدیک به مرکز دیدگاه کاربر، و تبدیل مختصات دوبعدی صفحه نمایش به مختصات جهانی اسلاید در سطح صفر.
4. **دستورات کنترلی WSI در لایه Tauri IPC (`WSI-05`, `WSI-07`):**
   - ایجاد ماژول [`commands/wsi.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/commands/wsi.rs) شامل دستورات:
     - `wsi_open_slide`: باز کردن اسلاید و استخراج لایه‌های هرمی و رزولوشن میکرومتری.
     - `wsi_get_slide_info`: دریافت متادیتای کامل اسلاید.
     - `wsi_get_tile`: واکشی تایل مورد نظر با کش LRU و خروجی Base64.
     - `wsi_get_thumbnail`: تولید تصویر کلی ماکرو از بافت.
     - `wsi_compute_visible_tiles`: محاسبه تایل‌های قابل مشاهده در فریم جاری.
     - `wsi_read_region`: برش مستقیم محدوده با وضوح انتخابی.
     - `wsi_close_slide`: پاکسازی اسلاید و کش مرتبط از رم.
5. **ارتقای نمایشگر اسلاید در فرانت‌اند (`VIEW-01`):**
   - ارتقای کامپوننت [`WsiViewer.tsx`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/components/tools/agent-workspace/WsiViewer.tsx).
   - نمایش نشانگر و متادیتای واقعی اسلاید (فرمت شرکت سازنده، ابعاد دقیق پیکسلی و رزولوشن میکرومتر بر پیکسل).
   - خط‌کش مقیاس داینامیک محاسبه‌شده با رزولوشن واقعی اسلاید ($mpp 	imes 100 / zoom$).
   - مختصات زنده ماوس بر حسب میکرومتر فیزیکی واقعی ($\mu m$).
6. **آزمون‌های خودکار WSI (Automated Test Suite):**
   - تست‌های تایید صحت در [`tests/wsi_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/wsi_tests.rs).
   - هر ۳ تست شامل تخلیه حافظه پنهان LRU، انتخاب صحیح لایه هرمی برای بزرگ‌نمایی‌های 5x تا 40x، و تبدیل مختصات فیزیکی با موفقیت پاس شدند:
     ```text
     test test_tile_scheduler_level_selection ... ok
     test test_tile_scheduler_screen_to_slide_coordinates ... ok
     test test_tile_cache_lru_and_eviction ... ok
     test result: ok. 3 passed; 0 failed; 0 ignored; finished in 0.00s
     ```

---

## ۱۲. وضعیت پیشرفت اجرایی — تکمیل موفق فاز ۳ (ROI Manager & Quantitative Measurements)

در اجرای گام سوم نقشه راه (Phase 3)، سامانه متمرکز مدیریت نواحی مورد نظر (ROI Manager) و موتور سنجش کمی پاتولوژی طبق مشخصات فنی بخش‌های ۵ و ۸ سند `options.md` با موفقیت کامل پیاده‌سازی و مستند شد:

### دستاوردهای پیاده‌سازی‌شده در فاز ۳:
1. **موتور هندسه اشکال و تحلیل کالیپر فرت (`ROI-01`, `ROI-02`, `ROI-08`):**
   - ایجاد ماژول بومی [`roi/geometry.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/roi/geometry.rs).
   - پیاده‌سازی فرمول گاوس (Shoelace Formula) برای محاسبه دقیق مساحت هر نوع چندضلعی مقعر یا محدب.
   - محاسبه محیط واقعی، مرکز جرم (Centroid)، کادر محاطی بهینه (Bounding Box).
   - محاسبه قطرهای فرت ماکزیمم و مینیمم (Maximum & Minimum Feret Diameter) به عنوان شاخص کلیدی اندازه هسته‌ها و سلول‌های توموری.
   - فرمول استاندارد کرویت ImageJ: $4\pi 	imes rac{	ext{Area}}{	ext{Perimeter}^2}$ و نسبت ابعاد (Aspect Ratio).
2. **جبر بولی روی اشکال هندسی (`ROI-04`):**
   - ایجاد ماژول [`roi/boolean.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/roi/boolean.rs).
   - عملیات اجتماع (Union / OR)، اشتراک (Intersection / AND) و تفاضل (Difference / XOR) برای ترکیب نواحی بافت‌شناسی و توموری.
3. **موتور اندازه‌گیری کمی در مقیاس فیزیکی (`ANA-01`, `ANA-02`, `ANA-03`):**
   - ایجاد ماژول [`roi/measurement.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/roi/measurement.rs).
   - محاسبه خودکار مساحت بر حسب میکرومتر مربع ($\mu m^2$)، محیط و قطرهای فرت بر حسب میکرومتر ($\mu m$) با اعمال ضریب کالیبراسیون اسلاید.
4. **سامانه متمرکز ROI Manager و خروجی استاندارد GeoJSON (`ROI-03`, `ROI-07`):**
   - ایجاد ماژول [`roi/manager.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/roi/manager.rs).
   - مدیریت همزمان حاشیه‌نویسی‌ها با دسته‌بندی رنگی، نام‌گذاری، لایه‌بندی و وابستگی به شناسه اسلاید (`slide_id`).
   - صادرات استاندارد لایه‌های تشخیصی پاتولوژی در قالب استاندارد بین‌المللی GeoJSON (سازگار با QuPath و QGIS).
5. **دستورات کنترلی Tauri IPC (`ROI-03`, `ANA-06`):**
   - ایجاد ماژول [`commands/roi.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/commands/roi.rs) شامل دستورات:
     - `roi_add`: ثبت ناحیه جدید همراه با محاسبه آنی مساحت و مشخصات فیزیکی.
     - `roi_list`: فهرست‌گیری از تمام نواحی با فیلتر شناسه اسلاید.
     - `roi_update`: به‌روزرسانی هندسه یا استایل رنگی ناحیه.
     - `roi_delete`: حذف ناحیه مشخص.
     - `roi_clear`: پاکسازی تمام نواحی اسلاید جاری.
     - `roi_measure`: فراخوانی اندازه‌گیری‌های تفصیلی شامل کرویت، فرت و مساحت.
     - `roi_boolean_operation`: اجرای عملیات اشتراک یا اجتماع دو ناحیه و تولید ناحیه مرکب جدید.
     - `roi_export_geojson`: خروجی متن ساختاریافته GeoJSON FeatureCollection.
6. **تایپ‌های متناظر فرانت‌اند:**
   - فایل تعاریف تایپ‌اسکریپت در [`src/types/roi.ts`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/types/roi.ts).
7. **آزمون‌های خودکار یکپارچگی (Automated Test Suite):**
   - تست‌های تایید صحت در [`tests/roi_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/roi_tests.rs).
   - هر ۴ آزمون محاسبات مثلثاتی چندضلعی، قطرهای فرت، عملیات بولی و صادرات GeoJSON با موفقیت کامل پاس شدند:
     ```text
     test test_boolean_rectangle_operations ... ok
     test test_polygon_shoelace_area_and_perimeter ... ok
     test test_shape_metrics_and_feret_diameter ... ok
     test test_roi_manager_measurements_and_geojson ... ok
     test result: ok. 4 passed; 0 failed; 0 ignored; finished in 0.00s
     ```

---

## ۱۴. گزارش تکمیلی پیاده‌سازی فاز ۴: پردازش تصویر و جداسازی واترشفد (Image Processing & Watershed Segmentation)

در فاز چهارم نقشه راه، موتور پیشرفته پردازش تصویر بیومدیکال و الگوریتم‌های استاندارد تفکیک هسته‌های توده‌ای (Touching Nuclei) پیاده‌سازی شدند:

1. **تبدیل فاصله اقلیدسی دقیق (`SEG-05`, `SEG-09`, `SEG-16`):**
   - ایجاد ماژول [`image_processing/distance_transform.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/image_processing/distance_transform.rs).
   - پیاده‌سازی الگوریتم خطی Meijster/Saito در زمان $O(W \times H)$ با استفاده از پوشش‌های سهمی یک‌بعدی تفکیک‌پذیر.
   - تضمین صفر بودن دقیق فواصل پیکسل‌های پس‌زمینه و محاسبه صحیح فواصل اقلیدسی پیکسل‌های پیش‌زمینه تا لبه مرز.

2. **الگوریتم جداسازی واترشفد بر پایه نشانگرها (`SEG-04`, `SEG-09`, `SEG-17`):**
   - ایجاد ماژول [`image_processing/watershed.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/image_processing/watershed.rs).
   - استخراج قله‌های موضعی (Local Maxima) در نقشه EDT به عنوان بذرهای اولیه هسته‌ها (Nuclei Seeds).
   - سیلاب‌گذاری اولویت‌بندی شده با صف هیپ (`BinaryHeap` Priority Queue) برای تفکیک دقیق سلول‌ها و هسته‌های مماس و چسبیده به هم.

3. **فیلترهای دوبعدی ارتقای کیفیت و حذف نویز (`PROC-01`, `PROC-02`):**
   - ایجاد ماژول [`image_processing/filters.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/image_processing/filters.rs).
   - تارباز گوسی تفکیک‌پذیر ($O(K \times W \times H)$) با هسته ۱ بعدی عمودی و افقی.
   - فیلتر میانه دوبعدی پنجره‌ای برای حذف نویزهای نمک و فلفلی اسلایدهای آسیب‌دیده بافت‌شناسی.

4. **تنظیمات نور، گاما و کنتراست (`ADJ-01`, `ADJ-02`):**
   - ایجاد ماژول [`image_processing/adjustments.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/image_processing/adjustments.rs).
   - تصحیح کنتراست خطی، تعادل روشنایی و تنظیم توان گاما به صورت سریع در سطح بافر پیکسل.

5. **دستورات کنترلی Tauri IPC و یکپارچه‌سازی کتابخانه (`lib.rs`):**
   - ایجاد ماژول [`commands/image_processing.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/commands/image_processing.rs) شامل دستورات:
     - `proc_distance_transform`: محاسبه آنی نقشه فاصله اقلیدسی ماسک.
     - `proc_watershed`: تفکیک هسته‌های مماس و برچسب‌گذاری مجزای سلول‌ها.
     - `proc_gaussian_blur`: اعمال تارباز گوسی با سیگما و شعاع مشخص.
     - `proc_median_filter`: اعمال فیلتر میانه با شعاع دلخواه.
     - `proc_adjust`: تنظیمات روشنایی، کنتراست و گاما روی بافر تصویر علمی.

6. **تایپ‌های متناظر فرانت‌اند:**
   - فایل تعاریف تایپ‌اسکریپت در [`src/types/image-processing.ts`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/types/image-processing.ts).

7. **آزمون‌های خودکار یکپارچگی (Automated Test Suite):**
   - تست‌های تایید صحت در [`tests/processing_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/processing_tests.rs).
   - هر ۳ آزمون تبدیل فاصله اقلیدسی، حذف نویز گوسی/میانه و تفکیک واترشفد دو هسته چسبیده با موفقیت پاس شدند:
     ```text
     test test_distance_transform_on_square ... ok
     test test_gaussian_blur_and_median_noise_removal ... ok
     test test_watershed_splits_two_touching_nuclei ... ok
     test result: ok. 3 passed; 0 failed; 0 ignored; finished in 0.00s
     ```

---

## ۱۵. گزارش تکمیلی پیاده‌سازی فاز ۵: استنتاج هوش مصنوعی در مقیاس WSI و رمزگشایی چندضلعی StarDist (AI Inference & StarDist Polygon Adapters)

در فاز پنجم نقشه راه، موتور استنتاج یادگیری عمیق در مقیاس اسلایدهای کامل بافت‌شناسی (Whole Slide Images) و رمزگشایی چندضلعی‌های محدب ستاره‌ای (Star-Convex Polygons) منطبق با استانداردهای StarDist پیاده‌سازی شدند:

1. **رمزگشایی چندضلعی‌های ستاره‌ای و سرکوب غیربیشینه (`DLSEG-03`, `DLSEG-04`):**
   - ایجاد ماژول [`ai_segmentation/stardist.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/ai_segmentation/stardist.rs).
   - پیاده‌سازی الگوریتم StarDist 2D Ray Reconstruction با ۳۲ اشعه شعاعی ($\theta_k = 2\pi k / N$).
   - محاسبه دقیق مساحت چندضلعی به روش بند کفش (Shoelace Formula).
   - پیاده‌سازی الگوریتم Non-Maximum Suppression (NMS) چندضلعی بر اساس همپوشانی IoU جهت حذف کاندیداهای تکراری.

2. **برنامه‌ریزی کاشی‌کاری با همپوشانی برای اسلایدهای گیگاپیکسلی (`DLSEG-02`, `WSI-06`):**
   - ایجاد ماژول [`ai_segmentation/tiled_inference.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/ai_segmentation/tiled_inference.rs).
   - تقسیم هوشمند اسلایدهای چندگیگابایتی به شبکه‌ای از کاشی‌های منظم با همپوشانی (Overlap مثلا ۱۲۸ پیکسل).
   - انتقال مختصات محلی چندضلعی‌های استخراج‌شده در هر کاشی به مختصات مطلق فضای اسلاید WSI.
   - حذف همپوشانی‌های مرزی بین کاشی‌های مجاور با NMS سراسری چندضلعی‌ها بدون ایجاد خطوط درز (Stitch-Free Seamless Inference).

3. **تبدیل نمونه‌های هوش مصنوعی به ROI با کالیبراسیون میکرونی (`DLSEG-04`, `DLSEG-06`, `MLSEG-05`):**
   - اتصال مستقیم به سیستم مدیریت ROI و موتور اندازه‌گیری کمی.
   - استخراج خودکار مشخصات مورفومتریک (مساحت، محیط، کرویت، قطرهای فرت) برای تک‌تک هسته‌های تشخیص‌داده‌شده توسط هوش مصنوعی با واحد میکرومتر ($\mu m$).

4. **دستورات کنترلی Tauri IPC و یکپارچه‌سازی (`commands/ai_segmentation.rs` و `lib.rs`):**
   - `ai_stardist_decode`: رمزگشایی نقشه احتمال و اشعه‌ها و تولید لیست چندضلعی‌ها.
   - `ai_wsi_plan_tiles`: برنامه‌ریزی شبکه کاشی‌های همپوشان برای استنتاج سراسری اسلاید.
   - `ai_stardist_to_rois`: تبدیل چندضلعی‌های کشف‌شده به آیتم‌های ROI استاندارد با اندازه‌گیری کمی و نام‌گذاری هسته‌ها.

5. **تایپ‌های متناظر فرانت‌اند:**
   - فایل تعاریف تایپ‌اسکریپت در [`src/types/ai-segmentation.ts`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/types/ai-segmentation.ts).

6. **آزمون‌های خودکار یکپارچگی (Automated Test Suite):**
   - تست‌های تایید صحت در [`tests/ai_segmentation_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/ai_segmentation_tests.rs).
   - هر ۳ آزمون با موفقیت کامل پاس شدند:
     ```text
     test test_wsi_tiled_inference_planning_and_deduplication ... ok
     test test_stardist_nms_suppression ... ok
     test test_stardist_polygon_decoding ... ok
     test result: ok. 3 passed; 0 failed; 0 ignored; finished in 0.00s
     ```

---

## ۱۶. گزارش تکمیلی پیاده‌سازی فاز ۶: هم‌راستاسازی و رجیستریشن چند اسلایدی (Multi-Image Registration & Alignment)

در فاز ششم، موتور انطباق فضایی تصاویر و اسلایدهای پاتولوژی متوالی پیاده‌سازی شد (`REG-01` تا `REG-08`):
1. **ماتریس تبدیل آفین دو بعدی و بازنمونه‌برداری دوخطی (`REG-02`, `REG-03`, `REG-05`):**
   - ماژول [`registration/transform.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/registration/transform.rs).
   - پشتیبانی از ترکیب ماتریس‌های دوران، انتقال، مقیاس و معکوس‌پذیری.
   - بازنمونه‌برداری سریع با نگاشت معکوس و درونیابی دوخطی (Bilinear Interpolation).
2. **تخمین ماتریس تبدیل از روی نقاط لندمارک با کمترین مربعات (`REG-03`, `REG-04`):**
   - ماژول [`registration/landmark.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/registration/landmark.rs) با حل معادلات نرمال ماتریس $3 \times 3$.
3. **معیارهای سنجش کیفیت انطباق و تصویر تفاضلی (`REG-06`, `REG-08`):**
   - ماژول [`registration/metrics.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/registration/metrics.rs) شامل خطای میانگین مربعات (MSE) و همبستگی نرمال‌شده متقابل (NCC) و تصویر تفاضلی.
4. **آزمون‌های تایید صحت:** هر ۳ آزمون در [`tests/registration_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/registration_tests.rs) با موفقیت پاس شدند (`3 passed; 0 failed`).

---

## ۱۷. گزارش تکمیلی پیاده‌سازی فاز ۷: کلوکالیزیشن و جهت‌یافتگی فیبرها (Colocalization & Directionality)

در فاز هفتم، ابزارهای تخصصی بیومارکرهای چندگانه و تحلیل سازمان‌یافتگی کلاژن پیاده‌سازی شدند (`COLOC-01..06`, `DIR-01..05`):
1. **تحلیل آماری کلوکالیزیشن پیرسون و مندرز (`COLOC-02`, `COLOC-03`, `COLOC-04`):**
   - ماژول [`spatial_analysis/colocalization.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/spatial_analysis/colocalization.rs).
   - محاسبه ضریب پیرسون (PCC)، ضرایب تفکیکی مندرز ($M_1, M_2$) و آستانه‌گذاری خودکار Costes.
   - نقشه مکانی PDM (Product of the Differences from the Mean) جهت تمایز نواحی همبستگی مثبت از تفکیک بافتی.
2. **تحلیل جهت‌یافتگی و ناهمسانگردی فیبرهای کلاژن (`DIR-02`, `DIR-03`, `DIR-04`):**
   - ماژول [`spatial_analysis/directionality.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/spatial_analysis/directionality.rs).
   - استخراج گرادیان سوبل دوبعدی، ساخت هیستوگرام زوایا در بازه $[0, 180^\circ)$، محاسبه زاویه غالب، پراکندگی زاویه‌ای و شاخص ناهمسانگردی (Anisotropy Index).
3. **آزمون‌های تایید صحت:** هر ۳ آزمون در [`tests/spatial_analysis_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/spatial_analysis_tests.rs) با موفقیت پاس شدند (`3 passed; 0 failed`).

---

## ۱۸. گزارش تکمیلی پیاده‌سازی فاز ۸: اسکلت‌بندی و گراف شاخه‌ای فیلامنت‌ها (Skeletonization & Morphometry)

در فاز هشتم، موتور استخراج اسکلت بافت و عروق و درخت‌های عصبی پیاده‌سازی شد (`SKEL-01..08`):
1. **الگوریتم باریک‌سازی باینری Zhang-Suen (`SKEL-01`):**
   - ماژول [`skeleton/thinning.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/skeleton/thinning.rs) با تضمین حفظ توپولوژی و کاهش ساختارها به خطوط تک‌پیکسلی.
2. **طبقه‌بندی توپولوژیک پیکسل‌ها و ردیابی شاخه‌ها (`SKEL-02`, `SKEL-03`, `SKEL-04`):**
   - ماژول [`skeleton/graph.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/skeleton/graph.rs).
   - شناسایی خودکار نقاط انتهایی (Endpoints: 1 neighbor)، بدنه مسیر (Slab: 2 neighbors) و گره‌های تقاطع (Junctions: $\ge 3$ neighbors).
   - ردیابی مسیر شاخه‌ها و محاسبه طول شاخه‌ها به پیکسل و میکرومتر با ضریب کالیبراسیون فیزیکی.
3. **آزمون‌های تایید صحت:** هر ۳ آزمون در [`tests/skeleton_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/skeleton_tests.rs) با موفقیت پاس شدند (`3 passed; 0 failed`).

---

## ۱۹. گزارش تکمیلی پیاده‌سازی فاز ۹: گردش‌کار، ماکرو و گزارش پژوهشی (Workflow Automation & Audit Trail)

در فاز نهم، سامانه پایش عملیات، ثبت ماکرو و تولید گزارش پژوهشی پیاده‌سازی شد (`WF-01..06`, `AUTO-01..06`):
1. **ضبط‌کننده خط سیر پردازش علمی (Workflow & Macro Recorder - `WF-01`, `WF-02`):**
   - ماژول [`workflow/recorder.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/workflow/recorder.rs).
   - ثبت دقیق نام دستور، پارامترهای ساختاریافته JSON، زمان دقیق UTC، مدت زمان اجرا به میلی‌ثانیه و وضعیت موفقیت/شکست جهت بازتولیدپذیری پژوهشی.
2. **تولیدکننده گزارش نهایی پاتولوژی و مورفومتری (`WF-06`, `ANA-06`):**
   - ماژول [`workflow/report.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/src/workflow/report.rs).
   - تولید اسناد فرمت‌بندی‌شده مارک‌داون شامل جداول آماری سلول‌ها، مساحت متوسط، کرویت، کسر بیومارکر و خط سیر حسابرسی پردازش.
3. **آزمون‌های تایید صحت:** هر ۲ آزمون در [`tests/workflow_tests.rs`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src-tauri/tests/workflow_tests.rs) با موفقیت پاس شدند (`2 passed; 0 failed`).

---

## ۲۰. گزارش تکمیلی فاز ۱۰: اتصال رابط کاربری (Frontend UI Tooling & Viewport Integration)

در راستای تکمیل چرخه پیاده‌سازی و اتصال کامل لایه Backend به رابط کاربری (طبق اصل ۰.۲ و بند ۶ بخش ۴۴ سند `options.md`):

1. **ابزار تحلیل فضایی و انطباق (`src/components/tools/SpatialAnalysis.tsx`):**
   - **کلوکالیزیشن کانال‌ها:** بارگذاری همزمان دو کانال فلورسنت/بافت‌شناسی، محاسبه ضریب پیرسون (PCC)، ضرایب مندرز ($M_1, M_2$) و رندر بومی نقشه حرارتی PDM روی کانواس.
   - **جهت‌یافتگی ساختارها:** محاسبه توزیع گرادیان سوبل فیبرها، هیستوگرام تعاملی زاویه‌ای، زاویه غالب و شاخص ناهمسانگردی (Anisotropy Index).
   - **انطباق اسلایدها:** تخمین آفین با کنترل‌پوینت‌های لندمارک، بازنمونه‌برداری دوخطی تصویر متحرک و نمایش شاخص‌های MSE و NCC به همراه پیش‌نمایش تصویر منطبق‌شده.

2. **ابزار مورفومتری فیلامنت و گزارش پژوهشی (`src/components/tools/Morphometry.tsx`):**
   - **اسکلت‌بندی و توپولوژی:** بارگذاری ماسک باینری، اعمال باریک‌سازی Zhang-Suen، رندر اسکلت تک‌پیکسلی، نمایش گراف شاخه‌ها، نقاط انتهایی، تقاطع‌ها و طول کل مسیرها به میکرومتر.
   - **واترشفد:** تفکیک هسته‌های سلولی به‌هم‌چسبیده با تبدیل فاصله و گزارش تعداد سلول‌ها و زمان اجرا.
   - **گزارش پژوهشی پاتولوژی:** دریافت داده‌های بالینی و پاتولوژیک نمونه، تلفیق با خط سیر ثبتی ماکرو و پایپ‌لاین، تولید سند مارک‌داون استاندارد با قابلیت کپی فوری.

3. **یکپارچه‌سازی در مسیریابی و داشبورد اصلی:**
   - افزودن مسیرهای `/spatial-analysis` و `/morphometry` در [`src/App.tsx`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/App.tsx).
   - افزودن کارت‌های لانچر ماژول در صفحه اصلی [`src/components/pages/Home.tsx`](file:///d:/My%20Fucking%20Projects/TissueAI_Rust/TissueAI/src/components/pages/Home.tsx).
   - تایید صحت بیلد کلاینت و تایپ‌اسکریپت: `npx tsc --noEmit` با ۰ خطا و `npm run build` با خروجی پایدار Vite در ۶۸ ثانیه.

