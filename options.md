# TissueAI — ImageJ & Fiji Capability Expansion Specification

**نسخه سند:** 2.0 — بازنویسی معماری‌محور برای TissueAI  
**تاریخ بازنگری:** 2026-11-11  
**نوع سند:** ممیزی قابلیت‌ها + قرارداد مهندسی و پیاده‌سازی  
**مرجع قابلیت‌ها:** ImageJ 1.x، ImageJ2، Fiji و افزونه‌های منتخب علمی  
**محصول مقصد:** TissueAI — نرم‌افزار دسکتاپ بومی/هیبرید برای Digital Pathology، Computational Histology، WSI و تحلیل AI محلی

---

## 0. هدف، دامنه و قواعد غیرقابل مذاکره برای ایجنت پیاده‌سازی

این سند برای ارتقای **کدبیس موجود TissueAI** نوشته شده است، نه ساخت یک نرم‌افزار جدید و نه بازنویسی پروژه از ابتدا. فهرست قابلیت‌های ImageJ/Fiji در بخش‌های بعدی، بانک قابلیت‌هاست؛ ایجنت باید قابلیت‌های واقعاً غایب یا ناقص را به معماری فعلی TissueAI اضافه کند.

### 0.1 معماری مرجع ارائه‌شده برای TissueAI

این معماری، قرارداد طراحی‌ای است که کاربر برای پروژه اعلام کرده است. با این حال، ایجنت باید در ابتدای کار آن را با فایل‌های واقعی `Cargo.toml`، `package.json`، کدهای موجود و نسخه‌های نصب‌شده تطبیق دهد. هیچ نسخه یا قابلیتی صرفاً به دلیل ذکر شدن در این سند، موجود یا عملیاتی فرض نشود.

```text
TissueAI/
├── src/                                  # React 19 + TypeScript + Vite + Tailwind
│   ├── components/
│   │   ├── anatomy/                     # نمایشگر سه‌بعدی آناتومی
│   │   ├── pages/                       # Home, Settings, Help, About
│   │   └── tools/
│   │       ├── Detection.tsx
│   │       ├── MultiSlide.tsx
│   │       ├── ColorAnalysis.tsx
│   │       ├── Segmentation.tsx
│   │       ├── Editor.tsx
│   │       ├── Trainable.tsx
│   │       └── ThreeViewer/
│   ├── hooks/
│   └── pages/llm/
│
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                       # Tauri command/event registration
│   │   ├── crypto.rs                    # مدل‌های رمزنگاری‌شده و بارگذاری امن
│   │   ├── hardware_id.rs
│   │   ├── commands/
│   │   │   ├── detection.rs
│   │   │   ├── color_analysis.rs
│   │   │   ├── segmentation.rs
│   │   │   ├── trainable.rs
│   │   │   ├── editor.rs
│   │   │   ├── three_d.rs
│   │   │   └── multi_slide.rs
│   │   ├── tools/
│   │   │   ├── detection/
│   │   │   └── segmentation/
│   │   └── llm/
│   │       ├── server.rs
│   │       ├── runtime.rs
│   │       ├── models.rs
│   │       └── provider_secrets.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── scripts/
│   └── encrypt_model.py                 # ابزار توسعه/بسته‌بندی؛ نه runtime وابسته به Python
└── public/                              # assets استاتیک و مدل‌های GLB/GLTF
```

### 0.2 اصل معماری: رابط کاربری فقط نمایش و تعامل؛ Rust مالک پردازش است

- React/TypeScript مسئول نمایش، state رابط، فرم پارامترها، تعامل با canvas، مدیریت انتخاب کاربر، نمودارها، overlayها، جدول نتایج و ارسال درخواست است.
- Rust مسئول خواندن و نوشتن تصویر، decode، ساخت tile، محاسبات پیکسلی، فیلترها، آمار، segmentation، connected components، morphology، مدل‌های ONNX، inference، batch، persistence، رمزنگاری و orchestration پردازش‌های سنگین است.
- فرانت‌اند نباید برای سادگی، تصویر WSI را به آرایه عظیم JSON تبدیل کند یا محاسبات سنگین Pixel/Matrix/Segmentation را در کامپوننت React انجام دهد.
- Three.js و `@react-three/fiber` فقط برای رندر و تعامل سه‌بعدی استفاده شوند؛ محاسبات حجمی/تحلیلی و آماده‌سازی داده در Rust انجام شود. نمایشگر مدل‌های آناتومیک GLB/GLTF با نمایش حجم میکروسکوپی 3D دو مفهوم جدا هستند و نباید به‌اشتباه یکی تلقی شوند.
- Python فقط برای ابزارهای توسعه، آماده‌سازی یا رمزنگاری مدل و pipelineهای مهندسی مجاز است؛ نصب Python یا اجرای اسکریپت Python نباید پیش‌نیاز اجرای محصول نهایی باشد، مگر یک integration اختیاری و کاملاً مستند با تأیید صریح کاربر.

### 0.3 پیش از هر تغییر: ممیزی واقعی پروژه

ایجنت ابتدا کل کدبیس را بررسی کند و گزارش بسازد. حداقل موارد زیر باید بررسی شوند:

1. نسخه واقعی Tauri، Rust Edition، `ort`، ONNX Runtime، `burn`، `image`، `ndarray`، Tokio و تمام crateهای مرتبط؛ نسخه‌های اعلام‌شده در این سند فقط سرنخ هستند.
2. نسخه واقعی React، TypeScript، Vite، Tailwind، Zustand، Three.js، Radix و کتابخانه‌های نمودار/انیمیشن.
3. commandها و eventهای ثبت‌شده در `lib.rs`، state مشترک Rust، پنجره‌ها و capability/permissionهای Tauri.
4. مدل فعلی تصویر، pixel buffer، metadata، ROI، calibration، mask، label، segmentation، detection، project و export.
5. نحوه فعلی باز کردن تصاویر، WSI، tile، pyramidal TIFF، زوم، pan، cache، memory mapping و محدودیت RAM.
6. چرخه عمر ONNX session، بارگذاری مدل `.onnx` و `.enc`، device provider، GPU، VRAM، NMS، preprocessing و postprocessing.
7. سازوکار اجرای Burn، پشتیبانی واقعی backendها، checkpoint، serialization و امکان export مدل.
8. ابزار `encrypt_model.py`، قالب فایل رمز‌شده، مدیریت کلید، keyring، hardware ID و رفتار بازیابی خطا.
9. مسیرهای ذخیره‌سازی پروژه، تنظیمات، history، annotation، نتایج، مدل‌ها و crash recovery.
10. تست‌ها، داده‌های fixture، logها، benchmarkها، CI، build و package در Windows/macOS/Linux.

### 0.4 وضعیت هر قابلیت باید با شواهد تعیین شود

برای هر ID از این سند یکی از وضعیت‌های زیر ثبت شود:

- `EXISTS_COMPLETE`: UI، engine، ذخیره‌سازی/خروجی، مدیریت خطا و تست همگی کار می‌کنند.
- `EXISTS_PARTIAL`: بخشی از workflow وجود دارد ولی یک یا چند جزء ضروری ناقص است.
- `MISSING`: هیچ پیاده‌سازی هم‌ارز وجود ندارد.
- `BLOCKED_DEPENDENCY`: وابسته به کتابخانه، فرمت، مدل، مجوز، سیستم‌عامل یا سخت‌افزار موجودنیست.
- `NOT_APPLICABLE`: برای دامنه فعلی TissueAI منطقی نیست؛ دلیل باید ذکر شود.
- `NEEDS_VALIDATION`: کد وجود دارد اما صحت علمی/عددی یا عملکرد آن اثبات نشده است.

وجود نام یک فایل، دکمه، منو یا تابع به معنی تکمیل قابلیت نیست. برای `EXISTS_COMPLETE` باید مسیر واقعی از UI تا Rust و نتیجه قابل مشاهده و آزمون‌شده باشد.

### 0.5 خروجی اجباری ممیزی

فایل `docs/imagej_fiji_capability_audit.md` (یا مسیر مستندات موجود پروژه) بسازید:

| ID | قابلیت | مرجع ImageJ/Fiji | وضعیت | مسیر کد موجود | شواهد رفتاری | شکاف دقیق | وابستگی | اولویت | تست لازم |
|---|---|---|---|---|---|---|---|---|---|

بعد از ممیزی، یک برنامه پیاده‌سازی مرحله‌ای ایجاد کنید. **تا زمان تکمیل ممیزی و ارائه gap analysis، تغییرات گسترده را شروع نکنید.**

### 0.6 قواعد سخت‌گیرانه مهندسی

1. معماری Tauri v2 + React/TypeScript + Rust را حفظ کنید؛ پروژه را به Java/ImageJ یا Electron تبدیل نکنید.
2. منطق تحلیل تصویر را در Rust نگه دارید. فرانت‌اند فقط state و presentation را مدیریت کند.
3. هیچ وابستگی runtime به Python، Java، سرویس ابری یا API بیرونی اضافه نکنید، مگر به‌صورت adapter اختیاری، آگاهانه و قابل خاموش کردن.
4. از Cargo dependencies فعلی تا حد امکان استفاده کنید. crate جدید فقط پس از بررسی maintenance، license، platform support، اندازه binary، امنیت، عملکرد و سازگاری نسخه اضافه شود.
5. فرمت‌های WSI را با decoderهای تخصصی و آزموده‌شده پشتیبانی کنید؛ ادعا نکنید crate عمومی `image` تمام فرمت‌های WSI را می‌خواند.
6. فایل چند گیگابایتی را کامل وارد RAM نکنید. معماری tiled/pyramidal/lazy و cache محدود لازم است.
7. تصویر اصلی باید immutable یا read-only باشد. تغییرات، خروجی مشتق‌شده/versioned باشند؛ عملیات تخریبی فقط با تأیید روشن.
8. pixel values، display range، LUT، overlay، annotation، binary mask، label map و probability map باید از هم تفکیک شوند.
9. bit depth، signedness، precision، channel، axes، Z/T، calibration، physical units، orientation و metadata را بدون اجازه تغییر ندهید.
10. محاسبات CPU-bound را روی Tokio async worker عادی اجرا نکنید؛ از thread pool/`spawn_blocking` یا سازوکار محاسباتی معتبر و محدود استفاده کنید.
11. payloadهای چندصد مگابایتی را از طریق JSON IPC عبور ندهید. داده تصویر با tile/resource handle و transport مناسب منتقل شود؛ JSON فقط برای metadata و کنترل باشد.
12. هر job سنگین باید `job_id`، پیشرفت، مرحله، قابلیت Cancel، نتیجه، خطا و cleanup قطعی داشته باشد.
13. برای هر الگوریتم، نوع داده، ابعاد پشتیبانی‌شده، واحدها، مرزها، فرضیات، محدودیت‌ها و tolerance عددی مشخص باشد.
14. دکمه نمایشی، placeholder، خروجی mock، مقدار ساختگی یا منوی بدون backend ممنوع است.
15. هیچ قابلیت research را به‌عنوان تشخیص پزشکی معتبر یا ابزار clinical-grade معرفی نکنید مگر اعتبارسنجی مستقل و مسیر قانونی مربوطه وجود داشته باشد.
16. اطلاعات بیمار/نمونه از دستگاه خارج نشود مگر کاربر صریحاً یک قابلیت شبکه‌ای را فعال و تأیید کند.
17. لایسنس کد، مدل و dataset بررسی شود. انتشار سورس TissueAI مجوز خودکار برای توزیع وزن مدل‌های ثالث نیست.
18. بعد از هر فاز، build، test، benchmark و regression test اجرا شود.

### 0.7 تعریف تکمیل یک قابلیت

هر قابلیت فقط زمانی complete است که لایه‌های زیر (در صورت کاربرد) کامل باشند:

- **UI:** مسیر دسترسی مناسب، کنترل‌ها، validation، حالت loading/empty/error، progress و cancel.
- **Rust Engine:** الگوریتم واقعی، ورودی/خروجی typed، ابعاد/فرمت‌های مجاز و مدیریت edge case.
- **IPC:** request/response type-safe، بدون انتقال غیرضروری داده حجیم، خطای استاندارد و cancellation.
- **Data/Storage:** metadata، units، provenance، version، stable IDs و persistence.
- **Visualization:** overlay یا خروجی مناسب بدون تغییر source pixels.
- **Export:** خروجی استاندارد و قابل بازتولید در صورت نیاز.
- **Tests:** unit، integration، golden/reference و regression tests متناسب با ریسک.
- **Performance:** benchmark روی داده واقعی و WSI، memory budget و عدم مسدودشدن UI.

---

## 1. محدوده ImageJ/Fiji و اولویت قابلیت‌ها

### 1.1 تفاوت ImageJ، ImageJ2 و Fiji

ImageJ 1.x نرم‌افزار اصلی پردازش تصویر علمی است؛ ImageJ2 معماری مدرن‌تر و مدل داده چندبعدی را گسترش می‌دهد؛ Fiji توزیعی آماده از ImageJ/ImageJ2 همراه مجموعه‌ای از افزونه‌های علمی است. Fiji یک موتور مستقل از ImageJ نیست و یک فهرست ثابت از تمام افزونه‌های ممکن هم ندارد. قابلیت‌های واقعی به نسخه، Update Siteها و افزونه‌های نصب‌شده وابسته‌اند.

TissueAI قرار نیست JVM یا سازوکار pluginهای Java را تقلید کند. قابلیت علمی را باید به native Rust service، command Tauri و UI React مناسب تبدیل کرد؛ در صورت نیاز، فقط از adapter اختیاری استفاده شود.

### 1.2 برچسب دسترس‌پذیری

- `CORE`: قابلیت عمومی ImageJ.
- `IMAGEJ2`: مدل داده/زیرساخت ImageJ2.
- `FIJI-COMMON`: ابزار رایج در توزیع Fiji، ولی وابسته به نسخه.
- `EXTENSION`: افزونه جداگانه، کتابخانه یا runtime مستقل.
- `OPTIONAL-RESEARCH`: ابزار تخصصی برای حوزه‌های پژوهشی خاص.
- `TISSUEAI-ADAPTATION`: قابلیت بازطراحی‌شده برای معماری Rust/Tauri؛ الزاماً معادل مستقیم ImageJ نیست.

### 1.3 اولویت‌بندی ویژه TissueAI

- **P0 — صحت داده و قابلیت پایه:** typed image model، metadata، calibration، WSI viewer tile-based، ROI/annotation، اندازه‌گیری، processing پایه، project save، job lifecycle.
- **P1 — پاتولوژی دیجیتال روزمره:** WSI format adapters، stain deconvolution، segmentation، nuclei/cell morphometry، batch slides، heatmap، export و گزارش.
- **P2 — تحلیل پیشرفته:** مدل‌های pixel classifier و DL، instance segmentation، tracking در time-lapse، registration، 3D volume analysis، colocalization.
- **P3 — افزونه‌های تخصصی:** deconvolution میکروسکوپی، neurite tracing، bone morphometry، directionality، GPU specialist operations و extension adapters.

اولویت نهایی فقط پس از ممیزی کد تعیین شود. قابلیت P3 که اکنون در TissueAI موجود و معتبر است حذف نشود؛ قابلیت P0 موجود و کامل نیز دوباره‌نویسی نشود.

# PART A — IMAGEJ CORE CAPABILITIES

## 2. Scientific image data model and workspace

**IDs: DATA-01–DATA-14 | Availability: CORE + IMAGEJ2 | Priority: P0**

### DATA-01 — Typed pixel data

Support without premature conversion:

- 8-bit unsigned grayscale (`uint8`).
- 16-bit unsigned grayscale (`uint16`).
- 16-bit signed data when source format requires it.
- 32-bit floating point (`float32`).
- RGB/multi-component color.
- Indexed/palette color for display/legacy images.
- Extensible types for future higher-bit-depth scientific data.

Requirements: distinguish stored values from display values; preserve bit depth/signedness; handle NaN, ±infinity, overflow, underflow, and divide-by-zero; make conversion policy explicit (clamp/rescale/preserve/reject); warn about lossy conversion.

### DATA-02 — N-dimensional axes

Use an explicit axis model rather than assuming every image is a flat 2D bitmap.

- `X`, `Y`: spatial pixel dimensions.
- `C`: channel (DAPI, FITC, TRITC, Cy5, RGB components, etc.).
- `Z`: optical/physical depth.
- `T`: time/frame.
- Leave room for positions, tiles, views/angles, scenes, wavelengths, and acquisition-specific dimensions.

For each axis preserve length, type, source order, mapping, spacing/unit, origin/offset, labels, and per-plane metadata. Never interchange Z and T or silently reorder C/Z/T.

### DATA-03 — Spatial calibration and units

Store pixel width/height, voxel depth, time interval, unit per axis (µm, nm, mm, pixel, seconds, etc.), optional origin/transform, calibration source, and validity (`known`, `user_defined`, `missing`, `conflicting`).

Allow calibration from a known distance and a drawn line; set aspect ratio, Z spacing, and frame interval; apply to one image or a selected dataset. Measurements use physical units only when calibration is valid. Never invent scale; warn on missing/conflicting calibration.

### DATA-04 — Metadata preservation

Preserve dimensions, pixel type, channel labels, acquisition date, instrument/objective, exposure, detector, illumination, wavelength, gain, binning, stage position, plate/well/site, file/plane metadata, OME-XML, DICOM metadata, source path/name, import settings, import time, and optional checksum. Provide searchable structured and raw metadata views and metadata comparison.

### DATA-05 — Immutable source and derived data

Keep raw source immutable or read-only by default. Store derived images as versioned assets. Record operation ID, parameters, timestamp, software version, input/output IDs, warnings, and elapsed time. Allow duplication/rename/archive/delete of derived assets. Make in-place destructive operations an advanced explicit option.

### DATA-06 — Stacks and hyperstacks

Support 2D images, 3D Z-stacks, 2D time series, 4D volumes over time, and 5D C/Z/T hyperstacks. Support virtual/on-disk stacks. Expose current channel, Z, time, position, and axis sizes.

### DATA-07 — Image properties

Display width, height, C/Z/T sizes, pixel type/bit depth, calibration, units, frame interval, slice spacing, title, source path, metadata state, and channel labels. Validate editable fields.

### DATA-08 — Multi-image workspace

Multiple images, tabs/window list, switching without losing ROI/view state, linked channels/registered images, pin/favorites, close one/all with unsaved warnings, and explicit active-image identity.

### DATA-09 — Clipboard and duplication

Copy selected pixels or full image; paste; create image from clipboard; duplicate full image, ROI, selected planes, or channels. Preserve data type where possible and warn on conversion.

### DATA-10 — Undo/redo

Undo safe image operations and annotation edits. For large operations use reversible processing nodes, copy-on-write, tiled deltas, or disclose that an operation cannot be undone. Never advertise undo when unavailable.

### DATA-11 — Image comparison

Side-by-side and synchronized compare for source/processed, channels, segmentation/source, before/after. Support linked zoom/pan and optional linked Z/T navigation.

### DATA-12 — Pixel inspector

On hover/click display X/Y, C/Z/T, raw pixel values, rendered color, physical coordinates when calibrated, segmentation label/class, and ROI membership. Allow copy.

### DATA-13 — Image arithmetic compatibility

Define compatibility rules for dimensions, axes, calibration, channels, data types, broadcasting, and alignment. Reject ambiguous operations or ask for an explicit policy.

### DATA-14 — Sample data

Provide legal sample images and synthetic arrays/volumes for grayscale, RGB, multichannel, Z-stack, time-series, histology, nuclei, and masks. Record license/source.

---

## 3. File input, import, export, and conversion

**IDs: IO-01–IO-25 | Availability: CORE + IMAGEJ2 + Bio-Formats extension | Priority: P0/P1**

### IO-01 — Standard image opening

Support formats available in the selected backend, such as TIFF, PNG, JPEG, BMP, GIF, PGM, FITS, and DICOM where its encoding is supported. Detect format from content where safe. Provide useful errors for unsupported/corrupt/truncated files.

### IO-02 — Drag-and-drop and recent files

Drag files/folders; recent-file list with path/thumbnail/time; reopen recent projects; detect moved/missing sources and offer relinking.

### IO-03 — Folder/image-sequence importer

Options: filename filter; natural/numeric ordering; start index; count; increment; recursive scan; extension filters; dimensions/type validation; skipped-file report; assign files as Z, T, C, or separate images; preview downsample only; virtual stack; estimated dimensions/memory before import.

### IO-04 — Raw binary importer

Controls: width, height, image/slice/frame count, pixel type/signedness, endianness, header offset, row stride/padding if supported, interleaved/planar channels, axis order, calibration, preview, file-size consistency check. Never guess layout silently.

### IO-05 — Text-image importer

Import tabular numeric text as a numeric image. Detect delimiter, matrix dimensions, decimal separator, header rows, missing values, malformed cells. Preview matrix and report dimensions.

### IO-06 — Video/time-lapse import

Where codecs exist, import video as a time stack. Expose frame rate/range/step, codec, color interpretation, frame extraction. Warn about compression artifacts and preserve timing metadata.

### IO-07 — URL/remote import (optional)

Only through explicit action. Show URL/type/size/progress/destination. Prefer local cache. Never execute remote content.

### IO-08 — Bio-Formats-compatible importer

**High-priority microscopy integration.** Prefer Bio-Formats or another mature compatible reader over hand-coding vendor formats.

- Read supported proprietary/open life-sciences formats.
- Show series and image count.
- Inspect metadata before import.
- Select series, channels, Z planes, time range, resolution level where supported.
- Grayscale/composite/color/split-channel modes where meaningful.
- Autoscale display without altering stored pixels.
- Import supported ROIs.
- Crop on import.
- Normal or virtual/on-disk loading.
- Preview dimensions and memory estimate.
- Show dimension mapping/order (e.g., XY-C-Z-T).
- Preserve OME metadata/calibration.
- Metadata-only inspection for large files.
- Warnings for incomplete proprietary metadata.

Use the current installed reader's supported-format list; do not hard-code historic format counts.

### IO-09 — DICOM

Support series grouping, instance ordering, pixel spacing, slice thickness/position, orientation, rescale slope/intercept, photometric interpretation, window center/width, and transfer syntax. Verify compressed transfer syntax support; do not assume all DICOM is uncompressed. Preserve geometry and rescale values. Keep identifying tags private by default and offer de-identification. Do not mislabel radiology DICOM as histology.

### IO-10 — TIFF and OME-TIFF

Preserve pixel type, plane order, C/Z/T axes, physical calibration, channel labels/wavelengths, OME-XML, and ImageJ metadata where applicable. Support BigTIFF via an appropriate backend. Do not assume every TIFF variant opens in a minimal TIFF decoder.

### IO-11 — Bio-Formats exporter

Where installed, offer OME-TIFF/OME-XML, TIFF/BigTIFF, PNG, JPEG, JPEG-2000, AVI, QuickTime, and other actually supported output formats. Validate preservation of dimensions, pixels, metadata, and calibration.

### IO-12 — Save as/export options

Native project; TIFF/OME-TIFF; PNG; JPEG with lossy warning; BMP/GIF where useful; raw with byte order/no-header warning; text matrix; image sequence; video where available; ROI; measurement CSV/TSV; masks/labels; overlays; provenance.

### IO-13 — Image-sequence export

Export selected planes individually. Controls: prefix, start index, zero-padding, axis naming, format, destination, overwrite policy. Include C/Z/T/position/series identifiers to prevent collisions.

### IO-14 — Save ROI

Save one ROI or an archive. Preserve type, geometry, name, group, color/stroke, plane association, and coordinate/calibration metadata where format permits.

### IO-15 — Save measurements

Export selected/all results to CSV/TSV with column names, units, image/ROI labels, analysis ID, numeric values, and stable precision.

### IO-16 — Save LUT

Import/export LUTs as display settings, not changes to raw intensities.

### IO-17 — Save XY coordinates

Export line/contour coordinates with origin convention, pixel/physical units, and pixel-center vs boundary convention.

### IO-18 — Batch folder import/export

Process a selected folder with pipeline, naming, skip/overwrite policy, dry run, and summary report.

### IO-19 — Import validation report

Show file/format, dimensions, axes, pixel type, metadata, calibration, series/plane count, and warnings after import.

### IO-20 — Format capability registry

At runtime list installed readers/writers and supported dimensions, data types, metadata read/write, random access, compression, channel/stack support. Never offer unsupported export.

### IO-21 — Checksums/integrity

Optionally checksum source, detect changes on relink, verify outputs can reopen, and store validation in provenance.

### IO-22 — Autosave/recovery

Atomic autosave of project metadata and annotations; recover after crash; never overwrite the sole source copy.

### IO-23 — Relink missing data

Relink one file or a folder using names/checksums; show unresolved assets.

### IO-24 — Export selected planes/region

Export ROI, channels, Z/T range, or crop with calibration/axes preserved where supported.

### IO-25 — Privacy controls

DICOM de-identification, metadata inspection before sharing, output metadata retention settings, identifier warnings for image/file names.

---

## 4. Image viewer, display, and navigation

**IDs: VIEW-01–VIEW-21 | Availability: CORE + IMAGEJ2 + FIJI-COMMON | Priority: P0/P1**

### VIEW-01 — 2D canvas
Smooth zoom, fit-to-window, pan, 1:1, navigator/minimap, zoom around cursor, nearest-neighbor inspection option. Display interpolation must be separate from scientific data.

### VIEW-02 — Stack navigation
Slice slider/numeric entry, first/previous/next/last, keyboard shortcuts, current/total count, optional thumbnails, jump to Z.

### VIEW-03 — Hyperstack navigation
Independent C/Z/T selectors and sliders, axis indices, jump-to-index, linked navigation, preservation of dimension order when converting stack↔hyperstack.

### VIEW-04 — Channel controls/compositing
Toggle channels, per-channel color/range, grayscale/color/composite modes, opacity/weight, split channels, merge grayscale display channels, labels/wavelength. Do not modify raw channels just to render a composite.

### VIEW-05 — Brightness/contrast
Display min/max, auto contrast, reset, numeric range, current channel/all channels/all slices. Distinguish display-only from pixel normalization.

### VIEW-06 — Threshold visualization
Colored preview overlay, lower/upper bounds, threshold method, dark/light background, ROI scope, histogram, select thresholded pixels, create mask separately. Preview cannot alter source.

### VIEW-07 — LUTs
Grayscale, inverted grayscale, spectrum, fire, thermal, other installed LUTs; import/export, range control, reset. Explain LUT does not alter raw values.

### VIEW-08 — Overlays
Non-destructive ROI, segmentation contours, labels, scale bars, text, timestamps, landmarks, measurement annotations. Provide layer ordering, visibility, per-object color/fill/alpha/stroke/font, channel/plane visibility, burn-in only to a copy, save/load with project.

### VIEW-09 — Scale/calibration bar
Physical length/unit, position, colors, font, bold, decimals, opacity; update on calibration change; burn into copy only.

### VIEW-10 — Image labels/timestamps
Frame numbers, slice labels, timestamps, text, sequential labels; start/interval/range/format/font/position; overlay-based by default.

### VIEW-11 — Orthogonal views
XY/XZ/YZ for calibrated 3D with synchronized crosshair/coordinate readout. Respect anisotropic spacing; show missing calibration.

### VIEW-12 — 3D/4D playback
Play time series or Z stack; FPS, loop/ping-pong, pause/step; distinguish Z browsing from time playback; export movie when supported.

### VIEW-13 — Pixel inspector
Raw and rendered values per channel, neighborhood, physical coordinates, label ID, metadata at current plane; copy.

### VIEW-14 — Color picker
Foreground/background and annotation colors; do not change source pixels unless explicitly drawing into a derived image.

### VIEW-15 — 3D preview controls
Camera rotation/zoom/pan/reset, background, axes, clipping, lighting, snapshot when renderer installed.

### VIEW-16 — Window management
Tile/cascade/arrange/focus/hide/close current/close all, open-image list, unique identity for duplicate titles, restore workspace.

### VIEW-17 — Magnifier
Magnifier and navigator for fine histology inspection, with separate display resampling.

### VIEW-18 — Multi-view comparison
Linked side-by-side for channels, stains, sections, source/segmentation, model outputs; synchronized zoom and registered coordinate mapping.

### VIEW-19 — Display state persistence
Per-image zoom, pan, channel, Z/T, LUT, display range, overlays, view mode. Display state is not processing history.

### VIEW-20 — Color spaces
RGB↔grayscale, RGB stack, HSB/HSV-like and other implemented spaces. State whether conversion is reversible/lossy.

### VIEW-21 — Accessibility/precision
Keyboard access, numeric entry, tooltips, high-contrast overlays, coordinate/scale precision.

---

## 5. Selection tools, ROI manager, annotations

**IDs: ROI-01–ROI-22 | Availability: CORE + FIJI-COMMON | Priority: P0**

### ROI-01 — Selection primitives
Rectangle, oval/ellipse, polygon, freehand area, freehand line, straight line, segmented line, angle line, point/multipoint, wand/tracing, brush/paint selection. Include edit handles, clear/cancel, configurable shortcuts.

### ROI-02 — ROI geometry
Store type, coordinates, vertices, bounds, name, label, color, stroke/fill, calibration, axes association, and source identity. Support holes/multipart if possible; otherwise reject unsupported geometry clearly.

### ROI-03 — ROI Manager
Add, add-and-name, update, rename, delete selected/all, duplicate, sort, multi-select, select all, show/hide all, restore by clicking name, display IDs, associate with C/Z/T.

### ROI-04 — Overlay editing
Show all ROIs with labels; click label to activate ROI; edit current ROI and update it without changing others; per-ROI and global style.

### ROI-05 — ROI import/export
Support documented ROI format(s), collections/ZIP, JSON, polygon/GeoJSON-like representation, coordinate CSV. Do not claim ImageJ `.roi` binary compatibility without a tested parser/writer.

### ROI-06 — ROI measurement
Measure current/selected/all ROIs; current plane, all planes, or associated planes; configurable row layout.

### ROI-07 — Multi-measure
Measure ROIs across all slices/frames; one row per ROI summary or per ROI-plane; stable IDs; plane metadata; missing-ROI policy (skip/NA/explicit zero only).

### ROI-08 — Boolean ROI operations
Union, intersection, difference, XOR where supported. Validate coordinate systems and return new ROI/mask.

### ROI-09 — Draw/fill/clear
Draw boundary, fill, clear inside/outside, create mask; clearly declare whether source pixels will be changed; default to new output/duplicate.

### ROI-10 — Numeric ROI specification
Exact X/Y/width/height/angle/units for shapes; fixed dimensions; move/center.

### ROI-11 — Points and landmarks
Add/name/move/delete/group/export; label points; associate with plane; use for registration and measurement.

### ROI-12 — ROI groups/classes
Named groups such as tumor, stroma, vessel, nucleus, artifact, background. Group style/visibility; class separate from geometry.

### ROI-13 — Plane-aware ROIs
Preserve C/Z/T association; support multi-plane ROI only with explicit interpolation behavior.

### ROI-14 — ROI statistics
Count, area/volume, perimeter/surface, intensity stats, shape, position. Distinguish area from volume.

### ROI-15 — Labels/measurement text
Show names, IDs, metric values, or notes; font/color/position/visibility.

### ROI-16 — Search/filter
Search names/classes/labels; filter by area, channel, plane, class, selection state.

### ROI-17 — Edit history
Undo/redo geometry edits; link each analysis result to ROI version; mark stale after edit.

### ROI-18 — Annotation primitives
Text, arrows, lines, rectangles, ellipses, freehand drawings as a separate annotation layer from measurement ROIs.

### ROI-19 — Coordinate export
Export contours with X/Y, calibrated coordinates, axis index, object ID; optionally evenly spaced boundary samples.

### ROI-20 — Selection transforms
Move, resize, rotate, translate, scale, flip, invert, constrain to canvas. Distinguish ROI-only transform from pixel resampling.

### ROI-21 — Wand options
Tolerance, connected/global selection, 4/8 connectivity, polarity, use-current-threshold; preview before adding.

### ROI-22 — Validity
Detect empty/degenerate/self-intersecting/off-canvas/duplicate/incompatible ROIs; warn or offer correction.

---

## 6. Image type conversion, adjustments, and color processing

**IDs: ADJ-01–ADJ-19 | Availability: CORE | Priority: P0/P1**

- **ADJ-01 Type conversion:** 8-bit, 16-bit, float32, indexed color, RGB, RGB stack, HSB stack where valid. Dialog shows source/destination type, scaling rule, and preview.
- **ADJ-02 Brightness/contrast:** display range, auto, reset, numeric entry, display-only vs apply-to-pixels, current slice/channel vs stack.
- **ADJ-03 Auto threshold:** multiple implemented algorithms (e.g. Otsu, Huang, Triangle, Yen, Li, Mean, Moments, Minimum). Show method, polarity, bounds, preview, ROI, histogram, create-mask action. Expose only tested methods.
- **ADJ-04 Manual threshold:** lower/upper sliders and numeric values; preview; separate mask creation; global or slice-specific stack threshold.
- **ADJ-05 Contrast enhancement:** stretch/normalize, histogram equalization, optional CLAHE, saturation percentage, stack vs slice histogram, ROI. Warn about effects on quantitative values if pixels are changed.
- **ADJ-06 Invert:** correct inversion for 8/16/float, color channels only by explicit choice; distinguish pixel inversion from LUT inversion.
- **ADJ-07 Color balance/channel math:** RGB weights, grayscale formula, per-channel adjustments, split/merge, record formula.
- **ADJ-08 LUT:** apply/invert/import/export, preserve raw values.
- **ADJ-09 Normalize:** selected intensity range, image/stack/channel/ROI; derived output by default.
- **ADJ-10 Gamma:** numeric gamma, preview, record formula/range.
- **ADJ-11 Histology color deconvolution (optional):** stain-vector selection (H&E and other models only if validated), custom stain vectors, output separate channels; no clinical-accuracy claim.
- **ADJ-12 Color-space conversion:** RGB/grayscale/HSV-HSB and other implemented spaces; disclose reversible/lossy behavior.
- **ADJ-13 Channel combination:** composite display, channel weights/colors/opacity/labels, original channels preserved.
- **ADJ-14 Calibration/density calibration:** known distance and calibration curve/table; show fit/residual/error/validity.
- **ADJ-15 Threshold-to-mask:** polarity, LUT, connectivity, bit depth, stack scope.
- **ADJ-16 LUT range:** independent min/max per channel, persisted.
- **ADJ-17 Display-vs-pixel indicator:** visible distinction for contrast/LUT/threshold and processing history.
- **ADJ-18 Per-channel statistics:** histograms and numeric stats per channel; clearly define composite stats.
- **ADJ-19 Presets:** save/reuse contrast, LUT, channel colors, threshold, normalization; check source compatibility.

---

## 7. Image processing and filters

**IDs: PROC-01–PROC-39 | Availability: CORE + EXTENSIONS | Priority: P0/P1/P2**

### PROC-01 — Smooth/mean
Neighborhood averaging, kernel, 2D/3D, boundary policy, ROI, preview. Document kernel footprint and loss of small structures.

### PROC-02 — Gaussian blur
Sigma X/Y/Z, physical or pixel units, 2D/3D, channel, stack, boundary policy, ROI, output type.

### PROC-03 — Median
Radius/kernel X/Y/Z, 2D/3D, edge, channel, ROI, preview; note possible loss of small objects.

### PROC-04 — Remove outliers
Local median-based replacement; radius, threshold, bright/dark/both, stack/ROI, preview, count changed pixels.

### PROC-05 — Remove NaNs
Float images; explicit neighborhood replacement; warn on large NaN patches; do not silently replace infinities.

### PROC-06 — Sharpen
Documented sharpening and unsharp mask; radius/amount/weight; preview; noise-amplification warning.

### PROC-07 — Find edges
Sobel gradient magnitude and X/Y maps; clear polarity/output type; true 3D only if implemented.

### PROC-08 — Custom convolution
Custom kernel matrix, normalization, anchor, boundary, output type, presets, validation.

### PROC-09 — Minimum/maximum
Grayscale erosion/dilation; kernel geometry/size; 2D/3D.

### PROC-10 — Background subtraction / rolling ball
Radius in pixels/physical units; light/dark background; rolling ball/paraboloid implementation if available; smoothing toggle; create-background preview; current/ROI/channel/stack scope; preview background and subtraction. Warn when radius threatens structures to preserve.

### PROC-11 — Noise
Denoising plus synthetic Gaussian, salt-and-pepper, Poisson-like, or speckle generation only when implemented. Mark generated noise as synthetic and keep source immutable.

### PROC-12 — Binary morphology
Erode, dilate, open, close, fill holes, keep/remove border objects, skeletonize through a validated algorithm. Expose iterations, connectivity, structuring element, foreground polarity, edge padding, 2D/3D.

### PROC-13 — Structuring elements
Square, rectangle, disk, line, diamond, cube, sphere, custom. Size/radius in pixels or calibrated units; show footprint/connectivity.

### PROC-14 — Distance transform
Distance-to-background/object for binary masks; 2D/3D; Euclidean or other supported metric; integer/float output; calibration-aware and anisotropy-aware.

### PROC-15 — Watershed
Intensity/binary, marker-controlled/seeded, distance-transform variants; connectivity, seed source, mask, minima suppression, compactness only when supported; label output and boundaries.

### PROC-16 — Ultimate points/local maxima
Regional maxima; output points/seeds/regions; noise tolerance/prominence; edge exclusion; polarity; threshold scope; prevent duplicate maxima.

### PROC-17 — Voronoi
Regions from binary objects/centers; calibrated distances; 2D/3D; labels.

### PROC-18 — Arithmetic with constants
Add/subtract/multiply/divide/set/log/reciprocal/absolute/min/max/gamma and supported bitwise AND/OR/XOR. Constant, ROI, channel/stack scope, output type, clipping and divide-by-zero policy.

### PROC-19 — Image calculator
Two-image add/subtract/multiply/divide/AND/OR/XOR/difference/min/max/average where supported. Select A/B, operation, new output vs replace derived image, float32 result, dimension/axis compatibility, registration/calibration checks, ROI. Never resize silently.

### PROC-20 — Expression evaluator
Sandboxed numeric expression language, not arbitrary untrusted code. Validated variables, parser, preview, output type.

### PROC-21 — FFT/frequency domain
2D FFT/FHT when available; power spectrum; frequency inspection; preserve link to transform data for inverse transform.

### PROC-22 — FFT bandpass
Large/small structures, stripe suppression, direction, autoscale, edge padding, mask preview, output type, frequency calibration.

### PROC-23 — Custom frequency filter
User-defined symmetric mask/filter; validate symmetry; preview.

### PROC-24 — Frequency-domain math
Convolution, correlation, deconvolution-like operations only with correct transform/boundary handling and numerical tests.

### PROC-25 — Resampling/scaling
New dimensions, aspect ratio, interpolation (nearest/bilinear/bicubic or supported), physical scale, output size; warn sampling changes.

### PROC-26 — Crop
ROI crop; selected or all planes; preserve calibration; derived copy by default.

### PROC-27 — Translate
X/Y/Z shift, fill/background, interpolation, derived output, transform matrix where registered.

### PROC-28 — Rotate
Numeric/interactive angle, interpolation, expand vs crop, pivot, fill, stack/volume behavior, calibration preservation.

### PROC-29 — Flip
Horizontal/vertical and supported Z orientation; preserve coordinate metadata.

### PROC-30 — Reslice
Resample along line/plane and create orthogonal XZ/YZ views; calibration-aware interpolation/output spacing.

### PROC-31 — Stack duplication/splitting
Duplicate selected planes/channels/frames; split stack; combine/concatenate compatible stacks; stack↔hyperstack conversion with explicit order.

### PROC-32 — Stack operations
Add/remove/replace/reorder/reverse slices, montage, images-to-stack, reslice, Z profile, select range; preserve labels/metadata.

### PROC-33 — Stack alignment preprocessing
Optional registration before stack processing; distinguish translation from rigid/affine/deformable registration.

### PROC-34 — Stack scope
Every compatible command exposes current plane, range, all Z, all T, selected channels, or full dataset. Do not expose unsupported dimensions.

### PROC-35 — ROI-only processing
Process current ROI and define outside-ROI behavior (unchanged/zero/background/cropped output). Store processing mask.

### PROC-36 — Preview/presets
Responsive preview where feasible; reset defaults; save presets; log exact parameters.

### PROC-37 — Repeat last command
Reuse settings only for compatible inputs; confirm if target differs; protect against accidental destructive replay.

### PROC-38 — Filter comparison
Compare configurations on duplicates with parameter labels.

### PROC-39 — Pipeline preview
Ordered operations, enable/disable/reorder, inspect intermediate results, save pipeline, validate input requirements.

---

## 8. Quantitative analysis, measurements, histograms, plots

**IDs: ANA-01–ANA-31 | Availability: CORE + FIJI-COMMON + extensions | Priority: P0/P1**

- **ANA-01 Measurement configuration:** area, mean, SD, min/max, mode/median where meaningful, integrated density/sum, area fraction, centroid X/Y/Z, center of mass, perimeter/boundary length, bounding rectangle, Feret diameter, fitted ellipse and axes, circularity/aspect ratio/solidity/roundness/compactness with formulas, skewness/kurtosis, line length/angle, pixel/voxel count, C/Z/T. Separate valid 2D vs 3D metrics.
- **ANA-02 Calibration:** area and volume in physical units only with valid spacing; distance units; raw vs density-calibrated intensity; units in tables/export.
- **ANA-03 Measure ROI/image:** current selection, ROI(s), whole image; include image/ROI IDs, C/Z/T, units, calibration state, analysis run ID.
- **ANA-04 Threshold-limited measurements:** threshold pixels or intersection of ROI+threshold; record bounds/polarity/method.
- **ANA-05 Redirect measurements:** ROI on reference image measured on registered target channel/image; require compatible coordinates or transform; record both assets.
- **ANA-06 Results table:** sort/filter/select/copy/export/clear/append; decimal/scientific formatting; raw precision internally; units/provenance; per-object/per-plane/summary; CSV/TSV/JSON.
- **ANA-07 Summarize:** count, mean, SD, min/max, median and valid numeric summaries; group by image/channel/ROI class/specimen/time/metadata.
- **ANA-08 Analyze particles:** min/max size in pixels²/µm² or voxels/µm³; circularity range; edge exclusion; include holes; 2D 4/8 and 3D 6/18/26 connectivity where supported; outline/mask/labels output; add to ROI manager; per-object table; count/total area/mean size/area fraction/size distribution; plane/stack scope; optional threshold. Use connected components and stable labels.
- **ANA-09 Particle QC:** overlay accepted/rejected objects and reasons (size, circularity, edge); allow curation.
- **ANA-10 Histogram:** full image/ROI/channel/threshold/Z/T range; bins/range/log/cumulative/normalized/export; N and units; explain binning for 16/32-bit.
- **ANA-11 Plot profile:** line ROI, straight/segmented/freehand, width averaging, channel, calibrated distance, multiple curves, CSV.
- **ANA-12 Z profile:** ROI mean/statistics vs Z; physical spacing and error/variation.
- **ANA-13 Time profile:** ROI intensity/statistics vs frame/time; interval and missing frames; baseline normalization as a derived analysis.
- **ANA-14 Surface plot:** intensity surface with sampling/color/viewpoint/height; mark as visualization.
- **ANA-15 Calibration bar:** units, labels, decimals, font/bold, color/fill/location/zoom.
- **ANA-16 Analyze line graph:** isolate curve and export X/Y; calibrate graph axes; advanced/non-primary histology tool.
- **ANA-17 Gel analysis:** select first/next lanes; lane profile; baselines/drop lines; peak area; percent of total; optical density only with calibration; lane orientation, invert peaks, plot scaling.
- **ANA-18 Stable object identity:** object IDs tied to label/source/ROI/analysis; retain old-to-new mapping when relabeling.
- **ANA-19 Spatial distribution:** centroid maps, nearest-neighbor distances, density maps, pairwise distances, spatial distribution; identify assumptions/edge effects.
- **ANA-20 Morphometry:** area, perimeter, major/minor axis, eccentricity, circularity, solidity, convex hull, Feret, centroid, orientation, bounding box and validated 3D equivalents; formula help.
- **ANA-21 Intensity:** integrated density, mean/median/min/max/SD, background-corrected value with explicit background ROI, channel ratios, saturation warning.
- **ANA-22 Density calibration:** curve/table, units, residuals, version; warn before extrapolation.
- **ANA-23 Batch analysis:** multiple images, combined table, source identity/metadata, explicit skip/failure policy.
- **ANA-24 Reproducible report:** provenance, calibration, ROIs, segmentation, settings, results, overlays, software version, warnings; HTML/Markdown/PDF as supported.
- **ANA-25 Plot tools:** line/scatter/histogram/XY/Z/time/distribution plots; axes/units/legend/data export.
- **ANA-26 Group summaries:** specimen/slide/case/stain/channel/time/ROI class; explicit missing-data handling.
- **ANA-27 Precision:** decimals/scientific notation/locale-safe formatting; preserve unrounded values.
- **ANA-28 Measurement overlays:** IDs/selected metrics as non-destructive labels.
- **ANA-29 Stale-result invalidation:** mark measurements stale when source/calibration/ROI/threshold/segmentation/registration changes.
- **ANA-30 Quality metrics:** object counts, area distribution, mask coverage, border count, invalid object count, warnings.
- **ANA-31 Validation:** analytic circles/squares/lines/spheres/grids and known pixel values.

---

## 9. Built-in segmentation and binary/label-image editing

**IDs: SEG-01–SEG-22 | Availability: CORE + MorphoLibJ/3D extensions | Priority: P0–P2**

- **SEG-01 Manual segmentation:** brush/paint, polygon, freehand, wand, threshold, ROI-to-mask; add/subtract/erase; brush size/opacity/undo; separate mask layer.
- **SEG-02 Binary masks:** create from threshold/ROI/labels/model; preserve polarity, bit depth, dimensions, calibration, source ID.
- **SEG-03 Connected components:** 2D/3D labels, connectivity, minimum size, label map and table.
- **SEG-04 Watershed:** marker-controlled/distance-transform; automatic/local maxima or manual seeds; preview, boundary, labels, postprocessing.
- **SEG-05 Morphological segmentation:** binary/grayscale erosion, dilation, opening, closing, gradient, Laplacian, top-hat, black-hat where supported, reconstruction, hole-fill, border-clear, extrema.
- **SEG-06 Morphological reconstruction:** dilation/erosion from marker and mask; regional/extended extrema; validate compatibility.
- **SEG-07 Label tools:** select, crop, merge, replace ID, remove, sequential relabel, keep/remove largest, border removal, size/volume filtering, boundaries, binary masks, object table.
- **SEG-08 Label editor:** list, colors, counts, size/volume, bounds; paint/erase/merge/split/rename/recolor/show/hide/remove; 2D/3D where supported.
- **SEG-09 Separate touching objects:** distance transform + local maxima + watershed; seed prominence/distance, min separation, connectivity; show uncertain splits/merges.
- **SEG-10 Topology cleanup:** fill holes, remove isolated/small objects, smooth contours, clear border; report changes.
- **SEG-11 Label measurements:** area/volume, surface/perimeter, centroid, bounds, source-image intensity, shape, calibrated units; respect anisotropic voxels.
- **SEG-12 Overlay:** colors, alpha, boundaries, IDs/classes; side-by-side source and result.
- **SEG-13 Curation:** accept/reject/merge/split/relabel/exclude artifact; preserve original automated prediction apart from curated result.
- **SEG-14 Project persistence:** masks, labels, IDs, classes, algorithm/model, parameters, seeds/traces, probability maps, axes.
- **SEG-15 Skeletonize:** validated 2D/3D thinning, separate from source mask.
- **SEG-16 Distance analysis:** distance map, geodesic distance, thickness/medial-axis only with documented definition/calibration.
- **SEG-17 Watershed QC:** seeds, boundaries, object count, over/under-segmentation; manual seeds and parameter comparison.
- **SEG-18 Dimensional correctness:** explicitly distinguish 2D, slice-wise, 2.5D, true 3D; state connectivity and voxel spacing.
- **SEG-19 Semantic classes:** background/nuclei/cytoplasm/stroma/tumor/vessel/artifact; class ID/color separate from object ID.
- **SEG-20 Comparison:** Dice, IoU/Jaccard, precision, recall, specificity, sensitivity, Hausdorff, average symmetric surface distance, object matching when implemented.
- **SEG-21 Export:** binary masks, integer labels, object tables, probability maps, overlays with axes/calibration.
- **SEG-22 Reproducibility:** algorithm/version/parameters/input hash/model checksum/random seed/output hash; do not claim determinism when unavailable.

---

## 10. Macros, scripting, command recorder, automation

**IDs: AUTO-01–AUTO-17 | Availability: CORE + IMAGEJ2/SciJava + FIJI-COMMON | Priority: P1**

- **AUTO-01 Command recorder:** record supported user operations, params, target image, ROI, scope; pause/resume/clear/save/copy.
- **AUTO-02 Script editor:** syntax highlight for supported languages, line numbers, search, open/save, run selection/line/script, abort, console.
- **AUTO-03 Macro/command API:** open/import, select image, threshold, filter, segment, measure, export, close; versioned API and errors.
- **AUTO-04 Parameter schema:** machine-readable type/label/default/range/units/options/dependencies/validation reused by UI, script, batch, pipeline.
- **AUTO-05 Batch processing:** file filters, recursive folders, output naming, stop/continue, skip/overwrite/version, logs, dry-run, safe parallelism, progress/cancel, combined results.
- **AUTO-06 Batch pipeline:** explicit input binding; never rely on whatever image is active in the GUI.
- **AUTO-07 Headless mode:** separate engine from UI so compatible workflows can run without opening windows.
- **AUTO-08 Command finder:** search names/categories/keywords; descriptions, shortcuts, supported types/dimensions, availability, documentation.
- **AUTO-09 Extension registry:** command/plugin ID, version, dependencies, license, source, author, availability.
- **AUTO-10 Extension updates (optional):** trusted sources, pinning, compatibility, checksum/signature, rollback, dependency graph; explicit consent for downloaded executable code.
- **AUTO-11 Pipeline templates:** import→calibration→segment→particle analysis→report; multichannel→colocalization; time lapse→tracking; Z stack→deconvolution→3D analysis; histology→stain separation→tissue ROI→nuclei morphometry. State prerequisites/limitations.
- **AUTO-12 Debugging:** line-level errors, stack trace, command context, target image/ROI; stop/break if supported.
- **AUTO-13 Reproducible log:** pipeline/code hash, inputs, parameters, times, runtime, outputs, warnings, failures.
- **AUTO-14 Shared command execution:** same command semantics from UI, script, batch, and pipeline.
- **AUTO-15 Pipeline graph:** nodes/edges for images, masks, tables; validate/reorder/disable/duplicate/save/run/inspect.
- **AUTO-16 Safe script sandbox:** restrict untrusted script file/network/process access; explicit permissions for read/write.
- **AUTO-17 Automation tests:** run test image through pipeline and compare masks/measurements/checksums within justified tolerances.

### قانون پیاده‌سازی scripting در TissueAI

قابلیت Macro/Scripting در ImageJ را نباید با اجرای مستقیم Java/SciJava در هسته TissueAI یکی دانست. مسیر پیش‌فرض TissueAI باید یک **workflow DSL امن و versioned** یا JSON pipeline مبتنی بر همان Command Registry باشد:

- Recorder عملیات کاربر را به operation ID + version + parameters + input asset binding تبدیل کند.
- اجرای workflow از همان Rust engine و همان validation که UI استفاده می‌کند عبور کند.
- اجرای headless باید بدون React window امکان‌پذیر باشد، ولی همچنان از project model و job manager استفاده کند.
- Script editor فقط در صورت نیاز به زبان اسکریپت واقعی اضافه شود؛ runtime آن باید محدود، permission-based و optional باشد.
- `eval`، اجرای arbitrary shell command، دسترسی آزاد به filesystem/network و تزریق کد از خروجی LLM ممنوع است.
- اجرای Java macroهای Fiji در هسته محصول پشتیبانی پیش‌فرض نیست؛ در صورت نیاز فقط adapter مجزا و اختیاری با مرزبندی process/runtime.

# PART B — FIJI / IMAGEJ SCIENTIFIC EXTENSIONS

## 11. Microscopy formats and metadata — Bio-Formats

**IDs: BF-01–BF-10 | Availability: FIJI-COMMON/EXTENSION | Priority: P1**

Bio-Formats is a mature microscopy I/O library used by Fiji to read many proprietary/open life-sciences formats and normalize metadata into an OME model. Supported formats vary by release.

- **BF-01 Import workflow:** explicit importer; metadata/series chooser; select series/channels/Z/T/resolution; grayscale/composite/color/split channels; optional display autoscale; ROI import; crop-on-import; virtual/on-disk mode; dimensions and memory preview.
- **BF-02 Metadata inspection:** metadata-only, raw metadata, OME-XML, series/plane/tile counts, channel/objective/pixel size/acquisition data, missing/conflicting warnings.
- **BF-03 OME model:** structured metadata mapping, not one opaque text string; keep original metadata for audit.
- **BF-04 Exporter:** OME-TIFF/OME-XML and supported output formats; validate dimensions, pixels, metadata, calibration; reopen verification.
- **BF-05 Remote import:** optional, local cache, explicit URL/status, warn local disk is more robust.
- **BF-06 Windowless import:** reuse last settings with visible summary and reset.
- **BF-07 Plate/well/position:** preserve acquisition hierarchy; do not flatten wells/positions.
- **BF-08 Plane metadata:** timestamps, stage positions, exposure, channel metadata.
- **BF-09 Diagnostics:** unsupported series/compression/invalid metadata errors; safe reader fallback only.
- **BF-10 Format compatibility page:** reader version/capabilities and link to current official format list.

## 12. Large images and multidimensional data — BigDataViewer concepts

**IDs: BIG-01–BIG-13 | Availability: FIJI-COMMON/EXTENSION | Priority: P2**

BigDataViewer is intended for terabyte-scale multiview time-series. Its model has independent sources, timepoints, registration, and multiresolution image pyramids. A common storage arrangement is XML metadata plus HDF5 volumes; other source backends exist.

- **BIG-01 Virtual access:** lazy/disk-backed/tiled/chunked loading for datasets larger than RAM; display memory/cache.
- **BIG-02 Pyramids:** multiresolution levels for responsive zoom; documented anti-aliased downsampling; retain full resolution.
- **BIG-03 Chunk storage:** chunk dimensions tuned to XY tiles, Z neighborhoods, and time frames; benchmark.
- **BIG-04 Arbitrary reslicing:** view arbitrary 3D planes; respect anisotropy/transforms.
- **BIG-05 Multi-source view:** multiple channels/views/acquisitions as independent sources with visibility/color/opacity.
- **BIG-06 Time navigation:** browse without loading every frame.
- **BIG-07 Global registration:** transforms per view into common coordinates; display/recalibrate.
- **BIG-08 Pyramid export:** documented format with sources/time/channel/levels/transforms.
- **BIG-09 HDF5/XML (optional):** use documented schema; validate paths/chunks/compression/metadata; never call private format BDV-compatible.
- **BIG-10 Remote chunks (optional):** secure access/authentication/cache/status.
- **BIG-11 Memory budget:** configurable RAM/cache; bounded; avoid full-volume duplicates; stream tiles where possible.
- **BIG-12 Virtual-stack processing:** run compatible pipelines on disk-backed images; state operations that require full RAM.
- **BIG-13 Large-data test:** open, navigate, render, crop, and process a dataset larger than RAM without materializing it fully.

## 13. Interactive machine-learning segmentation — Labkit and Trainable Weka

**IDs: MLSEG-01–MLSEG-23 | Availability: Labkit commonly bundled in Fiji; Weka commonly an extension | Priority: P2**

### MLSEG-01 — Pixel-classification workflow

Load image/stack; define semantic classes (background, nucleus, cytoplasm, stroma, tumor, vessel, artifact); paint class traces; choose features/scales; train; preview labels/probabilities; add corrections; retrain; apply to current/other images; export labels, probabilities, model.

### MLSEG-02 — Annotation tools
Reuse brush/freehand/polygon/ROI tools; multiple traces/class; undo/redo; colors/visibility; delete/rename; editable training labels.

### MLSEG-03 — Feature extraction
Raw intensity/channel values; Gaussian scales; local mean/variance; gradient magnitude/orientation; DoG; membrane projections where available; texture/neighborhood features; 3D features when supported. Expose sigma range, scales, channels, 2D/3D, cost.

### MLSEG-04 — Random forest
Control tree count, feature subset, seed, and backend-supported parameters. Do not show ignored settings.

### MLSEG-05 — Other classifiers
Expose only installed/validated Weka/backend classifiers, with limitations.

### MLSEG-06 — 2D/3D
True 3D feature set if supported; otherwise explicitly offer slice-wise 2D mode.

### MLSEG-07 — Live preview
Interactive classification overlay, progress, pause/cancel.

### MLSEG-08 — Probability map
Per-class probabilities/confidence separately from hard labels.

### MLSEG-09 — Settings
Class count, features, scales, classifier, training parameters, tile size, memory, validation.

### MLSEG-10 — Model save/load
Model, class mapping, features, library/software version, checksum, training references and annotation metadata. Check compatibility on reuse.

### MLSEG-11 — Batch prediction
Run on compatible images; report skipped/mismatched; tile support.

### MLSEG-12 — Training curation
Manage traces, class imbalance, pixel counts, mislabeled trace removal, annotation history.

### MLSEG-13 — Validation split
Image/region-level holdout; avoid neighboring-pixel leakage from random pixel splits.

### MLSEG-14 — Metrics
Confusion matrix, per-class precision/recall/F1/IoU/Dice, pixel accuracy and calibration where implemented; identify training vs held-out metrics.

### MLSEG-15 — Tiled inference
Overlapping tiles, blending strategy, seam validation.

### MLSEG-16 — CPU/GPU
Use installed backend; show device/runtime and safe CPU fallback.

### MLSEG-17 — Correction loop
Correct regions, retrain/re-predict, show changes, retain prior version.

### MLSEG-18 — Probability→labels
Visible threshold or argmax policy; per-class thresholds.

### MLSEG-19 — Compatibility
Check channel count, feature schema, dtype, scale, model version; explain mismatch.

### MLSEG-20 — Training persistence
Traces, classes, params, features, training result, probability preview, model outputs.

### MLSEG-21 — Labkit-style UI
Image canvas, class list, brush tools, preview, model controls, curation; prioritize coherent UX.

### MLSEG-22 — Weka-style comparison
Compare selected classifiers/features on a defined validation set, if backend supports it.

### MLSEG-23 — Acceptance
Annotated benchmark patches, class metrics, repeatability, seams, large-image use, memory, annotation persistence.

## 14. Deep-learning segmentation adapters — StarDist and external models

**IDs: DLSEG-01–DLSEG-18 | Availability: StarDist extension; others optional | Priority: P2/P3**

- **DLSEG-01 Model inference:** registry with name/version/domain/axes/channels/normalization/license; block incompatible inputs.
- **DLSEG-02 StarDist-style nuclei:** star-convex objects on suitable 2D microscopy. Controls: model (fluorescent/H&E only when actually installed), channel, percentile normalization/bounds, score threshold, NMS overlap threshold, tile count/size, label/ROI output. The Fiji StarDist plugin documentation describes 2D and 2D+time; do not claim its 3D support unless another 3D engine is integrated.
- **DLSEG-03 Custom StarDist model:** load local compatible model archive; verify schema/version; show class/normalization; no silent downloads.
- **DLSEG-04 Cellpose adapter (optional):** model, diameter, flow/cell probability thresholds, channel mapping, tiles, normalization, output labels; explicit external runtime/version.
- **DLSEG-05 Omnipose adapter (optional):** expose only installed integration and supported parameters.
- **DLSEG-06 Cellpose-SAM adapter (optional):** compatible runtime only; show hardware requirements.
- **DLSEG-07 ilastik bridge (optional):** import compatible classifier predictions/projects; do not imply it is Fiji core.
- **DLSEG-08 Model registry:** ID/version/source/license/path/checksum/input schema/preprocessing/classes/output schema/dependencies/validation.
- **DLSEG-09 Inference queue:** queue, progress, cancel, retry, per-image logs.
- **DLSEG-10 Output review:** probability/label overlay, confidence/class/count/uncertain regions; curate separately from raw prediction.
- **DLSEG-11 Model comparison:** overlay, object counts, metrics vs ground truth, runtime/memory.
- **DLSEG-12 Normalization:** channel, percentile or mean/std only if supported, background correction, clipping; record exact values.
- **DLSEG-13 Tiling/merging:** overlap, boundary policy, ID reconciliation, seam diagnostics.
- **DLSEG-14 Device config:** CPU/GPU/runtime/memory; do not assume CUDA; support installed backends.
- **DLSEG-15 Offline inference:** local model and local runtime; remote source optional/explicit.
- **DLSEG-16 Reproducibility:** model checksum, runtime/device/version, parameters, normalization, seed, input hash.
- **DLSEG-17 Privacy:** no cloud upload without explicit disclosure/authorization; offline mode and local/cloud indicator.
- **DLSEG-18 Validation/scope:** show model training domain. Fluorescence model is not automatically validated for H&E. Segmentation is not diagnosis/malignancy classification.

## 15. Object detection and tracking — TrackMate concepts

**IDs: TRACK-01–TRACK-23 | Availability: FIJI-COMMON/EXTENSION | Priority: P2**

TrackMate detects spots/cell-like objects in frames, filters detections, links them into trajectories, calculates features, and supports manual corrections.

- **TRACK-01 Workflow:** choose time-series; channel/time range; detector/settings; preview; filter; tracker/settings; run; inspect tracks/lineage; edit; analyze; export.
- **TRACK-02 Detectors:** LoG, DoG, threshold, local maxima, mask/label import, model-assisted StarDist/Cellpose/Weka where integrated.
- **TRACK-03 Detector settings:** channel, radius/diameter in physical units, quality threshold, subpixel localization, optional median filter, preview.
- **TRACK-04 Cell-like objects:** use masks/labels and retain boundaries, centroid, IDs.
- **TRACK-05 Filtering:** intensity, quality, radius, area, class, shape, user-defined features; show retained/rejected.
- **TRACK-06 Nearest neighbor:** next-frame nearest valid object with max distance and gap policy.
- **TRACK-07 LAP:** global assignment; separate linking, gap closure, split/merge settings where supported; explain costs/constraints.
- **TRACK-08 Kalman:** near-constant-velocity model; expose supported motion/gap uncertainty.
- **TRACK-09 Overlap tracker:** object contour overlap; threshold and split/merge policy.
- **TRACK-10 Gap closing:** max frame gap and motion constraints; distinguish gap-closed links.
- **TRACK-11 Split/merge:** explicit lineage events; manual confirmation; do not assume split means cell division.
- **TRACK-12 Editing:** add/remove detections, relink, split/merge tracks, correct missing/spurious links; history.
- **TRACK-13 Lineage view:** graph parent/child; select track to highlight; zoom/pan/time navigation.
- **TRACK-14 Overlay:** detections, track lines, IDs, labels, arrows, trails, lineage colors, time window/opacity.
- **TRACK-15 Spot analyzers:** coordinates, quality, radius, intensity stats, orientation, area/volume, shape.
- **TRACK-16 Link analyzers:** link distance/displacement/frame gap/speed/direction.
- **TRACK-17 Track analyzers:** duration, displacement, path length, average/max speed, directionality, straightness, confinement, diffusion summaries when appropriate.
- **TRACK-18 Plots:** position/speed/displacement/intensity/size/shape vs time for tracks.
- **TRACK-19 Movie export:** selected tracks over source frames, FPS/time range, stable identity colors.
- **TRACK-20 Data export:** spots/links/tracks/lineage CSV/TSV/JSON with IDs, frame/time, coordinates/units, detector/tracker params.
- **TRACK-21 QC:** long links, jumps, low-quality detections, ambiguous split/merge, missing frames, edge-touching.
- **TRACK-22 External detectors:** explicit optional Python/Conda/Mamba env and versions; never silently install.
- **TRACK-23 Validation:** synthetic trajectories; identity switches, misses, false detections, gap closing, division, calibrated velocity.

## 16. Registration, alignment, drift correction, stitching

**IDs: REG-01–REG-18 | Availability: FIJI-COMMON/EXTENSION | Priority: P1/P2**

- **REG-01 Workflow:** reference/moving images; channel/Z/T/section/view scope; transform type; preview; overlap/error; derived output and transform record.
- **REG-02 Translation:** XY/XYZ displacement via landmarks or correlation/phase correlation.
- **REG-03 Rigid body:** translation + rotation, no scale/shear.
- **REG-04 Affine:** translation/rotation/scale/shear when justified; matrix/interpolation.
- **REG-05 Deformable:** optional validated algorithm only; disclose regularization, displacement limits, topology/invertibility issues.
- **REG-06 Landmark registration:** paired landmarks; transform and per-point residuals.
- **REG-07 StackReg/TurboReg-style adapter:** expose only transform classes provided by actual integrated version; verify license/compatibility.
- **REG-08 Channel registration:** align channels; preserve channels and record transforms; warn about chromatic aberration calibration.
- **REG-09 Time-lapse drift:** selected registration channel/reference frame/transform/border handling; virtual output.
- **REG-10 Z-stack alignment:** selected slices; supported rigid/affine/deformable; preserve Z positions.
- **REG-11 Serial-section alignment:** align histology sections; retain original and transformed versions.
- **REG-12 2D stitching:** overlapping tiles; correlation/features; ROI search; overlap; tile arrangement; global optimization; blending.
- **REG-13 3D stitching:** overlapping stacks/volumes.
- **REG-14 Grid stitching:** regular grid dimensions, overlap, positions, grid sequences.
- **REG-15 Collection stitching:** irregular layout with configuration file or manually specified neighbors.
- **REG-16 Unknown-layout directory stitching:** discover overlaps; report ambiguous connections/confidence; do not auto-accept bad layout.
- **REG-17 Blending:** linear/nonlinear overlap blending; no-blend option; preserve source.
- **REG-18 QC:** blink/checkerboard/overlay, matrix, residuals, overlap %, warnings for low correlation/excess deformation.

## 17. 3D visualization and volume rendering

**IDs: VOL-01–VOL-20 | Availability: 3D Viewer extension/other renderer | Priority: P2**

- **VOL-01 Volume rendering:** transfer function, intensity range, LUT, opacity curve, sampling quality, background, lighting, camera.
- **VOL-02 Orthoslices:** XY/XZ/YZ in 3D scene, movable planes, synchronized 2D crosshair.
- **VOL-03 Isosurface:** mesh from threshold/label; threshold, smoothing, decimation, color, opacity, mesh export; distinguish mesh from scientific label volume.
- **VOL-04 Surface plot:** intensity surface; height scale/downsampling/color/camera.
- **VOL-05 Multi-volume scene:** multiple channels/volumes/labels, scene tree, visibility.
- **VOL-06 Content attributes:** color, opacity, visibility, name, scale, transform, mode.
- **VOL-07 Transformations:** explicit matrix; scene transform separate from voxel resampling.
- **VOL-08 Points/landmarks:** point clouds, centroids, selected objects, labels.
- **VOL-09 Custom surface:** add/remove scene content; meshes from labels; original unchanged.
- **VOL-10 4D viewer:** volume changes over time; do not confuse T with Z.
- **VOL-11 Two canvases:** same scene, independent or synchronized cameras.
- **VOL-12 Movie recording:** camera orbit/time sequence, FPS/codec, optional overlays.
- **VOL-13 3D selection:** select mesh/label in 3D and highlight in 2D slices.
- **VOL-14 Scene tree:** volumes, channels, labels, point sets, meshes, landmarks.
- **VOL-15 Clipping/cropping:** box/plane/ROI; distinguish display clipping from destructive crop.
- **VOL-16 3D measurement:** surface area, volume, centroid, bounds, principal axes, inertia ellipsoid with voxel anisotropy.
- **VOL-17 Mesh export:** STL/OBJ/PLY where supported; units/coordinate warning.
- **VOL-18 Snapshot:** high-resolution image with scale bar/axes/legend.
- **VOL-19 Performance:** quality/downsample/cache/hardware acceleration/fallback; label preview approximation.
- **VOL-20 Validation:** anisotropic volumes, spheres/ellipsoids, labels, transparency, transforms, exports.

## 18. Colocalization — Coloc 2 concepts

**IDs: COLOC-01–COLOC-14 | Availability: FIJI-COMMON/EXTENSION | Priority: P2**

Coloc 2 is pixel-intensity correlation over space. It is not object-based spatial overlap; keep these as separate workflows.

- **COLOC-01 Channel selection:** A/B channels, ROI/mask image, Z/T range, threshold method; require compatible dimensions and registration.
- **COLOC-02 Mask restriction:** run within ROI/mask; define foreground polarity and exclude ignored pixels from all statistics.
- **COLOC-03 Scatter plot:** A vs B intensities, selected pixels, thresholds, regression/correlation as appropriate.
- **COLOC-04 Pearson R:** coefficient, N, ROI/mask, thresholds, channel order.
- **COLOC-05 Manders:** M1/M2 or actual supported variants; define denominator/threshold.
- **COLOC-06 Costes threshold:** implement full Costes method/randomization if available; do not approximate with global threshold.
- **COLOC-07 Li/other metrics:** expose only implemented methods with formulas/references.
- **COLOC-08 Significance:** randomization/shuffle where supported; report iterations, p-value, conditions.
- **COLOC-09 Visualization:** channels/composite, threshold and mask overlays.
- **COLOC-10 Report:** metrics, thresholds, scatter, ROI, pixel count, channels, axes, calibration, algorithm version.
- **COLOC-11 Batch:** channel pairs across compatible images/ROIs.
- **COLOC-12 Object-based colocalization:** separate module for segmented object overlap, centroid distance, contact, containment, pair relations. Do not label as pixel colocalization.
- **COLOC-13 Interpretation warnings:** acquisition, background, bleed-through, registration, thresholds, biology matter; correlation does not prove binding/interaction.
- **COLOC-14 Validation:** synthetic channels with known correlation/overlap/masks/background/noise.

## 19. Directionality/orientation analysis

**IDs: DIR-01–DIR-10 | Availability: FIJI-COMMON/EXTENSION | Priority: P2/P3**

- **DIR-01 Histogram:** preferred orientations for elongated structures, 180° or configured range.
- **DIR-02 Fourier method:** partition image, Fourier power, angular energy/histogram; patch size, bins, start angle, ROI.
- **DIR-03 Local gradient method:** Sobel-like gradients; orientation histogram weighted by magnitude/power.
- **DIR-04 Statistics:** peak direction, width, secondary peaks; periodic angular fitting.
- **DIR-05 Orientation map:** hue encodes local direction, saturation/brightness as documented; legend.
- **DIR-06 Diagnostics:** angular filters, power spectrum, gradient map.
- **DIR-07 Table:** per-ROI direction, peak fit, bins, params/method; CSV.
- **DIR-08 Multiscale:** compare different patch sizes/scales.
- **DIR-09 Dimensionality:** state 2D vs true 3D; don't describe a 2D histogram as a 3D tensor.
- **DIR-10 Validation:** synthetic line patterns at known angles, isotropic patterns, mixtures.

## 20. Skeleton, neurite, and filament analysis

**IDs: SKEL-01–SKEL-17 | Availability: AnalyzeSkeleton/SNT extensions | Priority: P2/P3**

- **SKEL-01 Skeletonization:** validated 2D/3D thinning; preserve source mask.
- **SKEL-02 Voxel classification:** endpoints, slab/intermediate, junctions; document neighborhood connectivity.
- **SKEL-03 Branch graph:** nodes, edges, branch voxels, calibrated length, endpoint coordinates, skeleton ID.
- **SKEL-04 Branch statistics:** branches, endpoints, junctions, triple/quadruple points, mean/max lengths.
- **SKEL-05 Branch table:** ID, calibrated length, extreme coordinates, Euclidean endpoint distance, tortuosity/path-to-chord ratio where meaningful.
- **SKEL-06 Loops:** detect/prune cycles; no pruning/shortest branch/lowest-intensity voxel or other tested method; preview and retain original.
- **SKEL-07 Terminal pruning:** remove endpoint branches by length/ROI; allow exclusion zones.
- **SKEL-08 Longest shortest path:** compute/display where graph algorithm is valid.
- **SKEL-09 Labeled display:** color-coded skeleton, skeleton and branch IDs.
- **SKEL-10 Sholl:** intersections with concentric circles/spheres around soma/seed; radii and plot.
- **SKEL-11 Strahler:** branch order; root selection and loops handling.
- **SKEL-12 Neurite tracing:** manual/semi/automatic where integrated; seed, edit/delete, tree hierarchy, overlay.
- **SKEL-13 Multidimensional tracing:** multichannel, Z-stack, timelapse; axis/calibration.
- **SKEL-14 Soma detection:** only validated algorithm/model; manual confirmation.
- **SKEL-15 Morphology:** total length, branch count/order, radial distribution, orientation, branch angles, convex hull, density maps.
- **SKEL-16 General filaments:** astrocytes, microglia, vessels, fibers; avoid neuron-only hard-coding.
- **SKEL-17 Export:** SWC or compatible graph, coordinate tables, metrics, visualization; preserve coordinate system/calibration.

## 21. Morphological analysis — MorphoLibJ concepts

**IDs: MORPH-01–MORPH-18 | Availability: EXTENSION | Priority: P1/P2**

- **MORPH-01 2D/3D morphology:** erosion, dilation, opening, closing, gradient, Laplacian, top-hat, other implemented binary/grayscale operators.
- **MORPH-02 Reconstruction:** dilation/erosion reconstruction; hole filling, extrema, border removal.
- **MORPH-03 Watershed GUI:** 2D/3D marker/mask/distance/watershed workflow with preview.
- **MORPH-04 Distance watershed:** binary distance transform + local maxima seeds; 2D/3D.
- **MORPH-05 Label utilities:** border removal, select/crop/replace/remove labels, boundaries, keep/remove largest, size opening.
- **MORPH-06 Size opening:** remove labels below area/volume threshold with unit-aware setting.
- **MORPH-07 Region analysis:** intrinsic volumes, area, volume, perimeter/surface, inertia ellipse/ellipsoid, centroid.
- **MORPH-08 Photometry:** intensity statistics per label on source or registered target image.
- **MORPH-09 Label editor:** select, merge, morphology, remove by size/largest/border/manual, reset.
- **MORPH-10 Connected components:** label connected regions, size/distance/geodesic operations.
- **MORPH-11 3D connectivity:** 6/18/26 convention and topology implications.
- **MORPH-12 Geodesic distance:** within mask/region when supported.
- **MORPH-13 Topology:** Euler number and related descriptors only for validated dimensions/connectivity.
- **MORPH-14 Filtering:** area/volume, border, ID, region features.
- **MORPH-15 Boundaries:** mask and overlay; consistent label mapping.
- **MORPH-16 Merge/split consistency:** update labels, tables, results and old→new ID mapping.
- **MORPH-17 Batch morphology:** recorded settings across images/stacks.
- **MORPH-18 Validation:** structuring element, border, connectivity, size, units.

## 22. 3D object analysis — 3D ImageJ Suite concepts

**IDs: 3D-01–3D-16 | Availability: EXTENSION | Priority: P2/P3**

- **3D-01 Filters:** mean, median, min, max, top-hat, local maxima, edge/symmetry.
- **3D-02 Segmentation:** hysteresis, connected objects, iterative threshold, spots, maxima finder, seed-based watershed.
- **3D-03 Iterative thresholding:** explore thresholds, link object lineage/splits; report stability limitations.
- **3D-04 Spot segmentation:** local threshold estimates and preview.
- **3D-05 3D ROI manager:** volumetric object list, view, select, measure, stable IDs.
- **3D-06 Geometry:** volume/surface/centroid/bounds/mesh/convex hull/principal axes/inertia.
- **3D-07 Mesh measurements:** surface properties and mesh metrics.
- **3D-08 Convex hull:** hull volume/surface/solidity where supported.
- **3D-09 Mereotopology:** containment, overlap, adjacency, separation, contact.
- **3D-10 Drawing:** ellipsoids, lines, 3D ROIs, crop/manipulate.
- **3D-11 Spatial statistics:** 2D/3D relationships with calibration/edge correction.
- **3D-12 Object counter:** threshold/segment, label, volume filter, render, export.
- **3D-13 Data separation:** label image vs intensity image vs mesh.
- **3D-14 Editing:** select/delete/merge/split/recolor/inspect with history.
- **3D-15 Batch:** memory-aware volumetric processing.
- **3D-16 QA:** spheres/cubes/ellipsoids/touching objects/anisotropic volumes/borders/mesh-volume consistency.

## 23. Deconvolution microscopy — DeconvolutionLab2 concepts

**IDs: DECON-01–DECON-18 | Availability: OPTIONAL-RESEARCH/EXTENSION | Priority: P3**

Deconvolution is model-based restoration using a point spread function (PSF) and assumptions about noise/optics. It is not generic sharpening and may introduce artifacts.

- **DECON-01 Input:** observed image/stack + PSF image or theoretical PSF model; validate dimensions, X/Y/Z spacing, channel, normalization.
- **DECON-02 PSF management:** load/generate with optical model; record NA, refractive index, wavelength, voxel spacing; inspect/normalize/save PSF.
- **DECON-03 Direct filters:** naive inverse, regularized inverse, Tikhonov, Laplacian-regularized inverse where supported; explain noise amplification.
- **DECON-04 Iterative methods:** Richardson–Lucy, RL-TV, Landweber/linear least squares, NNLS, bounded-variable least squares, Van Cittert, Tikhonov–Miller, constrained Tikhonov–Miller, FISTA, ISTA where engine supports them.
- **DECON-05 Parameters:** iterations, regularization, stopping tolerance, boundary conditions, positivity, noise model, step size/relaxation; show only relevant controls.
- **DECON-06 2D/3D:** state support explicitly; never flatten a volume to imply 3D deconvolution.
- **DECON-07 Preview/convergence:** intermediate iterations and residual/error curve where feasible; stop/save selected iteration.
- **DECON-08 Batch:** per-image PSF/settings, progress, memory.
- **DECON-09 Headless:** explicit image/PSF/algorithm/parameters.
- **DECON-10 Validation:** simulated objects/PSF/noise; ringing/noise/negative-value tests.
- **DECON-11 Comparison:** observed, PSF, restored, residual.
- **DECON-12 Residual:** image and statistics; visual sharpness is not proof of accuracy.
- **DECON-13 Report:** hashes, PSF params, algorithm, iterations, regularization, runtime, output, warnings.
- **DECON-14 Memory:** tile support only if boundary behavior valid; state minimum memory.
- **DECON-15 Presets:** only documented optical assumptions; no universal defaults.
- **DECON-16 Positivity/range:** expose only supported constraints/clipping; preserve unclipped result.
- **DECON-17 License/citation:** review before integrating code.
- **DECON-18 Research warning:** computational restoration, not ground truth; user review before quantitative use.

## 24. Other specialist Fiji tools

These are optional and should be selected according to TissueAI's actual domain. Check current maintenance, version, license, and installation status before implementation.

### 24.1 BoneJ / BoneJ+ — BONE-01–BONE-12

Relevant only if TissueAI expands into micro-CT or bone morphometry:

- BONE-01 Analyze skeleton with validated 2D/3D workflow.
- BONE-02 Degree of anisotropy from mean intercept length vectors/ellipsoid fitting.
- BONE-03 Trabecular thickness.
- BONE-04 Trabecular spacing/separation.
- BONE-05 Structure model index or other validated 3D structure descriptors.
- BONE-06 Bone volume fraction/BV-TV when supported and calibrated.
- BONE-07 Connectivity and surface/volume descriptors.
- BONE-08 Local thickness maps where supported.
- BONE-09 Input requirements: binary/8-bit image, valid segmentation, voxel spacing, supported dimensions.
- BONE-10 Warnings for non-binary/wrong-type/unsupported hyperstack.
- BONE-11 Export metrics and QC.
- BONE-12 Phantom/domain validation before reporting bone measurements.

### 24.2 SNT — SNT-01–SNT-15

Relevant for neurohistology, neurites, fibers, vessels, and filamentous structures:

- SNT-01 Manual/semi-automatic multidimensional tracing.
- SNT-02 Automated tracing from grayscale or segmented images where available.
- SNT-03 Multi-cell tracing and soma detection where supported.
- SNT-04 Seeded tracing and editable paths.
- SNT-05 Curation and calibrated quality control.
- SNT-06 Multichannel/time-lapse tracing.
- SNT-07 Brainbow-like image support where relevant.
- SNT-08 Sholl analysis.
- SNT-09 Strahler analysis.
- SNT-10 Root angle/arbor orientation.
- SNT-11 Calcium dynamics along neurites where compatible data exists.
- SNT-12 Growth/delineation analysis.
- SNT-13 Connectomics/whole-brain integration only if needed.
- SNT-14 3D visualization/density maps.
- SNT-15 SWC or compatible export and scripting API where supported.

### 24.3 Temporal Color Code — TIME-01–TIME-04

- TIME-01 Create time-colored 2D image from time series or 3D time series.
- TIME-02 Select LUT and frame range.
- TIME-03 Create legend mapping color to frame/time.
- TIME-04 Preserve source stack and frame interval.

### 24.4 Other plugin discovery

Do not clone every plugin listed on every ImageJ update site. A future TissueAI extension catalog may list approved plugins by category (segmentation, visualization, tracking, morphology, registration, deconvolution, analysis, I/O). Evaluate scientific purpose, maintenance, compatibility, license, security, and existing TissueAI equivalence.



# PART C — تطبیق قابلیت‌های ImageJ/Fiji با محصول TissueAI

## 24.5 نگاشت قابلیت‌های عمومی ImageJ/Fiji به محصول TissueAI

این جدول تعیین می‌کند قابلیت‌های علمی موجود در فهرست بالا در کدام بخش محصول قرار بگیرند. ایجنت باید پس از ممیزی مسیر واقعی را ثبت کند؛ مسیرهای زیر مسیر مرجع/پیشنهادی‌اند و به معنی وجود فایل یا کد نیستند.

| حوزه قابلیت | UI موجود/مرجع | command Rust مرجع | هسته پردازش پیشنهادی | ملاحظات TissueAI |
|---|---|---|---|---|
| باز کردن و مدیریت اسلاید | `Editor.tsx` و workspace | `commands/editor.rs` یا command جدید I/O | reader registry + WSI tile source | WSI نباید به bitmap کامل تبدیل شود |
| نمایش، zoom و pan | `Editor.tsx` | tile/viewport commands | tile scheduler + cache | viewport-based rendering و pyramid level |
| ROI و Annotation | `Editor.tsx` / segmentation tools | `commands/editor.rs` / `segmentation.rs` | geometry/annotation engine | مختصات level-0 و مختصات صفحه جدا باشند |
| Stain / Color | `ColorAnalysis.tsx` | `commands/color_analysis.rs` | OD, stain vectors, color statistics | تبدیل نمایش از تغییر داده خام جدا باشد |
| Threshold / Morphology | `Segmentation.tsx` | `commands/segmentation.rs` | segmentation/morphology kernels | عملیات در ROI و tile boundary صحیح باشد |
| Detection / NMS | `Detection.tsx` | `commands/detection.rs` | `tools/detection/` + `ort` | ادغام detection بین tileها ضروری است |
| Batch slides | `MultiSlide.tsx` | `commands/multi_slide.rs` | bounded job queue | محدودیت همزمانی و حافظه |
| Model training | `Trainable.tsx` | `commands/trainable.rs` | Burn/classical ML adapter | split در سطح slide/patient برای جلوگیری از leakage |
| 3D visualization | `ThreeViewer/` و `components/anatomy/` | `commands/three_d.rs` | volume/mesh service | GLB آناتومی با volume microscopy قاطی نشود |
| Measurements | `Editor.tsx` و صفحه Analyze در ابزارها | command جدید یا command موجود مرتبط | measurement engine | واحد فیزیکی و شناسه اسلاید در هر ردیف |
| Processing/filters | editor / panels | `commands/editor.rs` یا `commands/image_processing.rs` | image kernels | عملیات مشتق‌شده و provenance |
| Results / export | صفحات ابزار/جدول‌ها | commands حوزه مربوطه | export/report service | CSV/JSON/OME-compatible sidecar |
| LLM/Copilot | `src/pages/llm/` | `llm/server.rs` و commands امن | local LLM tool registry | دسترسی مدل به تصویر فقط از طریق ابزار مجاز و scope انتخاب‌شده |

### 24.6 قابلیت‌های اختصاصی WSI و Digital Pathology — WSI-01 تا WSI-24

ImageJ/Fiji قابلیت‌های عمومی میکروسکوپی دارند، اما نیاز TissueAI به Whole Slide Imaging باید به‌صورت یک زیرسیستم مجزا و native طراحی شود. نمایش pyramidal WSI، کش tile، viewport و تحلیل ناحیه‌ای، پیش‌نیاز بسیاری از قابلیت‌های بعدی است.

#### WSI-01 — Reader registry و تشخیص نوع اسلاید

- یک registry از reader adapterها ایجاد شود؛ هر adapter قابلیت‌های فرمت، pyramid، metadata، tile read، region read، channel و write را اعلام کند.
- فایل با signature/content و ساختار داخلی شناسایی شود؛ صرف پسوند برای تصمیم قطعی کافی نیست.
- برای هر فایل مشخص شود: reader انتخاب‌شده، نسخه backend، فرمت واقعی، تعداد pyramid levelها، ابعاد level-0، tile size، downsamples، channel/color model، metadata availability و محدودیت‌های احتمالی.
- فرمت‌های WSI مانند Aperio SVS، Hamamatsu NDPI، MIRAX/MRXS، Leica، Philips، 3DHISTECH و TIFF pyramidal فقط در صورت پشتیبانی واقعی adapter فعال نمایش داده شوند. این فهرست وعده پشتیبانی خودکار از همه فرمت‌ها نیست.
- قابلیت «format capability registry» باید به UI بگوید کدام قابلیت read/write/metadata برای هر reader وجود دارد.

#### WSI-02 — معماری pyramid و level selection

- level-0 مرجع مختصات اصلی باشد.
- هر level دارای width، height، downsample factor دقیق/اندازه‌گیری‌شده و metadata خود باشد.
- انتخاب level براساس zoom و device pixel ratio انجام شود؛ تغییر level نباید مختصات ROI را عوض کند.
- fallback برای فایل بدون pyramid: downsample مشتق‌شده با job پس‌زمینه و cache؛ هرگز در اولین بازشدن یک WSI بزرگ full-resolution downsample در UI انجام نشود.
- levelها در project metadata ثبت شوند، اما نیازی به کپی همه tileهای منبع داخل پروژه نیست.

#### WSI-03 — Tile reader و viewport scheduler

- ورودی: `slide_id`, `level`, `x`, `y`, `tile_width`, `tile_height`, `channel/display_profile`.
- خروجی: tile خام/فشرده یا handle قابل دسترسی + مشخصات pixel type، اندازه، origin، level و transform.
- tileها برحسب viewport فعلی و margin پیش‌بارگذاری شوند؛ tileهای خارج viewport با اولویت پایین‌تر.
- درخواست تکراری deduplicate شود؛ tile لغوشده یا دیگر لازم به‌موقع از صف حذف شود.
- خطای یک tile نباید کل اسلاید را از کار بیندازد؛ placeholder خطا و retry محدود داشته باشد.
- tileهای خروجی باید به‌صورت واضح از cache، decoded source و derived tile تشخیص داده شوند.

#### WSI-04 — Cache محدود و کنترل RAM/VRAM

- cache چندسطحی تعریف شود: encoded disk cache (در صورت مجاز بودن)، decoded RAM tile cache، inference/result cache و GPU texture cache.
- هر cache سقف قابل تنظیم و eviction policy (LRU/LFU یا سیاست اندازه‌محور مستند) داشته باشد.
- cache key شامل source fingerprint، reader/level/tile coordinates و پارامترهای موثر باشد.
- هنگام تغییر source، stain transform یا preprocessing، cache نامعتبر با کلید نسخه‌ای شود؛ نتایج نامرتبط reuse نشوند.
- memory budget از hardware profiling دریافت شود؛ هیچ job نباید بدون estimate حداقلی یک WSI را کامل در RAM کپی کند.
- نمایش مصرف RAM، cache، GPU و queue در diagnostics، نه به‌عنوان تزئین UI.

#### WSI-05 — مختصات و تبدیل level-to-level

- همه ROIها و detectionها باید coordinate space مشخص داشته باشند.
- مختصات ذخیره‌شده برای اسلاید WSI به‌صورت پیش‌فرض در level-0 pixel coordinates و با convention مشخص pixel-center/pixel-edge نگهداری شوند.
- تبدیل level `L` به level-0 با downsample factor واقعی همان level انجام شود؛ فرض 2^L ممنوع مگر metadata آن را ثابت کند.
- تبدیل screen↔viewport↔level↔level-0↔physical coordinates در یک ماژول مشترک باشد.
- rotation، mirroring، orientation و vendor offsets در transform لحاظ شود.
- همه تبدیل‌ها unit-test و با نقاط/ROI مرجع بررسی شوند.

#### WSI-06 — نمایش اسلاید با zoom/pan روان

- rendering فقط tileهای لازم viewport را درخواست کند.
- zoom cursor-centered، fit-to-window، 1:1، overview/minimap و navigator قابل ارائه باشد.
- pan باید به‌صورت پیوسته انجام شود، بدون اینکه درخواست سنگین برای هر پیکسل حرکت ایجاد کند؛ درخواست‌ها debounce/coalesce شوند.
- وضعیت loading هر tile جدا از loading کلی اسلاید باشد.
- پشتیبانی از high-DPI و multi-monitor بررسی شود.
- حداکثر frame rendering هدف، تا حد امکان 60 FPS، اما به‌صورت معیار benchmark روی سخت‌افزار هدف گزارش شود؛ هیچ عددی بدون benchmark تضمین نشود.

#### WSI-07 — Region-of-interest read و crop مجازی

- کاربر بتواند rectangle/polygon/ROI را در level-0 مشخص کند و فقط همان region در resolution مطلوب خوانده شود.
- خروجی region شامل origin در level-0، physical calibration، metadata و source ID باشد.
- Crop مجازی به‌صورت view/asset مشتق‌شده ذخیره شود؛ فایل WSI اصلی دست‌نخورده بماند.
- tileهای اطراف لبه region با padding تعریف‌شده خوانده شوند؛ الگوریتم‌هایی مانند convolution و segmentation از edge artifact آگاه باشند.

#### WSI-08 — Multi-resolution thumbnail و slide overview

- overview تصویر از پایین‌ترین pyramid level یا thumbnail استاندارد گرفته شود.
- thumbnail هرگز به‌عنوان منبع محاسبات کمی استفاده نشود.
- نمایش tissue map / empty glass / whitespace اختیاری باشد و الگوریتم/پارامتر آن ثبت شود.
- نمای کلی با viewport rectangle و ROIهای سطح پایین هماهنگ باشد.

#### WSI-09 — Tissue detection و tissue masking

- tissue/background separation با threshold رنگ/OD، saturation، texture یا مدل AI قابل انتخاب باشد.
- قابلیت exclude background، glass، pen marks، folds، bubbles، blur و edge artifacts به‌صورت مرحله‌ای افزوده شود.
- tissue mask در یک سطح preview یا low-resolution ساخته شود و برای پردازش regionهای اصلی به level-0 نگاشت شود.
- نتیجه باید mask/heatmap قابل مشاهده، قابل ویرایش و قابل export باشد؛ خودکار حذف‌کردن tissue از تحلیل ممنوع.
- thresholdها و روش انتخاب در provenance ثبت شوند.

#### WSI-10 — Tissue ROI و compartment annotation

- classes قابل تنظیم مانند tumor، stroma، normal tissue، necrosis، lumen، vessel، fat، artifact و background؛ نام‌ها domain-specific و قابل توسعه باشند.
- ابزار polygon، freehand، brush و assisted boundary داشته باشد.
- class semantic از object instance ID جدا باشد.
- annotation به slide ID، source fingerprint، مختصات level-0 و author/session مرتبط باشد.
- امکان lock، hide، group، merge، split، duplicate، export و audit history.

#### WSI-11 — Patch extraction و sampling

- استخراج tile/patch با اندازه و stride انتخابی در level مشخص.
- sampling با tissue mask، ROI، class label، grid، random seed، balanced class و hard-negative rules.
- کنترل حداقل tissue coverage، blur/focus quality، stain quality و overlap.
- خروجی dataset شامل patch، label/annotation، slide ID، coordinates، pyramid level، downsample، stain/metadata و provenance باشد.
- split داده براساس patient/case/slide group شود تا patchهای یک اسلاید در train و validation/test پخش نشوند.
- قابلیت preview grid و شمارش patchها قبل از export.

#### WSI-12 — Tile-aware image processing

- هر kernel باید مشخص کند local operation است یا نیاز به global context دارد.
- overlap/halo موردنیاز برای Gaussian، median، convolution، morphology و DL inference تعریف شود.
- پس از پردازش tileها، seam handling و blending به‌صورت قابل آزمون اجرا شود.
- برای عملیات global مثل histogram normalization، آمار نمونه‌برداری‌شده یا pass چندمرحله‌ای لازم است؛ میانگین tileها جای آمار کل تصویر فرض نشود.
- برای هر عملیات، `tile_safe`, `halo`, `global_pass_required` در command metadata ثبت شود.

#### WSI-13 — Detection across tiles

- YOLO و detectorهای مشابه روی tileهای overlapدار اجرا شوند.
- مختصات هر tile به level-0 برگردانده شود.
- NMS/Weighted Boxes Fusion/merge سیاست‌های cross-tile جدا از NMS داخل tile داشته باشند؛ فقط الگوریتم واقعاً پیاده‌سازی‌شده فعال باشد.
- objectهای تکراری در مرز tile حذف شوند، بدون حذف دو شیء نزدیک واقعی.
- confidence، class، model version، tile source و original coordinates برای هر detection ذخیره شود.
- خروجی در scaleهای overview و zoom level مناسب نمایش داده شود.

#### WSI-14 — Segmentation across tiles

- semantic/instance segmentation در tileهای overlapدار اجرا شود.
- probability map، binary mask و label map از یکدیگر جدا ذخیره شوند.
- merge کردن instanceها در مرز tile باید object identity و connected component را حفظ کند.
- padding، overlap، threshold، post-processing و stitching policy ثبت شوند.
- objectهای خیلی بزرگ که از چند tile عبور می‌کنند نباید به چند object اشتباه تبدیل شوند.

#### WSI-15 — Heatmap aggregation

- نتایج tile/object به grid یا pyramid heatmap نگاشت شوند.
- map metric قابل انتخاب باشد: detection count، nuclei density، class probability، tissue fraction، stain score یا خروجی مدل مشخص.
- bin size و level-0 mapping، color scale، min/max و normalization ثبت شوند.
- heatmap با داده خام و segmentation overlay قابل روشن/خاموش شدن باشد.
- برای رنگ‌بندی، LUT display-only باشد؛ مقدار عددی heatmap تغییر نکند.

#### WSI-16 — Slide-level summary و spatial statistics

- تجمیع count، density، area fraction، mean/median و distribution در سطح ROI، tissue compartment و کل اسلاید.
- نتایج tile و object به صورت جدا و aggregated قابل مشاهده باشند.
- summary از double-count شدن objectهای مرزی جلوگیری کند.
- آمار با نبود tissue، missing tile، invalid calibration یا skipped regions علامت‌گذاری شود.

#### WSI-17 — Slide quality control

- focus/blur score، tissue coverage، fold/bubble/air-bubble، pen mark، stain outlier، empty regions و tile decode errors به عنوان ابزار QC اختیاری.
- هر QC score نام الگوریتم، scale، threshold، مدل و limitations داشته باشد.
- QC score نباید به‌طور خودکار case را تشخیصی رد کند؛ فقط flag برای بازبینی است.
- نمایش map خطا و فهرست regionهای flagged.

#### WSI-18 — WSI annotation interoperability

- بررسی پشتیبانی import/export فرمت‌هایی مانند GeoJSON و فرمت‌های annotation مرتبط با pathology (مانند ASAP XML یا فرمت‌های vendor) فقط از طریق adapterهای آزموده‌شده.
- mapping مختصات، class، color، geometry و hierarchy حفظ شود.
- اگر فرمت مقصد مفهوم موردنظر را پشتیبانی نمی‌کند، loss report تولید شود.
- import ناشناخته باید dry-run و preview داشته باشد.

#### WSI-19 — WSI export

- export region/patch/overview/mask/label/heatmap/annotation و structured results.
- در صورت پشتیبانی writer، pyramid/OME metadata/calibration حفظ شود.
- نام‌گذاری شامل slide ID، region ID، resolution level، analysis run و suffix واضح باشد.
- export سنگین job-based، cancellable و atomic باشد.

#### WSI-20 — Multi-slide workspace

- چند اسلاید با loading state مستقل، metadata، thumbnails و processing status.
- group کردن بر اساس case/specimen/stain/batch/experiment.
- linked navigation اختیاری فقط برای coordinate spaces معتبر/registered.
- بستن اسلاید در حال پردازش باید cancel یا detach policy واضح داشته باشد.

#### WSI-21 — Reader fallback و محدودیت فرمت

- adapter با شکست کنترل‌شده fallback کند؛ فایل اشتباه یا ناقص با error message قابل تشخیص نمایش داده شود.
- هیچ reader ناشناخته با تغییر پسوند به یک فرمت دیگر مجبور نشود.
- پشتیبانی کامل یک فرمت یعنی read pixel، pyramid، metadata، axes/spacing و orientation در حد ادعاشده تست شده باشد.
- write support جدا از read support اعلام شود.

#### WSI-22 — فایل‌های OME و metadata میکروسکوپی

- OME-XML/OME-TIFF metadata برای ابعاد، channel، Z/T، spacing، physical units، acquisition و plane mapping حفظ شود.
- `DimensionOrder` و mapping واقعی data reader بررسی شود؛ صرفاً فرض `XYCZT` ممنوع.
- metadata ناشناخته حفظ شود یا در sidecar ذخیره شود.
- OME-Zarr فقط در صورت اضافه شدن reader/writer مشخص و تست‌شده فعال شود.

#### WSI-23 — Privacy و de-identification

- نمایش metadata حساس به‌صورت محدود و user-controlled.
- حذف/ماسک فیلدهای شناسایی‌کننده در export، log، crash report و LLM context.
- مسیر source محلی و نام فایل ممکن است PHI داشته باشد؛ logها نباید آن را بی‌دلیل ثبت کنند.
- هر قابلیت شبکه‌ای/remote opt-in و با warning باشد.

#### WSI-24 — WSI diagnostics و benchmark

- گزارش تعداد tile read، cache hit/miss، decode latency، render latency، memory peak، queue wait، failed tile و throughput.
- benchmark شامل اسلایدهای کوچک/بزرگ، pyramid levelها، zoom/pan، cold/warm cache و concurrent jobها باشد.
- benchmark نتیجه را با hardware profile و reader version ذخیره کند.

# PART D — قرارداد فنی پیاده‌سازی در معماری واقعی TissueAI

## 25. نگاشت معماری منطقی به پروژه واقعی

قابلیت‌ها باید در لایه‌های زیر پیاده‌سازی شوند. ایجنت مجاز نیست منطق اصلی را داخل `Editor.tsx` یا سایر کامپوننت‌ها بنویسد.

### 25.1 Presentation Layer — React 19 + TypeScript + Vite + Tailwind

**مسئولیت:** تعامل کاربر، نمایش، فرم‌ها، وضعیت jobها، viewport controls، جدول‌ها و visualization.

- `src/components/tools/Editor.tsx`: viewer و ابزارهای 2D، zoom/pan، ROI interaction، measurement display، overlay و image properties.
- `src/components/tools/Detection.tsx`: model selection، input scope، confidence/IoU parameters، progress، detections table و review/accept/reject.
- `src/components/tools/MultiSlide.tsx`: slide queue، validation، batch settings، progress per slide و combined results.
- `src/components/tools/ColorAnalysis.tsx`: color/stain controls، stain vectors، histograms، channel display و heatmap.
- `src/components/tools/Segmentation.tsx`: threshold، morphology، watershed، mask/label controls و curation.
- `src/components/tools/Trainable.tsx`: annotation dataset، feature/model settings، train/validation workflow، metrics و export.
- `src/components/tools/ThreeViewer/`: viewer حجم/مش/برش و تعامل 3D مرتبط با داده‌ای که backend آماده کرده است.
- `src/components/anatomy/`: GLB/GLTF آناتومی و anatomy-specific UI؛ این بخش نباید برای نمایش خودکار داده‌های حجیم WSI استفاده شود.
- `src/pages/llm/`: Local LLM manager، conversation UI، tools status و permission scope.
- `src/hooks/`: hookهای بارگذاری، job lifecycle، event subscription و state synchronization؛ منطق محاسباتی تصویر در hook نوشته نشود.

اگر صفحه یا component دیگری در repo وجود دارد، ساختار واقعی پروژه اولویت دارد. فایل‌های نام‌برده بالا مسیرهایی هستند که کاربر در معماری معرفی کرده است.

### 25.2 Native Core — Rust + Tauri v2

Rust باید مالک canonical data و عملیات باشد. ماژول‌های فعلی حفظ شوند و در صورت نیاز زیرماژول اضافه شود:

| حوزه | محل command مرجع | محل engine مرجع |
|---|---|---|
| Detection/YOLO/ONNX | `commands/detection.rs` | `tools/detection/` |
| Color/stain | `commands/color_analysis.rs` | `tools/color/` یا ماژول موجود |
| Segmentation/morphology | `commands/segmentation.rs` | `tools/segmentation/` |
| Training | `commands/trainable.rs` | Burn/classical ML/training service |
| Editor/ROI/measurement/filter | `commands/editor.rs` یا commandهای تفکیک‌شده | image core / processing / analysis |
| 3D | `commands/three_d.rs` | volume/mesh/geometry engine |
| Multi-slide | `commands/multi_slide.rs` | WSI reader + bounded job scheduler |
| I/O | command موجود یا `commands/image_io.rs` جدید | reader/writer registry |
| Project/history | command موجود یا `commands/project.rs` جدید | project store/provenance |
| Hardware | command موجود یا diagnostics service | GPU/CPU/RAM profile |
| LLM | `llm/server.rs`, `runtime.rs`, `models.rs` | local inference/process manager |
| Secrets | `llm/provider_secrets.rs`, `crypto.rs` | keyring/AEAD/in-memory model loader |

به‌جای یک `editor.rs` بسیار بزرگ، در صورتی که حجم منطق رشد کرد، command façade را کوچک نگه دارید و engine را در `tools/` یا ماژول‌های دامنه‌ای تفکیک کنید. ساختار نهایی باید با conventions واقعی repo سازگار باشد.

### 25.3 وابستگی‌ها و نسخه‌ها

طبق معماری معرفی‌شده، stack شامل این اجزاست؛ اما پیش از integration باید Cargo/Node manifests خوانده شود:

- `tauri` v2 و pluginهای واقعی پروژه.
- `tokio` و `axum`/`hyper-util` برای async server و local endpoints.
- `ort` برای ONNX Runtime؛ نسخه و API واقعی crate با Cargo.lock بررسی شود.
- `burn` برای native training/inference در محدوده backendهای واقعاً پشتیبانی‌شده.
- `image` برای فرمت‌های raster رایج؛ نه به‌عنوان WSI reader عمومی.
- `ndarray` برای آرایه‌ها/tensor operations در جاهایی که سازگار است.
- `aes`, `cbc`, `cipher`, `aes-gcm`, `sha2`, `keyring` و سایر crateهای crypto موجود.
- Frontend: React، Zustand، Radix، Tailwind، Three.js و dependencyهای ثبت‌شده در package lock.

قانون: نسخه‌ها را بی‌دلیل bump نکنید. نسخه‌های Release Candidate یا APIهایی مانند `commit_from_memory` باید دقیقاً با نسخه نصب‌شده و مستندات همان نسخه تأیید شوند. کد نمونه متعلق به نسخه دیگر را بدون تطبیق به repo کپی نکنید.

---

## 26. Canonical Image & WSI Data Model

این بخش مهم‌ترین زیربنای فنی است. اگر مدل داده فعلی معادل دارد، آن را توسعه دهید؛ مدل دوم و ناسازگار نسازید.

### 26.1 ImageAsset / SlideAsset

هر منبع تصویر باید شناسه پایدار و metadata مشخص داشته باشد. حداقل فیلدهای منطقی:

- `asset_id`: شناسه یکتا و پایدار در project.
- `asset_kind`: raster، microscopy stack، WSI، derived image، label map، probability map یا volume.
- `source_uri`: مسیر یا URI محلی؛ در log عمومی redact شود.
- `source_fingerprint`: checksum/hash یا شناسه تغییر فایل برای تشخیص source replacement.
- `reader_id` و `reader_version`.
- `pixel_type`: uint8، uint16، int16، float32، RGB یا نوع پشتیبانی‌شده دیگر.
- `dimensions`: width، height، channel count، Z، T، series/scene و axis descriptors.
- `pyramid_levels[]`: width/height/downsample/tile size/available status.
- `calibration`: pixel/voxel size، unit، origin، source و validity.
- `metadata_ref`: metadata structured/raw و OME/DICOM fields.
- `color_model`: grayscale، RGB، indexed، multichannel، stain-separated و غیره.
- `display_profile`: LUT/range/opacity/visible channels؛ فقط display state.
- `provenance_ref`: lineage و processing history.
- `access_mode`: full buffer، tiled، virtual، memory-mapped یا remote-disabled.

### 26.2 Typed pixel source و lazy access

از یک مدل انتزاعی برای read استفاده کنید تا kernelها بین full image و tile source تفاوت غیرضروری نداشته باشند:

- `ImageSource` یا معادل فعلی باید `read_region`, `read_plane`, `read_tile`, `read_metadata` و قابلیت‌های پشتیبانی‌شده را عرضه کند.
- خروجی region باید نوع داده و strides/row layout مشخص داشته باشد.
- interleaved و planar channel layout باید صریح باشد.
- endian و signedness در decode حل شود و در metadata ثبت شود.
- برای WSI از full-slide `Vec<u8>` استفاده نکنید.
- اگر یک algorithm فقط روی full image اجرا می‌شود، پیش از اجرا تخمین حافظه و محدودیت را بررسی کند؛ در WSI ابتدا tiled implementation یا ROI mode را ترجیح دهید.

### 26.3 جدا بودن چهار لایه داده

1. **Source pixels:** نمونه‌های خام اصلی.
2. **Derived pixels:** خروجی فیلتر یا transform، با parent asset و parameter provenance.
3. **Analysis products:** mask، label، probability map، detection، ROI، measurement و table.
4. **Display products:** LUT، contrast range، overlay opacity، color mapping، viewport و selected object.

تغییر Display هیچ‌گاه نباید Source pixels را تغییر دهد. تغییر segmentation نیز نباید display profile را به‌عنوان داده اصلی ذخیره کند.

### 26.4 Typed arrays و دقت عددی

- تبدیل 16-bit یا float به 8-bit فقط برای نمایش preview مجاز است و باید صریح باشد.
- histogram برای 16/32-bit با bin policy روشن ساخته شود.
- intermediateهای محاسباتی باید در صورت نیاز float32/float64 باشند؛ overflow integer و accumulation loss تست شود.
- NaN، infinity، saturated pixels و invalid calibration به‌صورت explicit مدیریت شوند.
- output metadata نوع دقیق و هر تبدیل قبلی را ثبت کند.

### 26.5 Calibration و coordinate systems

مختصات باید حداقل این فضاها را از هم جدا کنند:

- pixel coordinates در level-0؛
- pixel coordinates در pyramid level؛
- ROI-local coordinates؛
- physical coordinates مثل µm/mm؛
- viewport/screen coordinates؛
- Z/T/channel axis coordinates؛
- registered/transformed coordinates؛
- volume coordinates برای Z-stack/3D.

هر transform شامل origin، scale، direction، units، axis order و convention پیکسل/voکسل باشد. تمام measurementها باید calibration state را همراه نتیجه ثبت کنند. وقتی calibration نامعلوم است، مقدار فیزیکی نسازید و فقط pixel units نمایش دهید.

---

## 27. WSI Reader & Storage Architecture

### 27.1 انتخاب مسیر Reader

- crate عمومی `image` برای PNG/JPEG/BMP و فرمت‌های معمول مناسب است، اما نباید به‌عنوان راه‌حل جامع WSI معرفی شود.
- برای WSI vendor formats، یک adapter native مثل OpenSlide/libvips یا reader معتبر دیگر را ارزیابی کنید. اتصال Rust می‌تواند از crate bindings یا FFI به library بومی استفاده کند؛ روش انتخابی باید build و deployment در سیستم‌عامل‌های هدف را پوشش دهد.
- Bio-Formats غالباً با اکوسیستم Java شناخته می‌شود. چون TissueAI به‌صورت Native Rust طراحی شده، اجرای JVM نباید dependency اجباری core باشد. اگر فرمت خاصی با راهکار native قابل خواندن نیست، Bio-Formats را فقط به‌صورت optional bridge/worker، با installer و runtime شفاف، data isolation، process supervision و offline packaging ارزیابی کنید.
- قبل از افزودن هر reader، license (به‌ویژه LGPL/GPL و الزامات dynamic linking)، distribution obligations، codec و patent constraints را بررسی کنید.
- پشتیبانی read و write جداگانه تعریف شود. امکان خواندن یک WSI به معنی قابلیت ذخیره همان فرمت نیست.

### 27.2 Reader adapter contract

هر adapter حداقل باید این عملیات را پیاده کند یا عدم پشتیبانی را اعلام کند:

- `probe(path)`؛ تشخیص احتمالی فرمت و confidence.
- `open(path, options)`؛ بازکردن resource با handle.
- `metadata(handle)`؛ ابعاد، axes، spacing، labels، acquisition metadata.
- `pyramid_info(handle)`؛ تعداد levelها و downsampleها.
- `read_region(handle, region, level, channel)`؛ decode منطقه‌ای.
- `read_plane(handle, c, z, t)`؛ فقط برای داده multidimensional.
- `close(handle)`؛ آزادسازی قطعی resource.
- `write(...)`؛ فقط در صورت پشتیبانی واقعی.
- `capabilities()`؛ اعلام metadata/pyramid/tile/ROI/OME/read/write support.

Errorها باید به شکل domain-specific برگردند: unsupported format، corrupt file، permission denied، truncated data، decoder error، missing codec، invalid region و resource exhausted.

### 27.3 Tile scheduling

- درخواست‌های tile بر اساس viewport ساخته شوند.
- queue priority بر اساس visible-now، near-viewport، overview و prefetch باشد.
- درخواست‌های قدیمی viewport با حرکت کاربر cancel/coalesce شوند.
- محدودیت همزمانی برای I/O، decode، CPU processing و GPU upload جدا تعریف شود.
- برای جلوگیری از starvation، کارهای batch بزرگ نباید tileهای قابل مشاهده را مسدود کنند.
- tile cache key باید source fingerprint و parameters موثر را شامل شود.

### 27.4 Transport میان Rust و Frontend

IPC نباید payload حجیم را به JSON string تبدیل کند.

- commandهای معمولی، request/response کوچک و metadata برگردانند: `asset_id`، `tile_handle`، bounds، pixel type، dimensions و job state.
- برای pixel payload یکی از مسیرهای مناسب و benchmark‌شده استفاده شود: Tauri custom protocol/asset resource با token محدود، binary transfer/channel پشتیبانی‌شده در نسخه موجود، یا shared resource امن با lifecycle مشخص.
- از نگهداری pointer خام Rust در JavaScript یا فرض shared-memory بدون synchronization پرهیز کنید.
- tile handle باید scope، lifetime، ownership، expiry و cleanup مشخص داشته باشد.
- URL/resource token نباید دسترسی آزاد به arbitrary filesystem بدهد.
- با توجه به نسخه واقعی Tauri، مکانیزم انتقال انتخاب و تست شود؛ این سند API مشخصی را که ممکن است در نسخه نصب‌شده وجود نداشته باشد، تحمیل نمی‌کند.

---

## 28. Tauri IPC, Jobs, Events & Cancellation Contract

### 28.1 Commandها باید control-plane باشند

Tauri commandها orchestration و validation را انجام دهند؛ algorithm سنگین در engine module قرار گیرد. request/responseها typed و versionable باشند.

نمونه schema مفهومی:

```text
StartAnalysisRequest {
  request_id,
  asset_id,
  operation_id,
  operation_version,
  input_scope,
  roi_ids?,
  parameters,
  output_policy,
  resource_policy
}

StartAnalysisResponse {
  job_id,
  accepted,
  estimated_work?,
  warnings[]
}

JobProgressEvent {
  job_id,
  stage,
  progress_fraction?,
  completed_units?,
  total_units?,
  message_key?,
  metrics?
}

JobCompletedEvent {
  job_id,
  output_asset_ids[],
  result_ref?,
  provenance_id,
  warnings[]
}

JobFailedEvent {
  job_id,
  error_code,
  safe_message,
  retryable,
  context_id
}
```

این نام‌ها قرارداد مفهومی‌اند؛ آن‌ها را با naming واقعی پروژه یکپارچه کنید.

### 28.2 Lifecycle هر job

1. `validate`: اعتبارسنجی input، permissions، dimensions، parameter ranges و output.
2. `estimate`: تخمین RAM/VRAM، تعداد tile، زمان تقریبی در صورت امکان.
3. `queued`: ثبت job و نمایش در UI.
4. `running`: پردازش با stage و progress قابل اتکا.
5. `cancelling`: درخواست لغو و توقف امن در boundary مناسب.
6. `completed` یا `failed` یا `cancelled`: پایان قطعی و cleanup.
7. `persisted`: ثبت result/provenance و آزادسازی منابع موقت.

Progress نباید جعلی یا timer-based باشد؛ باید از تعداد tile/step/iteration واقعی محاسبه شود.

### 28.3 Async runtime و CPU jobs

- Tokio برای I/O و orchestration asynchronous است؛ async بودن به معنی موازی‌شدن خودکار حلقه‌های پردازش پیکسلی نیست.
- عملیات CPU-heavy را روی thread pool محاسباتی یا blocking pool محدود اجرا کنید.
- تعداد workerها براساس hardware profile و تنظیمات کاربر محدود شود.
- job cancellation از atomic flag/cancellation token یا مکانیزم سازگار فعلی استفاده کند.
- هر tile/iteration در نقطه امن cancellation را بررسی کند.
- panic در job نباید کل app را crash کند؛ boundary و error context مناسب داشته باشد.

### 28.4 Event naming و event isolation

Eventها شامل job ID و project/session ID باشند تا event یک job در صفحه یا project دیگر اشتباه نمایش داده نشود. UI پس از unmount باید listener را unsubscribe کند. eventهای پرتکرار coalesce/throttle شوند؛ هر tile update به‌تنهایی یک React render گسترده ایجاد نکند.

### 28.5 Error taxonomy

خطاهای backend را به دسته‌هایی مانند `INVALID_INPUT`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_PIXEL_TYPE`, `MISSING_CALIBRATION`, `MODEL_LOAD_FAILED`, `MODEL_INCOMPATIBLE`, `GPU_UNAVAILABLE`, `OUT_OF_MEMORY`, `IO_ERROR`, `CANCELLED`, `NUMERICAL_FAILURE`, `LICENSE_BLOCKED` و `INTERNAL` تبدیل کنید. UI باید پیام فارسی/انگلیسی قابل فهم داشته باشد، اما log فنی دقیق و redact شده بماند.

---

## 29. Mapping قابلیت‌های اصلی به ماژول‌های TissueAI

### 29.1 Editor — ImageJ viewer, ROI و analysis پایه

**Frontend:** `src/components/tools/Editor.tsx`  
**Backend facade:** `src-tauri/src/commands/editor.rs` (یا commandهای domain-specific در صورت رشد)  
**Engine پیشنهادی:** image source، viewer tiles، ROI geometry، calibration، measurements، filters، histogram و project state.

قابلیت‌هایی که باید در Editor/زیرپنل‌های آن قابل دسترسی باشند:

- open/close/recent، image properties و metadata inspector.
- pyramid WSI viewport، 2D raster viewer، stack/hyperstack navigation.
- channel select/composite، LUT، brightness/contrast و threshold preview.
- zoom/pan/fit/1:1/magnifier/overview، pixel inspector.
- selection tools: point، line، polyline، rectangle، oval، polygon، freehand، wand و brush mask.
- ROI manager، class, label, color, visibility, lock, group, plane/slide association.
- scale bar، calibration wizard، measurements و results table.
- image compare، source/derived views، undo/redo در حد واقعاً پشتیبانی‌شده.
- filter/transform dialogs و processing history.

Editor نباید همه ابزارها را به نوار شلوغ تبدیل کند. ابزار براساس mode و selection context نمایش داده شود.

### 29.2 ColorAnalysis — stain, color و histology analysis

**Frontend:** `ColorAnalysis.tsx`  
**Backend:** `commands/color_analysis.rs`  
**Engine:** OD matrix، stain vectors، color statistics، normalization و heatmap.

قابلیت‌های پایه/تکمیلی:

- RGB channel histogram و dominant color analysis.
- RGB↔HSV/HSB و color spaceهای دقیقاً پیاده‌سازی‌شده.
- optical density transform با مدیریت صفر/near-zero و intensity normalization.
- H&E stain separation؛ H و E channels مستقل با stain vector قابل تنظیم.
- IHC DAB/Hematoxylin و custom stain vectors.
- stain vector estimation با preview، quality check و ذخیره preset.
- color deconvolution output، channel histograms، area/intensity measurements.
- color normalization روش‌مند (مانند روش‌های مبتنی بر stain matrix) فقط با پیاده‌سازی معتبر، parameterها و paper/reference ثبت‌شده.
- heatmap بر مبنای شمارش/تراکم/احتمال/score واقعی، با legend و range.
- inpainting یا artifact correction فقط به‌عنوان derived output با نمایش قبل/بعد و provenance؛ برای نواحی تشخیصی به‌صورت خودکار و بی‌ردپا اعمال نشود.

قانون علمی: stain separation مدل ریاضی بر اساس stain vectors است؛ انتخاب بردار نامناسب می‌تواند اندازه‌گیری را منحرف کند. TissueAI باید روش، vector، normalization و warnings را کنار نتایج ذخیره کند.

### 29.3 Segmentation — binary, semantic, instance و 3D

**Frontend:** `Segmentation.tsx`  
**Backend:** `commands/segmentation.rs`  
**Engine:** `tools/segmentation/` و ماژول‌های morphology/label.

- global/local threshold و الگوریتم‌های آزموده Otsu، Huang، Triangle، Yen، Li و مواردی که واقعی پیاده‌سازی شده‌اند.
- manual brush/polygon/wand، ROI-to-mask و add/subtract/erase.
- binary mask، semantic label map، instance label map و probability map مجزا.
- connected components با connectivity مشخص.
- erosion/dilation/open/close/fill holes/remove border/size filter.
- distance transform، local maxima، marker-controlled watershed و split touching nuclei.
- label manager: select, merge, split, relabel, filter, edit, recolor, hide/show, remove.
- tile-aware segmentation برای WSI با overlap/halo و merge بین tileها.
- 2D، slice-wise، 2.5D و true 3D را به‌وضوح تفکیک کنید.
- نتیجه با source، model/algorithm version، parameters، calibration و provenance ذخیره شود.

برای هر segmentation metrics در صورت وجود reference ground truth: Dice، IoU، precision/recall، object-level matching، Hausdorff/ASSD و boundary metrics. متریک‌های نامناسب برای نوع خروجی را نمایش ندهید.

### 29.4 Detection — YOLO/ONNX و detection تخصصی سلولی

**Frontend:** `Detection.tsx`  
**Backend:** `commands/detection.rs`  
**Engine:** `tools/detection/` و ONNX Runtime از طریق `ort`.

- model registry برای ONNX/ENC: display name، architecture metadata، class map، input size، normalization، labels، checksum، encryption status و compatibility.
- inference session reuse؛ مدل برای هر tile دوباره بارگذاری نشود.
- CPU/GPU execution provider فقط اگر build/runtime دستگاه آن را پشتیبانی کند.
- preprocessing دقیق: resize/letterbox، channel order، normalization، dtype و input dimensions.
- output decoder بر اساس مدل؛ Bounding Box، class, confidence، NMS یا post-processing متناظر.
- tile inference در WSI، overlap، coordinate remapping و cross-tile deduplication.
- per-object stable ID، center/box/polygon اگر خروجی مدل دارد، class، score، model version، source coordinate و review status.
- filter by class/confidence/ROI، accept/reject، bulk review و export CSV/JSON.
- heatmap یا spatial density از detectionها با binning مستند.
- inference failure، model incompatibility و provider fallback باید آشکار و قابل تشخیص باشند.

### 29.5 MultiSlide — pipeline و batch processing

**Frontend:** `MultiSlide.tsx`  
**Backend:** `commands/multi_slide.rs`  
**Engine:** WSI reader registry + bounded job scheduler + reusable analysis pipeline.

- افزودن چند اسلاید/دایرکتوری، deduplication و preflight validation.
- scan فرمت، dimensions، pixel/pyramid info، stains، calibration و metadata.
- group by case/specimen/stain/batch و metadata filters.
- انتخاب pipeline و model؛ پارامترها با version snapshot.
- concurrency محدود براساس RAM/VRAM/CPU و I/O.
- per-slide status و total progress واقعی.
- pause/cancel/retry failed item؛ Stop/continue policy.
- output directory/project، collision policy، overwrite/skip/versioned output.
- consolidated CSV/JSON، slide summary، error report و QC.
- failed slides نباید silently skip شوند.

### 29.6 Trainable — annotation، dataset و training

**Frontend:** `Trainable.tsx`  
**Backend:** `commands/trainable.rs`  
**Engine:** Burn و در صورت نیاز classical ML adapter.

Workflow کامل:

1. انتخاب slide/image و ساخت annotation classes.
2. ایجاد polygons/brush masks/points/instance IDs.
3. استخراج patchها، ویژگی‌های pixel/texture/morphology/color و metadata.
4. dataset validation، class balance، duplicate detection و leakage check.
5. split گروه‌بندی‌شده در سطح patient/case/slide؛ patchهای یک case بین train/test تقسیم نشوند.
6. انتخاب الگوریتم و model config؛ ثبت seed و hyperparameters.
7. training job با progress، cancellation، checkpoint و resource monitoring.
8. validation metrics و confusion matrix، precision/recall/F1/IoU/Dice با توجه به task.
9. test set مستقل؛ test set در hyperparameter tuning استفاده نشود.
10. model registry، version، checksum، training data manifest و evaluation report.
11. inference preview روی اسلایدهای hold-out و correction loop.
12. export تنها در فرمت واقعاً قابل تولید.

**Burn:** از Burn برای مدل‌ها و backendهایی استفاده شود که در نسخه فعلی project واقعاً پشتیبانی می‌شوند. ndarray/autodiff به‌تنهایی به معنی GPU training نیست. ایجنت باید backend device و سرعت آن را اندازه‌گیری کند.

**Random Forest / Weka-like classifier:** ImageJ/Fiji از workflowهای classical ML استفاده می‌کند؛ این قابلیت خودبه‌خود معادل Burn نیست. اگر Random Forest اضافه می‌شود، از implementation Rust معتبر یا engine اختصاصی آزموده‌شده استفاده کنید و feature extraction/serialization را مشخص کنید.

**Export:** خروجی Burn-native، ONNX یا format دیگر فقط در صورتی فعال شود که exporter سازگار و numerical parity test وجود داشته باشد. تولید مستقیم PyTorch `.pt` یا ONNX را بدون pipeline واقعی ادعا نکنید. برای interoperability بهتر، مسیر training/export مستقل development tool می‌تواند اختیاری باشد، اما runtime کاربر به Python وابسته نشود.

**Annotation format:** import/export LabelMe JSON در صورت mapping درست. برای multi-polygon، holes، instance labels و WSI coordinate metadata ممکن است extension schema یا sidecar لازم باشد؛ اطلاعات از دست‌رفته باید گزارش شود.

### 29.7 ThreeViewer و 3D

**Frontend:** `ThreeViewer/` و `components/anatomy/`  
**Backend:** `commands/three_d.rs`  
**Engine:** volume/mesh preparation، 3D morphology و mesh measurements در Rust.

دو مسیر مستقل:

- **Anatomical model viewer:** GLB/GLTF ارگان‌ها، mesh scene، orbit controls، section/visibility/material/highlight.
- **Microscopy volume viewer:** Z-stack، voxel spacing، orthogonal planes، volume/maximum-intensity projection، isosurface/mesh و segmentation overlays.

قابلیت‌های volume microscopy نیازمند data model و memory policy جدا از فایل mesh GLB هستند. برای هر volume، voxel anisotropy، channel، Z spacing، interpolation و physical units رعایت شود. Three.js برای render و interaction است؛ استخراج surface/mesh و volume analysis در engine انجام شود.

### 29.8 LLM / Copilot integration

**Frontend:** `src/pages/llm/`  
**Backend:** `src-tauri/src/llm/` و local server.

- Local LLM ممکن است commandها و نتایج analysis را با اجازه کاربر orchestrate کند.
- LLM مستقیماً فایل‌سیستم یا image buffer را بدون tool policy باز نکند.
- ابزارهای مجاز مانند `get_slide_metadata`, `get_measurements`, `run_segmentation`, `export_results` باید schema، permission، input validation و audit داشته باشند.
- برای اجرای jobهای سنگین LLM فقط job request ایجاد کند و progress از job service خوانده شود.
- prompt context شامل PHI، مسیر فایل یا metadata حساس نباشد مگر کاربر انتخاب و تأیید کند.
- تحلیل زبانی model، جایگزین algorithm output یا human review نیست؛ confidence ساختگی یا diagnosis قطعی تولید نکند.
- MCP server محلی نیز با ابزارهای محدود، resource scope و permission اجرا شود.

---

## 30. Command Registry و schema واحد برای ابزارها

تمام عملیات ImageJ/Fiji-like باید از registry واحدی قابل استفاده در UI، batch و pipeline باشند؛ منطق نباید برای هر مسیر جداگانه دوباره نوشته شود.

هر command حداقل:

- `operation_id` و `operation_version` پایدار؛
- category، title، description و help؛
- accepted asset kinds، pixel types، dimensions و channel modes؛
- parameter schema: type، default، range، unit، enum، validation و dependencies؛
- input scope: image/ROI/selected planes/channel/Z/T/slide/tile;
- `tile_safe`, `halo`, `requires_global_pass`, `supports_cancel`؛
- memory estimate یا memory class؛
- output contract و output asset kind؛
- provenance serializer و stable error codes؛
- unit/integration/golden tests.

UI از schema برای ساخت controlها استفاده کند، ولی نباید schema را صرفاً از عنوان command حدس بزند. تمام پارامترها در backend دوباره validate شوند؛ اعتبارسنجی frontend کافی نیست.

### 30.1 Operation categories

- `io.*`: open, inspect, import, export, relink.
- `display.*`: LUT, contrast, channel composition, viewport.
- `roi.*`: create, edit, boolean, measure, import/export.
- `process.*`: blur, filter, transform, arithmetic, FFT.
- `color.*`: stain separation, OD, normalization, heatmap.
- `segment.*`: threshold, morphology, watershed, label operations.
- `detect.*`: ONNX inference, NMS, tile merge.
- `analyze.*`: particles, histograms, morphometry, colocalization.
- `track.*`: detection tracking, link, trajectory analysis.
- `register.*`: alignment, drift, stitching.
- `volume.*`: orthoslices, 3D segmentation, object analysis.
- `batch.*`: multi-slide run, pipeline, export.

---

## 31. Processing Graph, History & Provenance

### 31.1 مدل operation history

برای هر خروجی یک provenance record ذخیره شود:

- operation ID/version و engine version؛
- asset input IDs و source fingerprints؛
- parameterهای نهایی و validated؛
- ROI/annotation IDs و versions؛
- calibration/transform snapshot؛
- model ID/version/checksum و preprocessing؛
- زمان شروع/پایان، دستگاه/Provider و runtime؛
- warnings، skipped regions/tiles و quality metrics؛
- output asset IDs و checksum در صورت امکان.

### 31.2 Non-destructive workflow

- Source immutable بماند.
- هر operation خروجی جدید بسازد یا یک derived graph node ایجاد کند.
- اگر cache/recompute استفاده می‌شود، cache از provenance و source hash مشتق شود.
- Undo/redo برای annotation و display باید فوری باشد؛ برای پردازش حجیم از versioning/graph استفاده شود.
- Undo زمانی نمایش داده شود که واقعاً امکان بازگشت وجود داشته باشد.

### 31.3 Project file format

از یک container یا directory project versioned استفاده شود. ساختار پیشنهادی مفهومی:

```text
<ProjectName>.tissueai/
├── manifest.json
├── assets/
│   ├── source_refs.json
│   ├── derived/
│   ├── masks/
│   ├── labels/
│   ├── probabilities/
│   └── thumbnails/
├── metadata/
├── annotations/
├── rois/
├── models/
│   └── model_manifests/
├── analyses/
│   ├── tables/
│   ├── plots/
│   ├── heatmaps/
│   └── reports/
├── pipelines/
├── provenance/
└── autosave/
```

- فایل چند گیگابایتی را در JSON/SQLite BLOB واحد نریزید؛ source می‌تواند external reference بماند.
- metadata و manifest دارای schema version باشند.
- migration نسخه‌های قدیمی پروژه با backup و validation انجام شود.
- write به‌صورت atomic یا temp+rename؛ خرابی حین write قابل بازیابی باشد.
- پروژه با source file missing باز شود و relink workflow ارائه دهد.
- export مستقل از project نیز امکان‌پذیر باشد.

---

## 32. AI Runtime, ONNX, Burn & Model Registry

### 32.1 ONNX Runtime

- `ort` sessionها با lifecycle مدیریت شوند؛ مدل برای هر درخواست دوباره load نشود.
- input/output tensor names، dimensions، dynamic axes، type و metadata مدل inspect شوند.
- preprocessing config بخشی از model manifest باشد؛ channel order، scaling، mean/std، resize policy، color conversion و normalization باید دقیق.
- مدل ONNX خام و encrypted `.enc` مسیر load سازگار ولی جدا داشته باشند.
- GPU provider detection با fallback شفاف CPU؛ عدم دسترسی GPU نباید silently به ادعای GPU execution منجر شود.
- concurrency session و memory consumption محدود شود.
- برای inference چندtile، micro-batching در صورت سودمند بودن و با تست انجام شود.

### 32.2 Model manifest

هر مدل دارای manifest باشد:

- `model_id`, `version`, `display_name`, `task_type`, `architecture`;
- model file format، file hash، encryption metadata؛
- input/output tensor schema؛
- class labels/colors؛
- preprocessing/postprocessing؛
- expected input dimensions و dynamic dimension behavior؛
- recommended providers، minimum memory و hardware notes؛
- training provenance، dataset/license/source و evaluation report؛
- model license/use restrictions؛
- supported image kinds/axes/tiles.

### 32.3 مدل‌های آماده و specialist adapters

- YOLO detector از طریق ONNX adapter.
- StarDist/Cellpose-style segmentation فقط اگر model export/runtime با `ort` سازگار باشد یا adapter جدا و offline package مستند ساخته شود.
- Labkit/Weka-like pixel classifier در TissueAI می‌تواند به Rust-native feature extraction + classifier adapter ترجمه شود؛ اجرای plugin Java نباید پیش‌فرض باشد.
- مدل‌های segmentation instance و semantic را قاطی نکنید.
- model zoo محلی metadata/license/size/checksum داشته باشد.

### 32.4 Burn training

- Burn برای training native مناسب است، مشروط به backendهای نصب‌شده و serialization قابل استفاده.
- training dataset به صورت stream/patch load شود؛ کل dataset و اسلاید WSI یک‌جا در RAM نرود.
- deterministic seed، optimizer، learning rate، batch size، epochs، augmentation، checkpoint frequency و early stopping ثبت شود.
- data augmentation فقط روی training set اعمال شود.
- split براساس case/patient/slide group و leakage detection اجباری.
- validation و test report جدا باشند.
- خروجی model versioned و قابل load از inference engine باشد؛ اگر Burn checkpoint را `ort` نمی‌تواند اجرا کند، adapter یا export واقعی لازم است.

### 32.5 GPU/Hardware profiling

- CPU core count، RAM available، GPU adapters، VRAM، driver/runtime/provider availability و temperature فقط از APIهای قابل اعتماد سیستم گرفته شوند.
- availability با utilization یکسان نیست؛ metrics ناموجود به‌صورت `unavailable` نمایش داده شوند، نه صفر.
- هنگام اجرای job، device/provider واقعی و peak memory ثبت شود.
- تنظیمات concurrency براساس benchmark و available resources انجام شود.
- GPU failure/capability mismatch با پیام روشن و fallback policy user-configurable باشد.

---

## 33. Security, Encryption & Offline Guarantee

### 33.1 Open-source behavior

- هیچ activation آنلاین، license lock، date lock یا remote kill switch اضافه نشود.
- مدل ONNX/GGUF بازمتن مجاز به load مستقیم باشد.
- مدل‌های proprietary فقط زمانی قابل استفاده باشند که کاربر مجوز/کلید مناسب دارد.

### 33.2 رمزنگاری مدل

معماری فعلی به AES-256-CBC + PKCS#7 اشاره می‌کند. CBC به‌تنهایی authenticated encryption نیست؛ برای تشخیص دست‌کاری ciphertext باید MAC مستقل encrypt-then-MAC یا مهاجرت سازگار به AEAD مانند AES-GCM بررسی شود.

- قالب `.enc` باید versioned باشد: magic bytes، version، algorithm، KDF/key derivation metadata، IV/nonce، authentication tag/MAC، ciphertext length و model metadata.
- برای legacy CBC، integrity check با MAC و compatibility test الزامی است؛ padding errors نباید oracle قابل سوءاستفاده بسازند.
- secret ثابت یا master key داخل سورس/Frontend/package resource قرار نگیرد.
- `TISSUEAI_MODEL_KEY` اگر استفاده می‌شود، runtime secret است و نباید به‌اشتباه build-time constant تلقی شود یا در log چاپ شود.
- برای user-specific key management، OS keyring یا user-provided secret مناسب‌تر از hardware ID به‌عنوان تنها منبع entropy است.
- Hardware ID می‌تواند برای binding/telemetry داخلی یا salt کمکی استفاده شود، اما شناسه سخت‌افزاری secret رمزنگاری‌شده یا entropy امن نیست.
- KDF مناسب (پارامترمحور و نسخه‌دار) برای password-based secret بررسی شود؛ hash ساده SHA-256 از password کافی نیست.

### 33.3 In-memory model loading — واقعیت‌های امنیتی

- مدل رمزگشایی‌شده مستقیماً به runtime در RAM داده شود، در صورت پشتیبانی API واقعی ONNX Runtime.
- از فایل خام موقت روی دیسک استفاده نشود؛ temporary bufferها پس از استفاده best-effort zeroize شوند.
- حافظه process ممکن است در pagefile/swap، hibernation، crash dump یا debugger قابل مشاهده باشد؛ ادعای «هرگز قابل استخراج نیست» ممنوع است.
- دسترسی به crash dump و logs مدیریت شود؛ برای پردازش حساس، تنظیمات OS و threat model مستند باشد.
- مدل/secret فقط در scope لازم نگهداری و پس از unload پاکسازی شود.

### 33.4 Local-only network posture

- Axum server به‌صورت پیش‌فرض روی loopback bind شود؛ bind به `0.0.0.0` فقط با انتخاب صریح و هشدار.
- CORS، origin checks، authentication token محلی و rate limits برای local endpoints بررسی شوند.
- MCP tools allowlist داشته باشند؛ shell/file access arbitrary به مدل ندهید.
- هیچ telemetry یا analytics بیرونی بدون opt-in وجود نداشته باشد.
- مدل‌های HuggingFace/remote downloads از مسیر کنترل‌شده، با checksum و resume مدیریت شوند؛ پس از دانلود، inference آفلاین باشد.

---

## 34. TissueAI Workflows — مسیرهای end-to-end

### WF-01 — Import و triage اسلاید WSI

1. افزودن SVS/NDPI/MRXS/OME-TIFF یا فرمت واقعاً پشتیبانی‌شده.
2. reader probe و metadata inspection.
3. نمایش pyramid, dimensions, calibration, stain, objective و warnings.
4. ساخت thumbnail/overview.
5. tissue detection و QC map اختیاری.
6. ثبت slide/case/specimen metadata.
7. حفظ source و ایجاد project reference.

### WF-02 — H&E stain separation و quantification

1. انتخاب H&E image/slide.
2. تعیین color profile و stain vectors.
3. نمایش H/E/Residual channels.
4. بررسی histogram و quality warning.
5. ایجاد derived channels.
6. انتخاب tissue ROI.
7. اندازه‌گیری stain intensity/area fraction در ROI.
8. ذخیره parameters و export table/heatmap.

### WF-03 — Nuclei detection و morphometry

1. انتخاب مدل YOLO/ONNX یا algorithm classical.
2. تعیین class labels و stain preprocessing.
3. tile-aware inference.
4. cross-tile deduplication.
5. review bounding boxes/instances.
6. optional segmentation refinement.
7. compute nuclei count، area، perimeter، diameter، circularity، eccentricity و spatial density.
8. خروجی per-object CSV/JSON و slide summary.

### WF-04 — Tumor/stroma/normal compartment segmentation

1. تعریف semantic classes.
2. annotation با polygon/brush.
3. انتخاب threshold/classifier/DL model.
4. tiled inference و probability map.
5. convert probabilities to label map با threshold ثبت‌شده.
6. curation و merge/split classes.
7. محاسبه area fraction، boundaries و spatial context.
8. report با model/validation provenance.

### WF-05 — Batch slide analysis

1. انتخاب slide list یا directory.
2. preflight validation و grouping.
3. انتخاب saved pipeline/model.
4. resource estimate و concurrency.
5. run per slide و progress واقعی.
6. review failures/skipped tiles.
7. combined results، QC summary و export.

### WF-06 — Time-lapse / fluorescence stack

1. import axes/channel/Z/T و metadata.
2. channel labeling و calibration.
3. channel registration در صورت نیاز.
4. background/denoise و segmentation.
5. detection و TrackMate-like tracking.
6. trajectory metrics (speed، displacement، lifetime، intensity).
7. colocalization با metric انتخابی.
8. graph/plot، overlay و export.

### WF-07 — 3D volume segmentation

1. load volume با Z spacing صحیح.
2. orthogonal view و volume preview.
3. انتخاب ROI/channel و preprocessing.
4. true 3D segmentation و connectivity مناسب.
5. label editing و object separation.
6. volume/surface/centroid/shape measurements.
7. 3D render و export label volume.

### WF-08 — Train a custom tissue model

1. جمع‌آوری اسلایدها و patient/case grouping.
2. annotation classes و class guide.
3. patch extraction و QC filtering.
4. leakage-safe train/validation/test split.
5. feature/classifier یا Burn network.
6. checkpoint/evaluation.
7. export format که واقعاً supported باشد.
8. deployment در model registry و offline inference.

### WF-09 — Research figure و reproducible report

- side-by-side source/derived، crop، overlays، scale bar و labels.
- رنگ‌ها و display transforms غیرتخریبی.
- خروجی figure با metadata/provenance.
- گزارش جداول، methods، parameters، models، calibration، limitations و warnings.
- تصاویر یا مقادیر دستکاری‌شده به‌گونه‌ای ارائه نشوند که ماهیت داده را پنهان کنند.

---

## 35. UI/UX و معماری تمرکز

TissueAI ابزار تخصصی متعدد دارد؛ اما صفحه اصلی نباید به منویی از صدها دکمه تبدیل شود.

### 35.1 مدل workspace پیشنهادی

- **Workspace / Slides:** پروژه، اسلایدها، پرونده‌ها و metadata.
- **Viewer:** canvas اصلی، navigator، zoom، channels، scale و slide information.
- **Tools Panel:** ابزار context-sensitive براساس mode فعلی.
- **Inspector:** properties، ROI/label/object properties و measurements.
- **Results:** tables، plots، logs، model output و QC.
- **Job Center:** task queue، progress، pause/cancel و errors.

این‌ها لزوماً پنجره‌های ثابت نیستند؛ از layout فعلی UI پیروی کنید.

### 35.2 Command palette و feature finder

- قابلیت جستجوی فرمان با نام، دسته، توضیح و hotkey.
- هر قابلیت وضعیت `Available`, `Needs model`, `Needs calibration`, `Unsupported format`, `Requires GPU` یا `Coming only after integration` داشته باشد.
- قابلیت unavailable را fake-enable نکنید؛ دلیل و راهکار ارائه شود.

### 35.3 Operation dialog استاندارد

هر عملیات باید شامل:

- input asset/ROI/channel/level/scope؛
- algorithm و description؛
- پارامترها با unit/default/range؛
- preview واقعی در صورت امکان؛
- source/derived output policy؛
- memory/time estimate در صورت قابل محاسبه بودن؛
- warnings و limitations؛
- Run/Cancel/Reset/Help؛
- progress و امکان cancel؛
- result summary و link به provenance.

### 35.4 جلوگیری از شلوغی

- ابزارهای پرکاربرد و context-sensitive در دسترس فوری باشند.
- specialist tools زیر دسته‌های Analyze/Advanced پنهان شوند.
- همه controls بر اساس selection/asset type نمایش داده شوند.
- برای WSI controls level/overview/tile status در viewer باشند، نه در ده‌ها dialog جدا.
- state کاربر و panel layout persistence داشته باشد، بدون اینکه داده علمی را تغییر دهد.

---

## 36. Testing, Validation & Acceptance Criteria

### 36.1 Data model and calibration

- uint8/uint16/int16/float32/RGB data fixtures.
- NaN/Inf/overflow/underflow/zero division.
- axis order و C/Z/T mapping.
- pixel-to-µm calibration، origin و anisotropic Z spacing.
- metadata round-trip و source checksum.

### 36.2 WSI correctness/performance

- حداقل یک fixture کوچک واقعی/قانوناً قابل استفاده برای هر format adapter ادعاشده.
- dimensions، pyramid levels/downsamples، tile coordinate، orientation و metadata.
- region read در گوشه، مرکز، لبه و مختصات بیرون از bounds.
- level-to-level mapping با ROIهای test.
- zoom/pan cold/warm cache، cancellation و cache eviction.
- WSI بزرگ‌تر از RAM در حالت tiled/virtual بدون full decode.
- tile seam tests برای convolution/segmentation/detection.
- RAM peak، cache hit rate، time-to-first-view و viewport latency.

### 36.3 Scientific algorithm golden tests

- histogram با مقادیر معلوم.
- Gaussian/median/convolution با reference array.
- morphology با shapeهای مصنوعی و connectivity تعریف‌شده.
- connected components با object count معلوم.
- watershed روی touching circles/ellipses.
- ROI area/length با analytic geometry.
- stain deconvolution با synthetic mixtures و reference tolerance.
- 3D metrics روی sphere/cube/ellipsoid و voxel anisotropy.

### 36.4 Segmentation and AI

- مدل‌های ONNX با tensor input/output schema معلوم.
- preprocessing و postprocessing parity.
- CPU/GPU provider selection verification.
- cross-tile duplicate/seam tests.
- segmentation metrics روی held-out reference annotations.
- dataset split leakage test براساس patient/case/slide.
- encryption round-trip و tampering detection.
- model load/unload memory cleanup.

### 36.5 Batch and UX

- job queue محدود و concurrency.
- progress monotonic/meaningful، cancellation و retry.
- failed slide reporting و no silent skip.
- UI responsive under large WSI and inference jobs.
- all active buttons end-to-end.
- keyboard, high-DPI, empty/error states.
- project close/reopen و crash recovery.

### 36.6 Tauri/IPC/security

- payload size؛ هیچ pixel array عظیم از JSON عبور نکند.
- event subscription cleanup و job isolation.
- arbitrary path access denied unless user-selected/scoped.
- local Axum server loopback binding by default.
- secrets not printed in logs or frontend state.
- corrupted `.enc` rejected with safe error.
- model tampering detected before use.

### 36.7 Release acceptance

- cargo test + frontend tests + integration tests.
- lint/typecheck.
- `cargo tauri build` یا build command واقعی repo.
- verify Windows/macOS/Linux target(s) که project ادعا می‌کند.
- check binary/package size، native library bundling و missing runtime.
- manual QA with at least one raster, one microscopy stack and one large WSI.

---

## 37. Implementation Roadmap ویژه TissueAI

ترتیب زیر پیشنهاد است و بعد از audit بازتنظیم می‌شود. هیچ مرحله‌ای به معنی حذف قابلیت موجود نیست.

### Phase 0 — Repository audit & architecture confirmation

Deliverables: repository map، dependency/version report، UI/backend command inventory، feature audit، baseline tests/build، list of regressions، prioritized backlog.

**Do not begin mass implementation before this phase is approved internally by the agent's own audit report.**

### Phase 1 — Data integrity and project foundation (P0)

- canonical asset/pixel data model یا تطبیق مدل فعلی؛
- source/derived separation؛
- metadata/calibration/coordinate system؛
- project manifest and provenance؛
- typed commands and standard error types؛
- job manager/cancellation/event infrastructure.

### Phase 2 — WSI I/O and tile viewer (P0/P1)

- reader adapter and format capability registry؛
- tiled WSI read؛
- pyramid-level mapping؛
- bounded cache؛
- binary/resource transport؛
- viewport zoom/pan/overview؛
- WSI benchmark fixtures.

### Phase 3 — Editor, ROI, annotation and measurements (P0)

- ROI geometry and level-0 coordinate system؛
- annotation manager/class taxonomy؛
- calibration UI؛
- histogram/profile/measure/particle analysis؛
- results tables/export؛
- non-destructive undo/history.

### Phase 4 — ImageJ processing and histology color workflows (P1)

- filter, transform, arithmetic، binary morphology؛
- threshold/watershed/connected components؛
- H&E/DAB stain separation؛
- tissue mask/ROI؛
- heatmap and reproducible provenance.

### Phase 5 — Detection and segmentation at WSI scale (P1/P2)

- ONNX model registry/session reuse؛
- tiled YOLO detection/NMS merge؛
- semantic/instance segmentation؛
- label editor and curation؛
- per-slide summary.

### Phase 6 — Multi-slide pipelines and Trainable (P1/P2)

- bounded batch queue؛
- patch extraction and dataset management؛
- Burn/classical ML adapters؛
- leakage-safe split؛
- model evaluation and export interoperability.

### Phase 7 — 3D, registration and advanced scientific analysis (P2)

- volume viewer separate from anatomy GLTF viewer؛
- 3D morphology/measurement؛
- registration/drift/stitching؛
- tracking/colocalization/directionality/skeleton.

### Phase 8 — Specialist extensions (P3)

- deconvolution microscopy؛
- SNT/neuron/filament tracing؛
- BoneJ-like morphometry؛
- advanced 3D topology؛
- optional GPU adapters and extra file readers.

---

## 38. Mandatory deliverables after every phase

1. Completed IDs and audit status with source-code evidence.
2. Incomplete/blocked/not-applicable IDs and exact reason.
3. Files created/modified and why.
4. Cargo/npm dependency changes, versions and license review.
5. Tests added, fixtures and exact pass/fail results.
6. Benchmark methodology and hardware profile.
7. UI screenshots or reproducible walkthrough.
8. Memory/performance notes for representative WSI.
9. Confirmation that source pixels, metadata, units and calibration remain intact.
10. Known limitations and unresolved issues.
11. Build/package test for each supported operating system.
12. Updated `docs/imagej_fiji_capability_audit.md` and roadmap.

---

# PART E — منابع اصلی و مراجع بررسی قابلیت‌ها

منابع زیر منابع پایه برای شناخت قابلیت‌ها هستند. پیش از ادغام هر dependency، نسخه فعلی، مستندات دقیق API و license همان release بررسی شود.

## 39. مخازن رسمی GitHub

- [ImageJ organization](https://github.com/imagej)
- [ImageJ 1.x](https://github.com/imagej/ImageJ)
- [ImageJ2](https://github.com/imagej/imagej2)
- [Fiji](https://github.com/fiji/fiji)
- [DeconvolutionLab2](https://github.com/Biomedical-Imaging-Group/DeconvolutionLab2)

## 40. ImageJ / ImageJ2 / Fiji

- [ImageJ Wiki](https://imagej.github.io/)
- [ImageJ learning](https://imagej.net/learn/)
- [ImageJ development](https://imagej.net/develop/)
- [ImageJ file menu](https://imagej.net/ij/docs/menus/file.html)
- [ImageJ edit menu](https://imagej.net/ij/docs/menus/edit.html)
- [ImageJ image menu](https://imagej.net/ij/docs/menus/image.html)
- [ImageJ process menu](https://imagej.net/ij/docs/menus/process.html)
- [ImageJ analyze menu](https://imagej.net/ij/docs/menus/analyze.html)
- [ImageJ User Guide](https://imagej.net/ij/docs/guide/user-guide.pdf)
- [Fiji update sites](https://imagej.net/update-sites/)
- [Extensions list](https://imagej.net/plugins/)
- [ImageJ scripting](https://imagej.net/scripting/)

## 41. Fiji plugins and scientific tools

- [BigDataViewer](https://imagej.net/plugins/bdv/)
- [TrackMate](https://imagej.net/plugins/trackmate/)
- [Trainable Weka Segmentation](https://imagej.net/plugins/tws/)
- [Labkit](https://imagej.net/plugins/labkit/)
- [StarDist](https://imagej.net/plugins/stardist)
- [MorphoLibJ](https://imagej.net/plugins/morpholibj)
- [3D Viewer](https://imagej.net/plugins/3d-viewer/)
- [3D ImageJ Suite](https://imagej.net/plugins/3d-imagej-suite/)
- [Coloc 2](https://imagej.net/plugins/coloc-2)
- [SNT](https://imagej.net/plugins/snt/)
- [AnalyzeSkeleton](https://imagej.net/plugins/analyze-skeleton/)
- [Directionality](https://imagej.net/plugins/directionality)
- [Stitching 2D/3D](https://imagej.net/plugins/stitching-2d-3d)
- [Correct 3D Drift](https://imagej.net/plugins/correct-3d-drift)
- [DeconvolutionLab2](https://bigwww.epfl.ch/deconvolution/deconvolutionlab2/)
- [BoneJ](https://imagej.net/plugins/bonej)
- [CLIJ](https://imagej.net/plugins/clij)
- [Temporal Color Code](https://imagej.net/plugins/temporal-color-code)

## 42. Microscopy formats and metadata

- [Bio-Formats](https://imagej.net/formats/bio-formats)
- [Life-science formats](https://imagej.net/formats/)
- [ImageJ metadata](https://imagej.net/formats/metadata)
- [TIFF](https://imagej.net/formats/tiff)
- [DICOM](https://imagej.net/formats/dicom)

## 43. Architecture references to verify before implementation

- [Tauri v2 documentation](https://v2.tauri.app/)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Burn framework](https://burn.dev/)
- [Rust image crate](https://docs.rs/image/latest/image/)
- [ndarray](https://docs.rs/ndarray/latest/ndarray/)
- [Tokio](https://tokio.rs/)
- [Axum](https://docs.rs/axum/latest/axum/)
- [OpenSlide](https://openslide.org/)
- [libvips](https://www.libvips.org/)

---

## 44. دستور نهایی برای Agent (Antigravity)

تو در حال ارتقای **کدبیس فعلی TissueAI** هستی. این فایل را به‌عنوان capability inventory و engineering contract در نظر بگیر؛ نه مجوز بازنویسی از صفر و نه فهرست دکمه‌هایی که باید کورکورانه اضافه شوند.

ترتیب کار الزامی است:

1. repository واقعی را بررسی کن و معماری اعلام‌شده در این سند را با manifests و source code تطبیق بده.
2. تمام قابلیت‌های فعلی را end-to-end آزمایش و با IDهای این سند audit کن.
3. گزارش `docs/imagej_fiji_capability_audit.md` و فهرست gapها را بساز.
4. وابستگی‌های لازم را از نظر سازگاری Rust/Tauri، offline deployment، license، native library و package size ارزیابی کن.
5. backlog مرحله‌ای بر اساس P0 تا P3 بساز و هر فاز را مستقل اجرا کن.
6. برای هر قابلیت missing، ابتدا data contract و Rust engine را پیاده کن، سپس Tauri command/event و در پایان UI React را متصل کن.
7. هر قابلیت را با fixture علمی، integration test و benchmark مناسب اعتبارسنجی کن.
8. source image را immutable نگه دار؛ display state، mask، label، detection و derived image را تفکیک کن.
9. WSI را tile/pyramid-aware پیاده کن. هیچ‌وقت برای راحتی، کل slide را به یک آرایه بزرگ در RAM یا JSON IPC تبدیل نکن.
10. تمام jobهای سنگین باید progress واقعی، cancellation، خطای قابل فهم، memory control و cleanup داشته باشند.
11. Python یا Java را به runtime اجباری محصول تبدیل نکن. هر adapter خارجی باید optional، offline، ایزوله و مستند باشد.
12. قابلیت‌هایی که وجود دارند را duplicate نکن؛ قابلیت ناقص را کامل کن؛ قابلیت نامرتبط را با دلیل `NOT_APPLICABLE` علامت بزن.
13. در انتهای هر فاز، تست/build/benchmark و گزارش دقیق فایل‌های تغییرکرده را ارائه کن.

**هدف نهایی:** TissueAI باید با حفظ معماری Native Rust + Tauri v2 + React/TypeScript، تبدیل به محیطی سریع، امن، offline-first، tile-aware و قابل بازتولید برای Digital Pathology، Computational Histology، Whole Slide Imaging و تحلیل علمی AI شود؛ از نظر قابلیت‌های مفید از ImageJ/Fiji الهام بگیرد، اما از نظر طراحی و معماری به محصول مستقل TissueAI تبدیل شود.
