# TissueAI — Competitive Feature Gap Audit & Advanced Product Capability Specification

**نوع سند:** ممیزی مقایسه‌ای قابلیت‌ها + مشخصات اجرایی تکمیلی برای توسعه  
**تاریخ ممیزی:** 2026-11-12  
**مخزن بررسی‌شده:** https://github.com/amirrezamortazavifard/TissueAI  
**شاخه بررسی‌شده:** `main`  
**مخاطب اصلی:** Antigravity / AI Coding Agent / تیم توسعه TissueAI  
**هدف:** شناسایی قابلیت‌های مهمی که نرم‌افزارهای مرجع دارند و TissueAI آن‌ها را ندارد، فقط بخشی از آن‌ها را دارد، یا پیاده‌سازی موجود هنوز از نظر دقت علمی، مقیاس‌پذیری، گردش‌کار یا تجربه کاربری به سطح حرفه‌ای نرسیده است.

---

## دستورالعمل حیاتی برای Agent

این سند یک **ممیزی تکمیلی رقابتی** است و نباید بدون بررسی با نقشه‌راه‌های قبلی ادغام کورکورانه شود. پیش از اجرای هر Task:

1. کد فعلی همان Task را در شاخه جاری دوباره بررسی کن.
2. وضعیت واقعی آن را با یکی از برچسب‌های `NOT_IMPLEMENTED`، `PARTIAL`، `IMPLEMENTED_NEEDS_VALIDATION` یا `IMPLEMENTED` ثبت کن.
3. اگر قابلیتی پس از این ممیزی تکمیل شده، آن را دوباره پیاده‌سازی نکن؛ فقط تست، یکپارچگی و معیار پذیرش آن را بررسی کن.
4. اگر یک قابلیت در کد وجود دارد اما UI به آن متصل نیست، آن را «قابلیت کامل» محسوب نکن.
5. اگر UI وجود دارد اما Backend واقعی ندارد، Mock یا داده ساختگی دارد، آن را «قابلیت کامل» محسوب نکن.
6. اگر کد موجود فقط برای تصویر کوچک، RGB یا U8 کار می‌کند، پشتیبانی عمومی از تصاویر علمی را ادعا نکن.
7. هر نتیجه علمی باید با داده مرجع، واحد، کالیبراسیون، روش محاسبه و خطای احتمالی قابل بازبینی باشد.
8. هیچ‌گاه Calibration، Metadata، نتیجه مدل، Confidence، زمان اجرا یا موفقیت عملیات را جعل نکن.
9. برای هر قابلیت، تست خودکار، تست یکپارچه‌سازی و در صورت لزوم تست بصری/اجرایی بساز.
10. مستندات قدیمی را به‌عنوان اثبات پیاده‌سازی تلقی نکن. منبع حقیقت، کد اجراشونده و رفتار واقعی برنامه است.

**این سند به معنی تأیید عملکرد بالینی TissueAI نیست.** دامنه محصول در این مرحله ابزار پژوهشی برای تحلیل تصاویر میکروسکوپی، Histology و Digital Pathology است. هیچ خروجی الگوریتمی نباید بدون اعتبارسنجی بالینی و مجوزهای لازم به‌عنوان تشخیص پزشکی قطعی معرفی شود.

---

# بخش اول — خلاصه مدیریتی و روش ممیزی

## 1.1. هدف محصول و تعریف رقابت

TissueAI باید به‌عنوان یک **AI-powered Computational Histology & Digital Pathology Workstation** توسعه یابد؛ یعنی محیطی یکپارچه برای:

- واردکردن، سازمان‌دهی و مشاهده تصاویر میکروسکوپی و Whole Slide Images؛
- پردازش علمی تصویر با حفظ داده اصلی و دقت عددی؛
- Annotation، اندازه‌گیری و تحلیل ساختاری بافت؛
- Detection، Segmentation و Classification با روش‌های کلاسیک و AI؛
- تحلیل چنداسلایدی و Cohort-level؛
- Automation، Pipeline و گزارش پژوهشی بازتولیدپذیر؛
- اتصال به استانداردها و سامانه‌های تبادل داده میکروسکوپی.

رقابت TissueAI با یک نرم‌افزار منفرد تعریف نمی‌شود. نرم‌افزارهای مرجع هرکدام نقطه قوت مشخصی دارند:

| نرم‌افزار مرجع | حوزه‌ای که باید از آن الگو گرفت | دلیل اهمیت برای TissueAI |
|---|---|---|
| Fiji / ImageJ | ابزارهای تحلیل کمی، ROI، Analyze Particles، Histogram، Profile، Macro و Plugin | گستردگی ابزارهای تحلیل علمی و اتوماسیون |
| QuPath | Digital Pathology، Project، Tissue Detection، Cell Detection، Cell Classification، Pixel Classification، TMA، Measurement Maps، Scripting و Deep Learning | نزدیک‌ترین مرجع محصولی برای تحلیل بافت و اسلاید پاتولوژی |
| napari | Viewer چندبعدی، Layerهای مستقل، نمایش داده‌های N-D، لایه‌های Labels/Shapes/Points/Vectors و Plugin | مرجع معماری Viewer و تعامل چندلایه |
| OMERO | سازمان‌دهی داده، Project/Dataset/Image، Metadata، Annotation، گروه‌ها و مجوزها، Script | مرجع مدیریت داده علمی و همکاری |
| Orbit Image Analysis | تحلیل WSI، Tissue Quantification، Object Segmentation/Classification، Exclusion Model، اتصال OMERO و Scale-out | الگوی تحلیل بافت و پردازش مقیاس‌پذیر |
| ASAP | نمایش WSI، خواندن چندفرمتی، Annotation، Overlay، ابزارهای تصویر و Plugin | مرجع Viewer تخصصی و تبادل Annotation |

## 1.2. روش ممیزی

این گزارش با روش زیر تهیه شده است:

1. بررسی ساختار عمومی مخزن `main` و مستندات قابل مشاهده؛
2. بررسی ثبت ماژول‌ها و Tauri Commands در Backend؛
3. خواندن مسیرهای کلیدی Rust مربوط به WSI، Scientific Image، Processing، ROI، Histology، AI، Project، Jobs و Workflow؛
4. بررسی اینکه کدام قابلیت‌ها واقعاً دارای مسیر اجرایی‌اند و کدام فقط Data Model، Helper یا Command سطحی دارند؛
5. مقایسه با مستندات و قابلیت‌های منتشرشده نرم‌افزارهای مرجع؛
6. تبدیل شکاف‌ها به Taskهای فنی، معیارهای پذیرش و تست‌های قابل اجرا.

### محدودیت بررسی

این ممیزی **Static Code Audit** بر اساس نسخه عمومی GitHub در تاریخ درج‌شده است. برنامه در این نوبت از روی سیستم توسعه اجرا نشده و تست Build، Benchmark سخت‌افزاری، تست روی WSIهای اختصاصی اسکنرها یا آزمون صحت خروجی علمی انجام نشده است. بنابراین:

- «وجود کد» مساوی «عملکرد صحیح» نیست؛
- «ثبت Command» مساوی «اتصال کامل UI و Backend» نیست؛
- «نام فرمت در کد» مساوی «پشتیبانی واقعی Decoder» نیست؛
- هر مورد `IMPLEMENTED_NEEDS_VALIDATION` باید با داده واقعی آزموده شود.

## 1.3. راهنمای وضعیت قابلیت‌ها

| وضعیت | معنی |
|---|---|
| `IMPLEMENTED` | شواهدی از مسیر کامل و قابل استفاده وجود دارد؛ تست‌های لازم نیز باید پاس شوند. |
| `PARTIAL` | بخشی از قابلیت یا زیرساخت آن وجود دارد، اما چرخه کامل محصولی/علمی کامل نیست. |
| `NOT_IMPLEMENTED` | در مسیرهای بررسی‌شده پیاده‌سازی قابل اتکایی مشاهده نشده است. |
| `IMPLEMENTED_NEEDS_VALIDATION` | کد وجود دارد، اما دقت، پایداری، Performance یا اتصال UI باید اثبات شود. |
| `OUT_OF_SCOPE_OPTIONAL` | قابلیت مفید است اما برای هسته اولیه ضروری نیست و باید پس از تثبیت هسته بررسی شود. |

---

# بخش دوم — وضعیت واقعی TissueAI در نسخه بررسی‌شده

## 2.1. قابلیت‌هایی که اکنون وجود دارند و نباید دوباره از صفر ساخته شوند

در مخزن فعلی ماژول‌ها و Commandهایی برای حوزه‌های زیر دیده می‌شود:

- Scientific Image Model و مدیریت Asset؛
- WSI Reader، Metadata، Tile، Thumbnail، Region، Cache و Scheduler؛
- ROI Manager با انواع هندسی، طبقه‌بندی، گروه‌بندی، ذخیره/بارگذاری و Undo/Redo؛
- Project با Dataset، Image Reference و Pipeline Run؛
- Histology شامل Tissue Detection، Stain Deconvolution و Morphometry؛
- Image Processing شامل Filter، Adjustments، Threshold، Distance Transform و Watershed؛
- AI Segmentation شامل Decoder مربوط به StarDist، Tile Planning و تبدیل Polygon به ROI؛
- Object Detection با ONNX/YOLO؛
- Batch Detection روی چند تصویر؛
- Training و Feature Extraction اولیه برای برخی مدل‌های Segmentation؛
- Registration مبتنی بر Landmark و Affine؛
- Spatial Analysis شامل برخی محاسبات Colocalization و Directionality؛
- Skeletonization و Graph Analysis؛
- Job Manager؛
- Workflow Step Recording و Research Report؛
- Exportهایی از جمله CSV، GeoJSON و OME XML برای ROIها؛
- ماژول‌های LLM و اتصال‌های کمکی.

منابع کد برای بررسی وضعیت فعلی:

- [Backend module registration — `lib.rs`](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/lib.rs)
- [WSI Reader](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/wsi/reader.rs#L300-L380)
- [Scientific Image Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/scientific_image.rs#L22-L60)
- [Image Processing Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/image_processing.rs#L15-L66)
- [ROI Manager](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/manager.rs#L38-L110)
- [ROI Measurement](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/measurement.rs#L3-L97)
- [Histology Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/histology.rs#L6-L55)
- [AI Segmentation Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/ai_segmentation.rs#L1-L91)
- [Project Model](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/project/mod.rs#L8-L137)
- [Jobs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/jobs/mod.rs#L97-L128)
- [Workflow Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/workflow.rs#L18-L49)
- [Detection Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/detection.rs#L1-L210)
- [Multi-slide Detection](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/multi_slide.rs)

## 2.2. شکاف‌های قطعی یا با شواهد قوی

### GAP-001 — WSI Reader هنوز Native Pyramid Reader واقعی نیست

**وضعیت:** `PARTIAL` — اولویت `P0`

در `PyramidalSlideReader`، فیلد `base_image: DynamicImage` وجود دارد. مسیر بازکردن، فایل را با Decoder عمومی به تصویر کامل تبدیل می‌کند و Pyramid سطح‌های پایین‌تر را از تصویر پایه می‌سازد. سپس Tileها از تصویر پایه Crop و Resize می‌شوند. این با خواندن Tile از Levelهای واقعی Pyramid در خود فایل WSI متفاوت است.

**اثر عملی:**

- بارگذاری Whole Slide بسیار بزرگ ممکن است حافظه زیادی مصرف کند؛
- زمان بازشدن تابع Decode کل فایل می‌شود؛
- مزیت ساختار Pyramid واقعی اسکنر استفاده نمی‌شود؛
- عملکرد روی فایل‌های چندگیگابایتی تضمین‌شده نیست؛
- پشتیبانی از Vendor Format با تشخیص پسوند اشتباه گرفته می‌شود.

**اقدام لازم:** Task `WSI-NATIVE-001` در بخش هفتم.

منبع: [reader.rs — WSI Reader implementation](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/wsi/reader.rs#L300-L380)

### GAP-002 — مسیر عمومی Scientific Image هنوز همه قابلیت‌های Data Model را مصرف نمی‌کند

**وضعیت:** `PARTIAL` — اولویت `P0`

مدل Scientific Image انواع پیکسل و Axisهای بیشتری را تعریف می‌کند، اما مسیر `sci_image_open` از `image::open` و `DynamicImage` استفاده می‌کند. در این مسیر، همه Pixel Typeها و داده‌های چندبعدی به شکل واقعی ingest نمی‌شوند و در نبود Calibration مقدار پیش‌فرض ساخته می‌شود.

**اثر عملی:**

- تعریف U16/F32 در Model به معنی پشتیبانی واقعی Import و Processing نیست؛
- داده‌های چندکاناله، Z-stack و Time Series ممکن است به یک تصویر ساده تقلیل یابند؛
- Calibration ناشناخته باید Unknown باقی بماند، نه اینکه به مقدار ظاهراً معتبر تبدیل شود.

منبع: [scientific_image.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/scientific_image.rs#L22-L60)

### GAP-003 — Image Processing با Pixel Typeهای تعریف‌شده یکپارچه نیست

**وضعیت:** `PARTIAL` — اولویت `P0/P1`

در مسیر `proc_apply_filter` محدودیت‌هایی برای بافرها وجود دارد و مسیرهای اصلی برخی فیلترها به U8/RGB/RGBA محدودند. این یعنی تعریف Pixel Typeهای علمی در Data Model هنوز به پشتیبانی کامل در همه الگوریتم‌ها تبدیل نشده است.

**اقدام لازم:** Pipeline عمومی Typed Processing، آزمون حفظ Bit Depth و تعریف سیاست صریح برای تبدیل نوع داده.

منبع: [image_processing.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/image_processing.rs#L15-L66)

### GAP-004 — Tissue Detection فعلی برای تحلیل بافت حرفه‌ای کافی نیست

**وضعیت:** `PARTIAL` — اولویت `P1`

مسیر `histo_detect_tissue` داده RGB/RGBA را استخراج می‌کند و با Threshold روشنایی، Mask ساده می‌سازد. این یک Tissue Mask اولیه است، نه Tissue Detection مقاوم در برابر تنوع رنگ‌آمیزی، اسکنر، روشنایی، Background و Artifact.

**اقدام لازم:** Tissue Detection قابل تنظیم، Color/Texture Features، مدل قابل آموزش، Exclusion Regions، QC و Tile-based inference.

منبع: [histology.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/histology.rs#L6-L55)

### GAP-005 — ROI Measurement هنوز Intensity Measurement واقعی را کامل نمی‌کند

**وضعیت:** `PARTIAL` — اولویت `P1`

`RoiMeasurements` فیلدهای Mean/Min/Max/StdDev Intensity را تعریف می‌کند، اما امضای فعلی `MeasurementEngine::measure` فقط Shape و Calibration دریافت می‌کند. برای محاسبه آمار شدت باید Image Buffer یا یک Region/Mask Reader نیز به Measurement Engine داده شود. وجود فیلد Option به‌تنهایی به معنی محاسبه شدن آن نیست.

**اقدام لازم:** پشتیبانی واقعی از Pixel Statistics داخل ROI، Histogram، Channel-specific Measurement و Line Profile.

منبع: [measurement.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/measurement.rs#L3-L97)

### GAP-006 — AI Segmentation Commandها بیشتر اجزای Post-processing هستند تا یک AI Lifecycle کامل

**وضعیت:** `PARTIAL` — اولویت `P1`

وجود StarDist Decoder، Tile Planner و تبدیل Polygonها به ROI مفید است؛ اما این موارد به‌تنهایی Model Registry، مدل بارگذاری‌شده، Preprocessing، Inference واقعی، مدیریت GPU، اجرای WSI، Post-processing، ارزیابی و ذخیره Provenance را تشکیل نمی‌دهند.

در کنار آن، YOLO Detection مسیر Inference دارد؛ اما باید بررسی شود که Model Session در هر درخواست دوباره ساخته می‌شود یا Lifecycle مدیریت‌شده دارد، مدل روی WSI به‌صورت Tiled اجرا می‌شود یا فقط روی فایل تصویر معمولی، و نتایج بین فراخوانی‌ها پایدار هستند یا خیر.

منابع: [ai_segmentation.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/ai_segmentation.rs#L1-L91)، [detection.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/detection.rs#L1-L210)

### GAP-007 — Pixel Training اولیه وجود دارد؛ ولی Interactive Pixel Classification کامل نیست

**وضعیت:** `PARTIAL` — اولویت `P1`

در کد Training/Feature Extraction برای Segmentation اولیه وجود دارد؛ بنابراین نباید ساخت Pixel Classifier را از صفر فرض کرد. بااین‌حال، باید موارد زیر بررسی و تکمیل شوند:

- آموزش با Brush/Traceهای نمونه‌گذاری‌شده؛
- Preview زنده روی Viewport؛
- Probability Map چندکلاسه؛
- ذخیره و بارگذاری Classifier؛
- استخراج ویژگی در Tile و نه ساخت یک ماتریس عظیم در RAM؛
- ارزیابی روی ناحیه‌ای مستقل از داده آموزش؛
- Class Imbalance و Class Weight؛
- اعمال Classifier روی کل WSI و Export Mask.

الگوی مقایسه: QuPath Pixel Classification امکان تعریف مثال‌های آموزشی، Preview و استفاده مجدد از Classifier را ارائه می‌کند.

منبع مرجع: [QuPath Pixel Classification Tutorial](https://qupath.readthedocs.io/en/stable/docs/tutorials/pixel_classification.html)

### GAP-008 — Workflow فعلی با Workflow Graph قابل اجرا تفاوت دارد

**وضعیت:** `PARTIAL` — اولویت `P1`

Commandهای فعلی Step را ثبت و Pipeline را بازیابی/گزارش می‌کنند؛ اما در مسیرهای بررسی‌شده شواهدی از DAG Editor، Dependency Resolver، Execution Engine، Retry/Resume، Branching یا Node-level Artifact وجود ندارد.

منبع: [workflow.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/workflow.rs#L18-L49)

### GAP-009 — Job Cancellation نیازمند اثبات توقف واقعی عملیات است

**وضعیت:** `IMPLEMENTED_NEEDS_VALIDATION` — اولویت `P1`

Job Manager دارای Cancellation Token است؛ بااین‌حال مسیر Cancel وضعیت Job را بلافاصله به Cancelled تغییر می‌دهد. باید تضمین شود Executor واقعاً به نقطه امن توقف رسیده است و Worker پس از Cancel، Job را دوباره Completed نمی‌کند.

منبع: [jobs/mod.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/jobs/mod.rs#L97-L128)

### GAP-010 — Detection Result API باید از Mock/Empty Path پاک‌سازی شود

**وضعیت:** `PARTIAL` — اولویت `P1`

در مسیر فعلی `get_detection_results` یک Vector خالی بازمی‌گرداند. باید مشخص شود UI از Store دیگری استفاده می‌کند یا این Command هنوز Placeholder است. منبع داده نتایج باید واحد، پایدار و قابل بازیابی باشد.

منبع: [detection.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/detection.rs#L1-L210)

### GAP-011 — Project Model برای Data Lifecycle کامل باید گسترش یابد

**وضعیت:** `PARTIAL` — اولویت `P1`

مدل فعلی Project شامل Dataset، Image Reference و Pipeline Run است و نوشتن فایل Project انجام می‌شود. اما باید بررسی و تکمیل شود که آیا Maskها، Model Artifacts، Object Tableها، Measurement Tables، Annotation Versionها، ROI Collection، QC Results، Export Manifest و وابستگی‌های بیرونی به‌صورت منسجم ذخیره و بازیابی می‌شوند یا خیر.

منبع: [project/mod.rs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/project/mod.rs#L8-L137)

---

# بخش سوم — مقایسه قابلیت‌ها با نرم‌افزارهای مرجع

## 3.1. QuPath: مرجع اصلی Digital Pathology

### قابلیت‌هایی که QuPath باید الگوی TissueAI باشد

1. پروژه و سازمان‌دهی تصاویر؛
2. بازکردن فرمت‌های متعدد WSI و گسترش با Extension؛
3. Stain Separation؛
4. Tissue Detection؛
5. Cell Detection؛
6. Cell Classification؛
7. Pixel Classification با نمونه‌گذاری و Preview؛
8. Object Hierarchy شامل Annotation، Detection و TMA Core؛
9. Measurement Maps و نمایش Heatmapهای کمی؛
10. TMA Grid و مدیریت Coreهای موجود/مفقود؛
11. H-score و تحلیل Markerهای IHC؛
12. Multiplexed Image Analysis؛
13. Deep Learning از طریق مدل‌ها و Extensionهای سازگار؛
14. Script Editor، History و اجرای Batch؛
15. Export اندازه‌گیری‌ها و اشیاء؛
16. اتصال به ImageJ و OMERO از طریق اکوسیستم و Integration.

### فاصله TissueAI

TissueAI در حال حاضر هسته‌هایی برای ROI، Morphometry، Tissue، Detection، Segmentation، Registration و Spatial Analysis دارد. شکاف اصلی، یکپارچه‌سازی آن‌ها در یک چرخه استاندارد پاتولوژی است:

`Project → Slide → Tissue Detection → Annotation → Cell Detection → Classification → Measurements → Review → Cohort Analysis → Report`

باید این چرخه از ابتدا تا انتها در یک Project واقعی و با داده پایدار اجرا شود.

منابع: [QuPath Documentation](https://qupath.readthedocs.io/en/stable/)، [Cell Classification Tutorial](https://qupath.readthedocs.io/en/stable/docs/tutorials/cell_classification.html)، [Pixel Classification Tutorial](https://qupath.readthedocs.io/en/stable/docs/tutorials/pixel_classification.html)، [QuPath Commands Reference](https://qupath.readthedocs.io/en/stable/docs/reference/commands.html)

## 3.2. Fiji / ImageJ: مرجع تحلیل کمی و علمی

### قابلیت‌های مهمی که باید به TissueAI اضافه/تکمیل شوند

- Analyze Particles با فیلتر Size و Circularity؛
- خروجی ردیف‌به‌ردیف برای هر Particle؛
- Summary شامل Count، Total Area، Average Size، Area Fraction و Mean؛
- گزینه Exclude on Edges؛
- گزینه Include Holes؛
- نمایش ROIهای شناسایی‌شده و افزودن به ROI Manager؛
- Set Measurements برای انتخاب شاخص‌ها؛
- Histogram و Plot Profile؛
- Line Profile با امکان ذخیره نمودار و CSV؛
- Multi-measure روی چند ROI؛
- Image Calculator برای عملیات بین تصاویر؛
- Macro/Scripting و اجرای Batch؛
- ثبت پارامترها و نتایج هر تحلیل.

### فاصله TissueAI

TissueAI برخی Filterها، Threshold، Watershed و Measurement هندسی دارد، اما در مسیرهای بررسی‌شده یک تجربه کامل و یکپارچه مشابه Analyze Particles برای تحلیل اجسام، Table نتایج، Summary و فیلتر ویژگی‌ها مشاهده نمی‌شود. همچنین آمار Intensity داخل ROI باید به‌صورت واقعی به Image Buffer متصل شود.

منبع مرجع: [ImageJ Analyze Menu](https://imagej.net/ij/docs/menus/analyze.html)

## 3.3. napari: مرجع Multi-dimensional Layer Viewer

napari فقط یک Image Viewer نیست؛ معماری آن بر Layerهای مستقل و هماهنگ در یک فضای چندبعدی بنا شده است. خانواده Layerها شامل Image، Labels، Points، Shapes، Vectors، Surface و Tracks است.

### قابلیت‌هایی که باید الگو گرفته شوند

- چند Image Layer هم‌زمان؛
- Labels Layer با Colormap و Opacity؛
- Points/Shapes/Tracks/Vectors مستقل؛
- تنظیم Visibility، Opacity، Blending و Order هر Layer؛
- نمایش C/Z/T و برش‌های زمانی/مکانی؛
- Coordinate Transform و Scale per Axis؛
- 2D/3D View؛
- امکان هم‌تراز کردن چند Layer؛
- نمایش/پنهان‌سازی سریع نتیجه AI بدون تغییر Image Source؛
- Plugin System با دسترسی استاندارد به Viewer State.

### فاصله TissueAI

داشتن Annotation Overlay یا نمایش Result به‌تنهایی معادل Layer System نیست. TissueAI باید یک مدل Layer واقعی و قابل ذخیره داشته باشد که Image، Mask، Probability، ROI، Point، Heatmap و Result را جداگانه مدیریت کند.

منابع: [napari Layers Guide](https://napari.org/stable/getting_started/layers.html)، [napari Layer API](https://napari.org/stable/api/napari.layers.html)، [napari GitHub](https://github.com/napari/napari)

## 3.4. OMERO: مرجع مدیریت داده و همکاری

قابلیت‌های کلیدی OMERO:

- Project/Dataset/Image سلسله‌مراتبی؛
- Metadata و Annotation؛
- کاربران و گروه‌ها؛
- Permissionهای کنترل‌شده؛
- اشتراک‌گذاری در سطح Dataset و Project؛
- Script و Extension؛
- دسترسی Server-side به تصاویر؛
- ثبت و سازمان‌دهی داده‌های چندآزمایشگاهی.

### فاصله TissueAI

TissueAI فعلاً ماهیت Desktop/Local دارد؛ این نقطه ضعف قطعی نیست، اما برای آزمایشگاه‌های چندکاربره به Connector یا Integration با OMERO نیاز خواهد داشت. ساختن یک سرور کامل شبیه OMERO در نسخه فعلی پیشنهاد نمی‌شود؛ ابتدا یک Connector امن و Read/Write محدود طراحی شود.

منبع: [OMERO Groups and Permissions](https://omero.readthedocs.io/en/stable/sysadmins/server-permissions.html)

## 3.5. Orbit Image Analysis: مرجع تحلیل بافت و Scale-out

قابلیت‌های مهم Orbit:

- Tissue Quantification؛
- Object Segmentation؛
- Object Classification؛
- Exclusion Models؛
- Mask و ROI؛
- Deep Learning Object Segmentation؛
- اتصال OMERO؛
- Script/API و زیرساخت پردازش گسترده.

### فاصله TissueAI

TissueAI باید در کنار Detection/Segmentation، سیستم مدل‌های قابل آموزش برای Tissue، Object و Cell Classification، امکان تعریف Exclusion Region و Batch Quantification را توسعه دهد.

منابع: [Orbit Image Analysis](https://www.orbit.bio/)، [Orbit Handbook](https://www.orbit.bio/documentation/)، [Orbit Features — Tissue Quantification, Object Segmentation, Exclusion Models and Scale-out](https://www.orbit.bio/)

## 3.6. ASAP: مرجع نمایش و Annotation اسلاید بزرگ

قابلیت‌های قابل الگوبرداری:

- خواندن Vendor Formatهای متعدد؛
- نمایش Multi-resolution؛
- Minimap و Field-of-View Tracking؛
- Annotationهای Point، Rectangle، Polygon، Spline و Measurement؛
- Overlayهای Integer و Float با LUT و Window/Level؛
- Pluginها و ابزارهای تحلیل تصویر؛
- تبادل Annotation در قالب XML.

### فاصله TissueAI

در کنار Native WSI Reader باید Viewer دارای Overview/Minimap، Overlayهای عددی/احتمالاتی، Window-Level دقیق و وارد/خارج‌کردن Annotation با حفظ Coordinate System باشد.

منبع: [ASAP — Whole Slide Image Analysis, multi-vendor I/O, overlays, annotations and plugins](https://github.com/computationalpathologygroup/ASAP)

---

# بخش چهارم — شکاف‌های اصلی محصولی و مشخصات قابلیت‌ها

هر Task با شناسه مستقل تعریف شده است. Agent باید قبل از اجرا وجود یا تکمیل آن را دوباره بررسی کند.

## 4.1. WSI و Image I/O

### COMP-WSI-001 — Native WSI Reader واقعی

**وضعیت:** `PARTIAL`  
**اولویت:** `P0`  
**وابستگی:** ندارد  
**هدف:** بازکردن فایل WSI بدون Decode کامل تصویر و خواندن مستقیم Region/Tile از سطح Pyramid واقعی.

#### مشخصات

1. تعریف Trait یا Interface مستقل `SlideReader`.
2. Adapter مستقل برای OpenSlide و Readerهای استاندارد دیگر.
3. استخراج Vendor، Scanner، Objective Power، MPP، Dimensions، Pyramid Levels و Raw Metadata.
4. خواندن مستقیم `read_region(level, x, y, width, height)`.
5. خواندن Thumbnail و Label Image در صورت وجود.
6. حفظ Levelهای واقعی فایل؛ عدم ساخت Pyramid مصنوعی از تصویر پایه وقتی Source خودش Pyramid دارد.
7. مدیریت فایل‌هایی که MPP ندارند یا مقادیر ناسازگار دارند.
8. هندل کردن فایل خراب، ناقص، قفل‌شده یا غیرقابل خواندن.
9. آزادسازی منابع Reader هنگام Close.
10. عدم نگهداری کل WSI در RAM.

#### قرارداد پیشنهادی

```rust
trait SlideReader: Send + Sync {
    fn metadata(&self) -> Result<SlideMetadata, ReaderError>;
    fn level_count(&self) -> usize;
    fn level_dimensions(&self, level: usize) -> Result<Dimensions, ReaderError>;
    fn downsample(&self, level: usize) -> Result<f64, ReaderError>;
    fn read_region(&self, request: RegionRequest) -> Result<PixelRegion, ReaderError>;
    fn read_thumbnail(&self, max_size: u32) -> Result<PixelRegion, ReaderError>;
    fn raw_metadata(&self) -> Result<RawMetadata, ReaderError>;
    fn close(&mut self) -> Result<(), ReaderError>;
}
```

این فقط الگوی مفهومی است؛ آن را بدون بررسی محدودیت‌های `Send/Sync` کتابخانه منتخب عیناً تحمیل نکن.

#### معیار پذیرش

- نمونه‌های واقعی SVS و NDPI و MRXS و TIFF چندرزولوشنی باز شوند.
- تعداد و ابعاد Levelها با ابزار مرجع مقایسه شوند.
- Region درخواست‌شده با مختصات صحیح برگردد.
- حافظه مصرفی با اندازه کل WSI رشد خطی نداشته باشد.
- هنگام حرکت سریع Viewer، درخواست‌های قدیمی قابل لغو باشند.
- در نبود MPP، UI واحد فیزیکی جعلی نشان ندهد.
- فایل نامعتبر پیام خطای قابل فهم بدهد و برنامه Crash نکند.

### COMP-WSI-002 — Format Support Matrix و تشخیص واقعی فرمت

**وضعیت:** `PARTIAL`  
**اولویت:** `P0`

یک ماتریس رسمی پشتیبانی فرمت بساز:

| فرمت/خانواده | قابلیت مورد انتظار | وضعیت باید با تست تعیین شود |
|---|---|---|
| Aperio SVS | WSI Pyramid، MPP، Label/Thumbnail | Native Reader |
| Hamamatsu NDPI | WSI، Metadata، Pyramid | Native Reader |
| 3DHISTECH MRXS | Pyramid، Metadata وابسته به Scanner | Native Reader |
| Leica SCN | Pyramid و Vendor Metadata | Adapter در صورت امکان |
| Philips TIFF/iSyntax | پشتیبانی براساس Decoder واقعی | صریحاً اعلام شود |
| OME-TIFF / BigTIFF | چندصفحه‌ای، Channels، Z/T، Metadata | Reader/Writer |
| Standard TIFF | صفحات، نوع داده و Metadata | Reader/Writer |
| PNG/JPEG/BMP | تصاویر Raster استاندارد | Reader |
| OME-Zarr | Chunked Multiscale N-D | Reader/Writer |
| DICOM VL Whole Slide Microscopy | در فاز Interoperability | اختیاری/آینده |

**قانون:** اگر یک فرمت فقط با Decode کامل و بدون دسترسی صحیح به Pyramid باز می‌شود، آن را `Basic Raster Import` بنام، نه `Native WSI Support`.

### COMP-IO-001 — OME-TIFF / BigTIFF Read & Write واقعی

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

در حال حاضر Export مرتبط با OME XML برای ROIها وجود دارد؛ این معادل Export کامل تصویر OME-TIFF نیست.

موارد ضروری:

- نوشتن Pixel Data و Metadata؛
- حفظ Dimension Order؛
- Channels و Channel Names؛
- Physical Pixel Sizes و Units؛
- Z-spacing و Time Increment در صورت وجود؛
- Plane metadata؛
- BigTIFF برای فایل‌های بزرگ؛
- Compression قابل انتخاب؛
- Pyramid در صورت پشتیبانی Writer؛
- Round-trip validation: بازکردن خروجی توسط TissueAI و یک Reader مستقل.

### COMP-IO-002 — OME-Zarr NGFF

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1`

OME-Zarr برای تصاویر حجیم، Chunked، چندبعدی و Multi-resolution مناسب است. نسخه NGFF باید براساس آخرین نسخه منتشرشده و Schemaهای رسمی در زمان پیاده‌سازی انتخاب شود؛ نسخه را Hardcode نکن.

قابلیت‌ها:

1. خواندن Multiscales Metadata.
2. خواندن Chunks با Compressionهای پشتیبانی‌شده.
3. خواندن Axis Names، Units و Coordinate Transformations.
4. خواندن و نوشتن Labels/Segmentation Arrays.
5. ذخیره Mask و Probability Map به‌عنوان Label یا Dataset مستقل مطابق استاندارد.
6. پشتیبانی از HCS Plate/Well در صورت نیاز.
7. انتخاب Chunk Size براساس Viewer و نوع عملیات.
8. نوشتن Atomic/Transactional یا الگوی safe write مناسب Store.
9. Cache بر اساس Chunk Key و Dataset Version.

معیار پذیرش: داده‌ای که TissueAI صادر می‌کند توسط Reader مستقل OME-Zarr باز شود و داده‌ای که Reader مستقل ایجاد کرده بدون جابه‌جایی محور/واحد در TissueAI نمایش داده شود.

مرجع: https://ngff.openmicroscopy.org/specifications/index.html

### COMP-IO-003 — Import Diagnostics و Metadata Inspector

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

هنگام Import باید پنجره‌ای شامل موارد زیر نمایش داده شود:

- نام و مسیر فایل؛
- نوع Container و Decoder انتخاب‌شده؛
- Vendor/Scanner؛
- ابعاد X/Y؛
- تعداد Channel، Z و T؛
- Bit Depth و Pixel Type؛
- Pyramid Level Count؛
- MPP X و MPP Y؛
- Objective Power در صورت وجود؛
- Color Profile؛
- هشدار Missing/Invalid Metadata؛
- هشدار Unsupported Compression؛
- برآورد حافظه/اندازه داده؛
- گزینه Relink/Copy/Reference برای مدیریت منبع.

به‌هیچ‌وجه Missing Metadata را با مقدار پیش‌فرض علمی پر نکن.

---

## 4.2. Viewer، Layer و تجربه مشاهده علمی

### COMP-VIEW-001 — Multi-layer Scientific Viewer

**وضعیت:** `PARTIAL`  
**اولویت:** `P0/P1`

مدل Layer مستقل از ImageAsset طراحی شود.

#### نوع Layerهای مورد نیاز

| Layer | داده | رفتار |
|---|---|---|
| Image | تصویر اصلی یا کانال | Window/Level، LUT، Opacity، Blend |
| Labels | برچسب‌های Semantic Segmentation | Colormap گسسته، انتخاب Label |
| Probability | احتمال هر کلاس | LUT پیوسته، Threshold |
| Instances | اجسام جداشده | رنگ مستقل برای هر Instance و ID |
| Shapes | Polygon/Rectangle/Ellipse/Polyline | Editable Geometry |
| Points | نقاط سلولی/Marker | اندازه، رنگ، فیلتر |
| Vectors | جهت و میدان جابه‌جایی | Scale و Arrow Rendering |
| Heatmap | تراکم/Expression/Score | Opacity و Color Scale |
| Surface/Volume | داده حجمی/مش | فقط در Viewer سه‌بعدی |
| Tracks | مسیر زمانی سلول/شیء | Time Navigation |

#### قابلیت‌های Layer Manager

- افزودن، حذف، Duplicate و Rename؛
- Visibility؛
- Lock/Unlock؛
- Opacity؛
- Blend Mode؛
- Layer Order؛
- Color/LUT؛
- Display Range؛
- منبع و Provenance؛
- تنظیمات Layer در Project ذخیره شود؛
- امکان Group کردن Layerها؛
- انتخاب هم‌زمان چند Layer؛
- نمایش تفاوت Layerها در Compare Mode.

#### معیار پذیرش

- مخفی‌کردن یک Layer هرگز Image Source را تغییر ندهد.
- تغییر Opacity فقط در Renderer اعمال شود.
- Labels و Probability با Pixel Type و Palette صحیح نمایش داده شوند.
- Layerهای Annotation با جابه‌جایی Viewport همگام بمانند.
- تنظیمات پس از Close/Reopen بازیابی شوند.

### COMP-VIEW-002 — N-Dimensional Viewer کامل

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

پشتیبانی واقعی از محورهای X/Y/C/Z/T:

- Channel Selector؛
- Z Slider و Z Navigation؛
- Time Slider؛
- نمایش Z Projection؛
- انتخاب Projection: Maximum/Mean/Sum و سایر روش‌های معتبر؛
- نمایش چند کانال با LUT و Blend؛
- وضعیت محور و Index در Status Bar؛
- Scale و Unit برای هر محور؛
- نمایش Planeهای مختلف بدون Load کامل کل Dataset.

Viewer باید از Lazy Plane/Chunk Loading استفاده کند.

### COMP-VIEW-003 — Synchronized Compare Viewer

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1`

حالت‌های مقایسه:

1. Side-by-side؛
2. Synchronized Pan/Zoom؛
3. Swipe/Divider؛
4. Flicker Comparison؛
5. Alpha Overlay؛
6. Difference Image؛
7. Registered Overlay؛
8. Before/After Processing؛
9. مقایسه H&E با IHC یا IF در صورت وجود Registration معتبر.

همگام‌سازی مختصات تنها وقتی مجاز است که Transform ثبت‌شده و معتبر وجود داشته باشد. در نبود Registration، Viewer نباید ادعای Alignment کند.

### COMP-VIEW-004 — Minimap و Tissue Navigation

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1`

- نمایش Thumbnail کل Slide؛
- کادر Viewport فعلی؛
- Drag برای جابه‌جایی؛
- نمایش Tissue Mask و ROIها روی Overview؛
- نمایش Scale/Zoom؛
- Navigator مستقل برای چند اسلاید؛
- امکان Jump به Annotation/Detection منتخب.

### COMP-VIEW-005 — Measurement Visualization و Data Chart داخل Viewer

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

- نمایش رنگی اشیاء بر اساس Feature مثل Area، Cell Density، Class، Intensity یا Model Score؛
- Legend همراه با Min/Max و Unit؛
- Threshold Range؛
- Tooltip روی هر Cell/Object؛
- Scatter Plot و Histogram مرتبط با انتخاب اشیا؛
- انتخاب نقطه روی نمودار و Highlight آن در Viewer؛
- Selection Brushing بین Table، Chart و Viewer.

---

## 4.3. ابزارهای کمی ImageJ/Fiji که باید تکمیل شوند

### COMP-ANALYSIS-001 — Analyze Particles معادل حرفه‌ای

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1`

یک ابزار مستقل برای تحلیل اجسام متصل در Mask/Binary Image بساز.

#### ورودی‌ها

- Image/Mask Source؛
- Threshold یا Label Layer؛
- ROI یا Annotation محدوده تحلیل؛
- Connectivity: 4 یا 8 برای 2D و گزینه مناسب برای 3D؛
- Minimum/Maximum Area؛
- Minimum/Maximum Circularity؛
- فیلتر Aspect Ratio، Solidity یا سایر Featureها؛
- Exclude Objects on Image/ROI Boundary؛
- Include/Exclude Holes؛
- گزینه Watershed قبل از شمارش؛
- گزینه Add Detected Objects to ROI/Annotation Manager.

#### خروجی‌ها

**Per-Object Table:**

- Object ID؛
- Class؛
- Area (px² و واحد فیزیکی معتبر)؛
- Perimeter؛
- Centroid؛
- Bounding Box؛
- Circularity؛
- Aspect Ratio؛
- Solidity؛
- Eccentricity؛
- Feret Max/Min؛
- Mean/Min/Max/StdDev Intensity؛
- Channel-specific Values؛
- ROI/Parent ID؛
- Detection Confidence در صورت AI.

**Summary Table:**

- Count؛
- Total Area؛
- Mean Area؛
- Median Area؛
- Area Fraction؛
- Mean/Median Intensity؛
- Density per mm² در صورت Calibration معتبر؛
- شمارش بر اساس Class؛
- تعداد اشیای حذف‌شده توسط هر Filter.

#### UX

- Preview قبل از اجرای نهایی؛
- امکان اصلاح Parameters؛
- نمایش Object Overlay؛
- انتخاب ردیف Table و Highlight کردن Object؛
- Sort/Filter/Search؛
- Export CSV/Parquet در صورت پشتیبانی؛
- ذخیره Analysis Run با پارامترها و Image Hash.

#### معیار پذیرش

- تست با Binary Maskهای مصنوعی با Count/Area معلوم؛
- هندسه و Measurement با Reference مستقل مقایسه شود؛
- Hole و Edge behavior تست جداگانه داشته باشند؛
- نتیجه یکسان برای اجرای تکراری با پارامتر یکسان حاصل شود.

مرجع: https://imagej.net/ij/docs/menus/analyze.html

### COMP-ANALYSIS-002 — ROI Pixel Statistics و Multi-Measure

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

برای هر ROI و هر Channel موارد زیر محاسبه شوند:

- Pixel Count؛
- Area؛
- Mean؛
- Median؛
- Minimum؛
- Maximum؛
- Standard Deviation؛
- Variance؛
- Integrated Density؛
- Histogram؛
- Percentiles؛
- Background-corrected intensity در صورت تعریف روش؛
- امکان مقایسه قبل و بعد از Processing.

برای ROIهای بزرگ، خواندن باید Tile/Region-based باشد؛ ایجاد یک Copy کامل از تصویر ضروری نباشد.

### COMP-ANALYSIS-003 — Line Profile و Plot Profile

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

- رسم Line/Polyline؛
- استخراج مقدار Pixel/Intensity در طول مسیر؛
- انتخاب Channel؛
- Interpolation Method؛
- X-axis بر اساس Pixel یا Distance فیزیکی؛
- نمودار قابل Zoom؛
- Save CSV و تصویر نمودار؛
- مقایسه چند Profile؛
- ثبت Path و پارامتر Interpolation.

### COMP-ANALYSIS-004 — Image Calculator و Stack Math

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

عملیات بین دو تصویر هم‌اندازه/هم‌تراز:

- Add؛
- Subtract؛
- Multiply؛
- Divide با مدیریت Divide-by-zero؛
- Difference؛
- Min/Max؛
- Average؛
- AND/OR/XOR برای Maskها؛
- Absolute Difference؛
- Normalize؛
- عملیات روی Stack/Channel با کنترل Dimension Matching.

هیچ عملیات بین دو Image با Dimension/Calibration ناسازگار نباید بدون هشدار و Transform تعریف‌شده اجرا شود.

### COMP-ANALYSIS-005 — Profile و Histogram ابزارهای پژوهشی

**وضعیت:** `PARTIAL`  
**اولویت:** `P2`

- Histogram per Channel؛
- Histogram داخل ROI؛
- Auto Binning قابل انتخاب؛
- Cumulative Histogram؛
- Percentile Clipping؛
- Line/Area Profile؛
- Log Scale؛
- نمایش Min/Max/Mean/Median؛
- Export Data و Figure.

---

## 4.4. Tissue Detection و Tissue Quality Control

### COMP-PATH-001 — Adaptive Tissue Detection

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

Tissue Detection را از Threshold روشنایی ساده به ماژول چندروش تبدیل کن.

#### روش‌های مورد نیاز

1. RGB/Lab Color Threshold؛
2. Optical Density Features؛
3. Saturation/Intensity Features؛
4. Texture-based Tissue Detection؛
5. Morphological Cleanup؛
6. Region Merge؛
7. Hole Filling با کنترل کاربر؛
8. Minimum Tissue Area؛
9. Artifact Exclusion؛
10. Trainable Tissue Classifier.

#### طبقه‌بندی پیشنهادی Mask

- Tissue؛
- Background؛
- Glass/Empty؛
- Artifact؛
- Uncertain.

Mask باید Confidence/Uncertainty داشته باشد. نواحی نامطمئن نباید بی‌صدا به Tissue یا Background تبدیل شوند.

### COMP-PATH-002 — Tissue Quality Control (Slide QC)

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P0/P1`

یک قابلیت پرارزش و نسبتاً متمایز برای TissueAI است: قبل از تحلیل، کیفیت اسلاید را ارزیابی کن تا خروجی Segmentation روی تصویر نامناسب به‌عنوان نتیجه قابل اتکا نمایش داده نشود.

#### انواع QC

- Focus/Blur Detection؛
- Out-of-focus Region Map؛
- Tissue Fold Detection؛
- Air Bubble Detection؛
- Dust/Debris Detection؛
- Pen/Ink Mark Detection؛
- Stain Precipitate Detection؛
- Compression/Tile Artifact Detection؛
- Tissue Tear/Crack Detection؛
- Scanner Streak/Illumination Artifact؛
- Over/Under-staining؛
- Empty Tissue Region؛
- Background Contamination.

#### خروجی

- QC Score کلی با شرح روش؛
- QC Map در سطح Tile؛
- Class و Confidence هر Artifact؛
- درصد Tissue قابل تحلیل؛
- فهرست Regionهای نیازمند بازبینی؛
- گزارش دلیل رد/قبول یک Slide برای Pipeline.

**قانون:** یک Score کلی بدون نقشه فضایی و بدون تعریف متریک کافی نیست. هر QC Model باید روی Dataset مرجع ارزیابی شود.

### COMP-PATH-003 — Exclusion Regions / Ignore Areas

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1`

کاربر باید بتواند مناطق زیر را از Analysis مستثنی کند:

- Artifact؛
- Necrosis؛
- Fold؛
- Empty/Background؛
- مناطق خارج از Tissue؛
- ROIهای دستی Ignore.

Exclusion Mask باید در Detection، Segmentation، Measurement و Cohort Analysis اعمال شود؛ نه صرفاً روی تصویر Overlay گردد.

### COMP-PATH-004 — Tissue Compartment Classification

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1`

طبقه‌بندی بافت به Compartmentهای قابل تنظیم:

- Tumor؛
- Stroma؛
- Necrosis؛
- Fat؛
- Muscle؛
- Vessels؛
- Lymphoid tissue؛
- Normal tissue؛
- Background؛
- Other/Unknown.

ویژگی‌ها:

- مدل کلاسیک/ML و مدل Deep Learning قابل انتخاب؛
- نمایش Probability Map؛
- Correction دستی؛
- Training sample management؛
- محاسبه Area/Percentage برای هر Compartment؛
- اتصال به Cell Density و Spatial Analysis؛
- ارزیابی Confusion Matrix و IoU/Dice.

---

## 4.5. Cell، Nuclei و Object Analysis

### COMP-CELL-001 — End-to-End Cell/Nuclei Analysis Pipeline

**وضعیت:** `PARTIAL`  
**اولویت:** `P0/P1`

مسیر نهایی باید این باشد:

`Input Slide → Tissue Mask → Tile Extraction → Nuclei/Cell Inference → Instance Reconciliation → Object Classification → Measurements → Spatial Analysis → Export`

#### حداقل قابلیت‌ها

- Nuclei Detection؛
- Nuclei Instance Segmentation؛
- Cell Boundary Estimation در صورت وجود ورودی مناسب؛
- Cell Centroid؛
- Cell/Nuclei ID پایدار؛
- ادغام نتایج Tileهای Overlap شده؛
- جلوگیری از Duplicate Detection؛
- حفظ Global Coordinates؛
- اتصال Cell به Parent Tissue Region/ROI؛
- امکان اصلاح دستی نتیجه؛
- Export Instance Mask و Object Table.

#### مدل‌های قابل اتصال

- StarDist؛
- Cellpose؛
- Hover-Net؛
- InstanSeg؛
- Mesmer؛
- U-Net و مدل‌های سازگار دیگر.

مدل‌ها باید Adapter و Manifest مشخص داشته باشند. نمایش نام مدل در UI بدون اجرای واقعی کافی نیست.

### COMP-CELL-002 — Cell Object Classifier

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1`

پس از Cell Detection، هر سلول/هسته باید با ویژگی‌های قابل انتخاب دسته‌بندی شود.

#### Featureها

- Area؛
- Perimeter؛
- Circularity؛
- Solidity؛
- Eccentricity؛
- Major/Minor Axis؛
- Nuclear/Cytoplasm Ratio در صورت Segmentation معتبر؛
- Mean/Median Intensity؛
- Color/Optical Density؛
- Texture Features؛
- Neighbor-based Features؛
- Model embeddings در صورت مجاز بودن.

#### Classification

- Non-tumor / Tumor؛
- Lymphocyte؛
- Plasma Cell؛
- Macrophage؛
- Epithelial؛
- Stromal؛
- Endothelial؛
- Other/Unknown.

این Classها مثال اولیه هستند و باید بر اساس Tissue/Study قابل تعریف باشند؛ نباید به‌عنوان طبقه‌بندی عمومی قطعی تلقی شوند.

#### آموزش و ارزیابی

- انتخاب مثال‌های مثبت/منفی از Viewer؛
- ذخیره Sample Set؛
- Train/Validation/Test split در سطح Slide یا Patient، نه Random Cell Split؛
- Confusion Matrix؛
- Precision/Recall/F1؛
- Per-class Metrics؛
- Calibration؛
- Export Classifier؛
- Apply to Current Slide یا Dataset.

### COMP-CELL-003 — Cell Phenotyping و Marker-based Rules

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1/P2`

برای Multiplex/IHC، قابلیت Phenotyping باید با قواعد قابل تنظیم ارائه شود:

- Marker positivity threshold؛
- Positive/Negative/Weak/Moderate/Strong؛
- ترکیب چند Marker با AND/OR/NOT؛
- Boolean phenotype rules؛
- نمایش سلول‌های مطابق Rule؛
- نرخ مثبت‌ها در ROI/Compartment؛
- ثبت Threshold و نسخه کانال/Preprocessing.

قواعد Phenotype باید شفاف و قابل Export باشند؛ نتیجه مدل نباید به‌عنوان حقیقت زیستی معرفی شود.

### COMP-CELL-004 — Cell Density و Spatial Neighborhood

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

- Cells/mm² یا Cells/px² با Calibration معتبر؛
- Density Map؛
- Distance to nearest neighbor؛
- Nearest-neighbor distribution؛
- Cell-to-cell distance؛
- Cell-to-tumor boundary distance؛
- Neighborhood composition؛
- K-nearest neighbors؛
- Radius-based neighborhoods؛
- Ripley’s K/L یا روش‌های Point Pattern مناسب؛
- Spatial Graph؛
- Tumor-infiltrating lymphocyte density؛
- Per-compartment statistics.

برای هر الگوریتم باید تعریف فاصله، Unit، Edge Handling و Spatial Scale ثبت شود.

---

## 4.6. IHC، H-score و Multiplex Imaging

### COMP-IHC-001 — H-score و IHC Quantification

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1`

این قابلیت برای Digital Pathology کاربرد مستقیم دارد.

#### حداقل امکانات

- تعریف Marker؛
- تفکیک Intensity به 0، 1+، 2+ و 3+؛
- Threshold قابل تنظیم برای Optical Density یا معیار معتبر دیگر؛
- Positive Cell Percentage؛
- Weak/Moderate/Strong Percentage؛
- H-score:

`H-score = (1 × %1+) + (2 × %2+) + (3 × %3+)`

محدوده معمول محاسبه 0 تا 300 است، مشروط به اینکه درصدها بین 0 تا 100 و تعریف Thresholdها روشن باشد. این فرمول در این سند به‌عنوان قابلیت پیشنهادی IHC تعریف شده است؛ وجود منوی مستقیم H-score در نسخه فعلی TissueAI اثبات نشده و باید به‌صورت قابلیت مستقل همراه با Validation پیاده‌سازی شود.

- H-score per ROI؛
- H-score per Compartment؛
- H-score per Slide؛
- Heatmap؛
- مقایسه چند Slide/Patient؛
- Export raw counts و Thresholds.

**توجه:** H-score فقط وقتی معتبر است که Stain Deconvolution، کالیبراسیون رنگ و Threshold validation قابل دفاع باشند. نباید مقدار نهایی بدون نمایش روش به کاربر تحویل شود.

### COMP-IHC-002 — Multiplex Immunofluorescence / Multichannel Analysis

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P1/P2`

- بازکردن Channelهای متعدد بدون Flatten؛
- Channel Name/Excitation/Emission Metadata در صورت موجود بودن؛
- LUT مستقل هر Channel؛
- Blend Mode؛
- Background Subtraction؛
- Spectral Unmixing در صورت وجود داده و مدل معتبر؛
- Bleed-through assessment؛
- Colocalization با تعریف Pearson/Manders یا روش دیگر؛
- Cell-level Marker Quantification؛
- Phenotype combinations؛
- کنترل Threshold به تفکیک Channel؛
- مقایسه چند Marker؛
- Export per-cell matrix.

از انجام Spectral Unmixing بدون داشتن Reference Spectra یا روش تعریف‌شده خودداری شود.

### COMP-IHC-003 — Stain Vector Management و Color Deconvolution QA

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

- انتخاب Preset استاندارد H&E و H-DAB؛
- Estimation Stain Vectors از تصویر/ROI؛
- نمایش Vectors؛
- امکان اصلاح دستی؛
- Save Custom Stain Profile؛
- اعتبارسنجی Condition Number/Vector Separation؛
- نمایش کانال‌های جداشده؛
- ثبت Preset و Vectorها در Provenance؛
- پشتیبانی از اسکنر/پروتکل متفاوت بدون فرض یک Vector ثابت.

---

## 4.7. TMA — Tissue Microarray

### COMP-TMA-001 — TMA Grid & Core Analysis

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2` (برای محصول با تمرکز پاتولوژی بسیار ارزشمند)

#### قابلیت‌ها

1. تعریف TMA Grid با Rows/Columns؛
2. تعریف قطر/شکل Core؛
3. تشخیص خودکار Coreها؛
4. اصلاح دستی Grid و Core Boundary؛
5. شناسه مستقل هر Core؛
6. Patient/Specimen ID قابل اتصال؛
7. علامت‌گذاری Missing Core؛
8. علامت‌گذاری Damaged/Unusable Core؛
9. Annotation جداگانه هر Core؛
10. اجرای Detection/Segmentation/Classification روی هر Core؛
11. گزارش H-score و Cell Density per Core؛
12. مقایسه Coreها در سطح Cohort؛
13. Export جدول با ردیف مشخص برای هر Core.

#### معیار پذیرش

- Grid با الگوی منظم و چند Core مفقود تست شود.
- جابه‌جایی یا چرخش Slide باعث نسبت‌دادن اشتباه Core ID نشود.
- نتایج هر Core به همان Core و Project متصل بماند.
- Export با داده خام و IDهای قابل رهگیری انجام شود.

---

## 4.8. Cohort Analysis و آمار گروهی

### COMP-COHORT-001 — Multi-slide Quantitative Dashboard

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

Batch Detection روی چند فایل با Cohort-level Analysis یکسان نیست.

قابلیت‌های مورد نیاز:

- انتخاب یک Dataset یا چند Slide؛
- انتخاب Analysis Pipeline؛
- اجرای Batch با Job Queue؛
- ادامه از آخرین Slide موفق؛
- گزارش Failure per Slide؛
- تجمیع Per-slide و Per-ROI metrics؛
- فیلتر بر اساس گروه/Condition/Marker؛
- مقایسه گروه‌ها؛
- Distribution Plot، Box Plot، Violin Plot، Scatter Plot و Heatmap؛
- Export CSV و Summary Report؛
- ثبت Inclusion/Exclusion Criteria.

#### Data Model

برای هر نمونه، Metadata قابل تنظیم ولی ساختارمند:

- Sample ID؛
- Patient/Specimen ID با کنترل حریم خصوصی؛
- Group/Condition؛
- Tissue Type؛
- Staining Protocol؛
- Scanner/Acquisition Metadata؛
- Experimental Batch؛
- Time Point؛
- Optional clinical/research labels.

اطلاعات حساس نباید بدون نیاز وارد Log یا Export عمومی شوند.

### COMP-COHORT-002 — Statistical Analysis Panel

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

- Descriptive Statistics؛
- Confidence Interval؛
- Normality Diagnostics؛
- Parametric/Non-parametric tests در محدوده‌ای که درست پیاده‌سازی و مستند شده‌اند؛
- Multiple Testing Correction؛
- Effect Size؛
- Correlation؛
- Linear/Logistic Regression در صورت نیاز؛
- Survival Analysis فقط در صورت توسعه Dataset و تعریف روشن ورودی/خروجی؛
- گزارش Test Assumption و Missing Data.

**مهم:** این بخش جایگزین نرم‌افزار آماری تخصصی نیست؛ نتایج باید نام آزمون، فرض‌ها، اندازه نمونه و روش اصلاح چندگانه را نشان دهند.

---

## 4.9. AI Model Lifecycle و ارزیابی مدل

### COMP-AI-001 — Model Registry واقعی

**وضعیت:** `PARTIAL`  
**اولویت:** `P0/P1`

Registry باید مدل‌های Detection، Classification، Semantic Segmentation، Instance Segmentation و Regression را پوشش دهد.

هر Model Manifest حداقل شامل موارد زیر باشد:

```json
{
  "model_id": "stable-id",
  "name": "Model display name",
  "version": "1.0.0",
  "task_type": "instance_segmentation",
  "format": "onnx",
  "file_sha256": "...",
  "input_schema": {},
  "output_schema": {},
  "preprocessing": {},
  "postprocessing": {},
  "class_map": {},
  "recommended_pixel_size": null,
  "supported_pixel_types": [],
  "license": "",
  "source_url": "",
  "citation": "",
  "training_dataset_description": "",
  "evaluation_metrics": {},
  "created_at": "",
  "hardware_requirements": {}
}
```

فیلدهای بالا نمونه Schema هستند؛ JSON Schema نسخه‌دار و Validation واقعی ایجاد کن.

#### قابلیت‌های Registry

- نصب/حذف مدل؛
- Import مدل محلی؛
- Hash Verification؛
- نمایش License و Citation؛
- نسخه و تاریخ؛
- Model Compatibility Check؛
- Input/Output Shape Inspector؛
- Device Compatibility؛
- Model Warm-up؛
- Model Session Cache؛
- جلوگیری از بارگذاری مکرر بی‌دلیل؛
- پاک‌سازی منابع پس از Idle/Close؛
- تست Model قبل از فعال شدن در Production UI.

### COMP-AI-002 — مدل و Inference روی WSI

**وضعیت:** `PARTIAL`  
**اولویت:** `P0/P1`

- Tile inference؛
- Overlap strategy؛
- Edge handling؛
- Coordinate transform به Level 0؛
- NMS/Merge بین Tileها؛
- حذف Duplicate Instance؛
- Stable Global Object ID؛
- Progress و Cancel واقعی؛
- مدیریت VRAM/RAM؛
- Retry برای Tile failure؛
- ذخیره Partial Results؛
- Resume از Tileهای موفق؛
- امکان انتخاب ROI برای Inference؛
- امکان Skip کردن Exclusion Region؛
- Save Probability/Instance Mask به Layer/Artifact.

### COMP-AI-003 — Model Evaluation Studio

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1`

برای مدل‌های Detection/Segmentation/Classification:

- Dataset Split با Grouping بر اساس Patient/Slide؛
- جلوگیری از Data Leakage؛
- Holdout Test Set؛
- Cross-validation در صورت نیاز؛
- Confusion Matrix؛
- Precision، Recall، F1؛
- AP/mAP برای Detection؛
- IoU و Dice برای Segmentation؛
- ROC-AUC و PR-AUC برای Classification؛
- Calibration Error؛
- Per-class Metrics؛
- Threshold Sweep؛
- Error Gallery؛
- False Positive/False Negative Review؛
- Export Evaluation Report؛
- ثبت Dataset Version و Model Hash.

### COMP-AI-004 — Human-in-the-loop و Active Learning

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

- نمایش Prediction با Uncertainty؛
- انتخاب نمونه‌های کم‌اطمینان؛
- Correction دستی؛
- افزودن Correction به Training Set؛
- نسخه‌بندی Annotation/Training Dataset؛
- Retrain با ثبت تنظیمات؛
- مقایسه نسخه قبل/بعد؛
- جلوگیری از واردکردن ناخواسته داده Test به Training.

### COMP-AI-005 — Explainability و Uncertainty

**وضعیت:** `PARTIAL/NOT_EVIDENCED`  
**اولویت:** `P2`

- نمایش Confidence بدون ادعای قطعیت؛
- Uncertainty Map؛
- Error/Failure Cases؛
- Feature Importance برای مدل‌های کلاسیک؛
- Grad-CAM/Saliency فقط برای معماری‌های پشتیبانی‌شده؛
- نمایش محدودیت Domain؛
- هشدار Domain Shift؛
- Model Card و Intended Use.

---

## 4.10. Workflow، Macro، Scripting و Automation

### COMP-AUTO-001 — Executable Workflow DAG

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

Workflow واقعی باید Graph از Nodeهای قابل اجرا باشد.

#### Node Categories

- Import؛
- WSI Tile/Region Reader؛
- Tissue Detection؛
- QC؛
- Stain Deconvolution؛
- Filter؛
- Threshold؛
- Segmentation؛
- Detection؛
- Classification؛
- Measurement؛
- Registration؛
- Spatial Analysis؛
- Export؛
- Report.

#### Graph Features

- Node Input/Output Schema؛
- Edge validation؛
- Dependency graph؛
- Topological execution؛
- Cycle detection؛
- Branch/Conditional Node؛
- Loop/Batch Node با Guard؛
- Parameter UI؛
- Node-level caching؛
- Retry؛
- Resume؛
- Cancellation؛
- Save/Load Template؛
- Versioning؛
- Execution Provenance؛
- Visual error localization.

### COMP-AUTO-002 — Macro Recorder و Script Console

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P1/P2`

حداقل یک روش Automation قابل اتکا ارائه شود:

1. Record user actions به Command Sequence قابل بازبینی؛
2. Convert History به Workflow؛
3. Script Console با API مستند؛
4. Headless Batch Mode برای اجرای Pipeline؛
5. CLI برای اجرای Taskهای معتبر؛
6. Export/Import Script؛
7. Error line و Stack Trace قابل فهم.

امنیت: Script اجراشونده باید Permission و Scope داشته باشد. از اجرای Arbitrary Shell/Code بدون کنترل و هشدار خودداری کن.

### COMP-AUTO-003 — Plugin SDK و Extension Manager

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

Plugin API نسخه‌دار بساز:

- Manifest؛
- Plugin ID و Version؛
- Compatibility range؛
- Permission declaration؛
- UI Extension points؛
- Processing Provider؛
- Reader Provider؛
- Model Provider؛
- Import/Export Provider؛
- Plugin lifecycle؛
- Dependency resolution؛
- Signature/Hash verification؛
- Enable/Disable؛
- Crash isolation تا حد امکان.

هر Plugin نباید دسترسی نامحدود به File System، Network، User Data یا Shell دریافت کند.

---

## 4.11. Annotation Interoperability و فرمت‌های تبادل

### COMP-INTEROP-001 — Import/Export Annotation Formats

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

GeoJSON و OME XML ROI در پروژه دیده می‌شوند، اما برای تبادل عملی با QuPath، ImageJ و ASAP باید Import/Export و Coordinate Semantics کامل شوند.

فرمت‌های هدف:

- GeoJSON؛
- QuPath-compatible GeoJSON/Measurements؛
- ASAP XML؛
- ImageJ ROI / ROI ZIP؛
- OME ROI XML؛
- CSV Object/Measurement Table؛
- JSON canonical TissueAI Annotation Schema.

#### الزامات

- حفظ Pixel Coordinate System؛
- حفظ Level 0 Coordinates برای WSI؛
- حفظ Physical Unit در صورت معتبر بودن؛
- حفظ Class/Name/Color/Parent/Group؛
- پشتیبانی Geometryهای ناسازگار با Mapping مستند؛
- Import Report برای Unsupported Geometry؛
- Round-trip test؛
- عدم جابه‌جایی یا Scale اشتباه مختصات.

### COMP-INTEROP-002 — DICOM WSI / SEG / SR

**وضعیت:** `OUT_OF_SCOPE_OPTIONAL`  
**اولویت:** `P3`

برای ورود به اکوسیستم بیمارستانی/آرشیو تصویربرداری در آینده:

- DICOM VL Whole Slide Microscopy؛
- DICOM SEG برای Maskها؛
- DICOM SR برای نتایج ساختاریافته؛
- Mapping مشخص بین Slide UID، Series UID، Frame و Coordinate;
- De-identification؛
- اعتبارسنجی با DICOM Conformance Test.

این قابلیت را پیش از تثبیت WSI و OME Interoperability اجرا نکن.

---

## 4.12. Project، Provenance و Reproducibility

### COMP-PROJECT-001 — Analysis Artifact Store

**وضعیت:** `PARTIAL`  
**اولویت:** `P0/P1`

Project باید فقط فایل مرجع تصویر و خلاصه Pipeline را نگه ندارد. ساختار Artifact مستقل ایجاد کن:

- Source Image Reference؛
- Image/Mask/Probability Artifacts؛
- ROI/Annotation Set؛
- Object Detection Table؛
- Cell Table؛
- Measurement Table؛
- QC Result؛
- Model Prediction;
- Workflow Definition؛
- Workflow Execution؛
- Export Manifest؛
- Report؛
- Model Manifest/Hash.

هر Artifact باید:

- UUID پایدار؛
- Schema Version؛
- Created/Modified Time؛
- Source IDs؛
- Parameters؛
- Hash؛
- Status؛
- Provenance؛
- Optional Parent Artifact ID داشته باشد.

### COMP-PROJECT-002 — Provenance و Reproducibility Graph

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

برای هر نتیجه علمی باید قابل پاسخ باشد:

- از کدام Source Image ایجاد شد؟
- Hash یا Fingerprint منبع چه بود؟
- چه Version نرم‌افزاری اجرا شد؟
- چه Model و کدام Hash؟
- چه Parameters و Thresholdها؟
- روی چه ROI/Mask/Tileهایی اجرا شد؟
- چه Calibration و Unit استفاده شد؟
- چه زمان و Deviceی؟
- آیا نتیجه دستی ویرایش شده است؟
- چه Artifactهایی خروجی شدند؟

تغییر یک Input باید وضعیت Artifactهای وابسته را `Stale` کند یا امکان Recompute را نمایش دهد.

### COMP-PROJECT-003 — Crash Recovery و Backup UI

**وضعیت:** `PARTIAL/NEEDS_VALIDATION`  
**اولویت:** `P1`

- Autosave کنترل‌شده؛
- Dirty State؛
- Recovery Snapshot؛
- Backup Rotation؛
- Project Integrity Check؛
- Restore Preview؛
- Schema Migration؛
- Relink Missing Source؛
- Conflict Resolution؛
- تست قطع برق/Terminate Process در حین ذخیره.

---

## 4.13. Collaboration، Review و Scientific Governance

### COMP-COLLAB-001 — Annotation Review Workflow

**وضعیت:** `OUT_OF_SCOPE_OPTIONAL`  
**اولویت:** `P2`

برای تیم تحقیقاتی:

- Reviewer/Annotator roles؛
- Assignment؛
- Pending/Reviewed/Rejected؛
- Comment روی ROI؛
- اختلاف Annotationها؛
- Consensus Annotation؛
- Version History؛
- Change Author و Timestamp؛
- Export Audit Trail.

در نسخه Local-first می‌توان این را ابتدا به‌صورت Review داخلی تک‌کاربره یا Project History طراحی کرد و بعداً Sync چندکاربره افزود.

### COMP-COLLAB-002 — OMERO Connector

**وضعیت:** `OUT_OF_SCOPE_OPTIONAL`  
**اولویت:** `P2/P3`

- اتصال با Credential امن؛
- Browse Project/Dataset/Image؛
- Import by Reference یا Download Cache؛
- Read/Write Annotation با Permission؛
- Export Results؛
- Group-aware Access؛
- Sync Conflict Handling؛
- Offline Cache و Reconnect.

OMERO Connector نباید باعث شود TissueAI بدون OMERO نیز قابل استفاده نباشد.

---

## 4.14. Reporting و Publication Workflow

### COMP-REPORT-001 — Scientific Report Builder

**وضعیت:** `PARTIAL`  
**اولویت:** `P1`

گزارش پژوهشی از Markdown ساده فراتر برود و شامل موارد زیر باشد:

- Project/Study Metadata؛
- Slide List؛
- Methods؛
- Model Name/Version/Citation؛
- Image Preprocessing؛
- Calibration؛
- ROI Definition؛
- QC Summary؛
- Measurements؛
- Statistical Methods؛
- Limitations؛
- Figures و Overlays؛
- Tables؛
- Reproducibility Manifest؛
- Export Date و Software Version.

خروجی‌ها:

- Markdown؛
- HTML؛
- CSV؛
- JSON;
- PDF از طریق مسیر قابل اعتماد و تست‌شده.

### COMP-REPORT-002 — Figure Composer

**وضعیت:** `NOT_IMPLEMENTED/NOT_EVIDENCED`  
**اولویت:** `P2`

- Panel Layout؛
- Scale Bar؛
- Legend؛
- Colorbar؛
- Annotation Labels؛
- Font/Resolution؛
- DPI و Size؛
- Export TIFF/PNG/SVG/PDF حسب امکان؛
- ثبت Source Asset و Layerها.

خروجی Figure باید برای Publication مناسب باشد، اما هیچ‌وقت Scale Bar یا Metadata را بدون داده معتبر درج نکند.

---

# بخش پنجم — UI/UX اختصاصی قابلیت‌های جدید

## 5.1. Workspaceهای Contextual

به‌جای قرار دادن همه ابزارها در یک Sidebar بلند، Workspaceهای تخصصی تعریف کن:

1. **Explore:** Slide Navigation، Viewer، Metadata، Layers.
2. **Annotate:** ROI، Brush، Polygon، Class، Object Editing.
3. **Analyze:** Processing، Measurements، Analyze Particles، Histology.
4. **AI:** Model Registry، Inference، Training، Evaluation، Review.
5. **Compare:** Synchronized Viewers، Registration، Difference.
6. **Cohort:** Dataset، Batch Analysis، Group Statistics.
7. **Automate:** Workflow Graph، Script، Job Queue.
8. **Report:** Tables، Figures، Methods، Export.

کاربر باید Workspace را تغییر دهد بدون اینکه Project یا Slide فعال از دست برود.

## 5.2. الگوی ثابت Tool Panel

هر Tool باید:

- شرح کوتاه و علمی؛
- ورودی و خروجی روشن؛
- Parameterهای قابل تنظیم؛
- Defaultهای علمی مستند؛
- Preview؛
- Apply/Cancel؛
- Progress؛
- Error details؛
- History entry؛
- Re-run with previous parameters داشته باشد.

## 5.3. Results Table مشترک

یک Results Table واحد برای Detection، Cell، ROI، Measurement و QC بساز:

- Column visibility؛
- Sorting؛
- Filtering؛
- Grouping؛
- Search؛
- Copy؛
- Export؛
- Row selection؛
- Cross-highlight در Viewer؛
- Column unit؛
- Missing-value representation؛
- Provenance tooltip.

## 5.4. Command Palette و Keyboard Workflow

- Search برای Toolها، Actionها، Projectها و Slideها؛
- میانبرهای Pan/Zoom/ROI؛
- Toggle Panel؛
- Next/Previous Slide؛
- Run Last Tool؛
- Undo/Redo؛
- Jump to ROI؛
- Search Object ID؛
- Shortcut customization و Conflict Detection.

## 5.5. Accessibility و خوانایی

- Dark/Light parity؛
- Contrast مناسب؛
- Keyboard-only workflows؛
- Focus indicator؛
- Tooltip و Help text؛
- Reduced Motion؛
- عدم استفاده از رنگ تنها برای تمایز Class؛
- Pattern/Border یا Label به‌عنوان نشانه مکمل؛
- جلوگیری از کوچک‌شدن نامناسب فونت روی پنل‌های علمی.

---

# بخش ششم — الزامات کیفیت، امنیت و Performance برای قابلیت‌های جدید

## 6.1. Scientific Correctness

- Unknown Calibration باید Unknown باقی بماند.
- Area و Distance با MPPx و MPPy مستقل محاسبه شوند.
- تبدیل Coordinate بین Levelها با Downsample واقعی همان Level انجام شود.
- Pixel Type بدون دلیل به U8 تبدیل نشود.
- عملیات Quantitative بر روی Display-rendered RGB انجام نشود مگر روش صریحاً همین را تعریف کرده باشد.
- Threshold/Color Deconvolution باید Parameter و Preset خود را ذخیره کند.
- خروجی Mask باید Coordinate System و Dimension Source داشته باشد.
- Measurement باید واحد، روش و Input را ثبت کند.
- NaN/Inf و Divide-by-zero مدیریت شوند.
- عملیات destructive روی Source Image ممنوع؛ مگر با نسخه خروجی جداگانه و تأیید روشن کاربر.

## 6.2. Performance Targets

اعداد زیر **هدف اولیه Benchmark** هستند، نه ادعای عملکرد فعلی. Agent باید آن‌ها را روی سخت‌افزار مشخص اندازه بگیرد و در صورت غیرواقعی بودن، با داده و استدلال اصلاح کند.

- Pan/Zoom بدون Freeze UI؛
- اولویت Tileهای Visible نسبت به Prefetch؛
- جلوگیری از Tileهای Duplicate؛
- Cache با سقف حافظه قابل تنظیم؛
- امکان Cancel درخواست‌های قدیمی Viewport؛
- عدم نگهداری همه WSI در RAM؛
- نمایش وضعیت Decode/Inference؛
- عملیات Batch خارج از UI Thread؛
- جلوگیری از انتقال Base64 سنگین در هر Tile در صورت وجود گزینه باینری بهتر.

Benchmark باید حداقل روی این Datasetها اجرا شود:

- Raster کوچک 2D؛
- TIFF بزرگ؛
- WSI چندرزولوشنی متوسط؛
- WSI چندگیگابایتی (در صورت دسترسی مجاز)؛
- Z-stack؛
- Multichannel image؛
- Mask با تعداد زیاد Instance.

## 6.3. Security

- Local server فقط روی Interface لازم Bind شود.
- CORS باز و بدون Authentication برای Admin API پذیرفته نیست.
- شناسه User از Header/Cookie به‌تنهایی Authentication محسوب نمی‌شود.
- Admin Endpoint باید Authorization صریح داشته باشد.
- Pathها Canonicalize و Validate شوند.
- Model Download با Hash Verification انجام شود.
- Pluginها Permission حداقلی داشته باشند.
- Logها اطلاعات حساس را Redact کنند.
- Credentialها در Secret Store مناسب باشند.

## 6.4. Testing

برای هر گروه قابلیت:

- Unit Test؛
- Integration Test؛
- Golden Data Test؛
- Regression Test؛
- Performance Test؛
- Error/Failure Test؛
- Persistence Round-trip؛
- UI Interaction Test.

داده‌های تست باید از نظر License، Privacy و امکان انتشار/قرار دادن در Repository بررسی شوند. تصاویر واقعی بیمار بدون مجوز نباید وارد Git شوند.

---

# بخش هفتم — Backlog اجرایی اولویت‌بندی‌شده

## 7.1. P0 — پیش‌نیازهای اعتمادپذیری و هسته محصول

| ID | Task | وضعیت اولیه | خروجی قابل تحویل | وابستگی |
|---|---|---|---|---|
| `WSI-NATIVE-001` | Native WSI Reader و Native Region Read | PARTIAL | OpenSlide/Reader Adapter با Pyramid واقعی | ندارد |
| `IMG-INGEST-001` | Scientific Import Pipeline واقعی | PARTIAL | Import چندنوع داده و Metadata صحیح | WSI/IO |
| `CAL-001` | Calibration Truthfulness | PARTIAL | Unknown/Verified/Manual Calibration و واحد صحیح | IMG-INGEST |
| `IMG-PIXEL-001` | Typed Pixel Processing | PARTIAL | پشتیبانی معتبر Pixel Type در عملیات ضروری | IMG-INGEST |
| `PROJECT-ART-001` | Artifact Store و Project Persistence | PARTIAL | ذخیره/بازیابی نتایج، Mask، Table و Provenance | PROJECT |
| `SEC-LOCAL-001` | Local Service/Auth Audit | NEEDS_VALIDATION | Bind محدود، AuthZ، CORS و Admin Protection | ندارد |
| `WSI-TEST-001` | WSI Reference Test Suite | NOT_IMPLEMENTED/NOT_EVIDENCED | Golden/Integration tests | WSI-NATIVE |

### معیار پایان P0

- اسلاید Pyramid واقعی بدون Decode کامل قابل مشاهده باشد.
- Calibration بدون Metadata جعل نشود.
- Measurement فیزیکی فقط با Calibration معتبر انجام شود.
- Pixel Typeهای پشتیبانی‌شده در Import، Processing و Export سازگار باشند.
- Project بعد از Restart دقیقاً Artifactها و تنظیمات خود را بازیابی کند.
- دسترسی سرویس محلی به شکل امن محدود باشد.

## 7.2. P1 — قابلیت‌های اصلی Digital Pathology و Quantitative Imaging

| ID | Task | وضعیت اولیه | خروجی قابل تحویل | وابستگی |
|---|---|---|---|---|
| `VIEW-LAYER-001` | Multi-layer Viewer | PARTIAL | Image/Labels/Shapes/Points/Heatmap layers | IMG-INGEST |
| `VIEW-ND-001` | C/Z/T Viewer | PARTIAL | Channel/Z/Time Navigation | IMG-INGEST |
| `VIEW-COMPARE-001` | Compare Viewer | NOT_EVIDENCED | Sync/Swipe/Flicker/Difference | Registration |
| `ANALYZE-PARTICLES-001` | Analyze Particles | PARTIAL/NOT_EVIDENCED | Object Table + Summary + Filters | IMG-PIXEL |
| `ROI-INTENSITY-001` | ROI Pixel Statistics | PARTIAL | Per-channel ROI Intensity/Histogram | IMG-PIXEL |
| `PATH-TISSUE-001` | Adaptive Tissue Detection | PARTIAL | Tissue Mask مقاوم و قابل تنظیم | WSI/IMG |
| `PATH-QC-001` | Slide Quality Control | NOT_EVIDENCED | QC Score + Artifact Maps | WSI |
| `PATH-EXCLUDE-001` | Exclusion Regions | PARTIAL/NOT_EVIDENCED | Ignore masks برای تمام Analysisها | ROI |
| `CELL-PIPE-001` | Cell/Nuclei E2E Pipeline | PARTIAL | Detection→Segmentation→Measurements | AI |
| `CELL-CLASS-001` | Object/Cell Classifier | PARTIAL | Train/Validate/Apply/Export | CELL-PIPE |
| `IHC-HSCORE-001` | IHC H-score | NOT_EVIDENCED | Intensity classes + H-score + report | IHC |
| `AI-REGISTRY-001` | Model Registry | PARTIAL | Manifest/Hash/Version/Load/Unload | AI |
| `AI-WSI-001` | Tiled WSI Inference | PARTIAL | Seam merge + Global IDs + Resume | WSI/AI |
| `AI-EVAL-001` | Model Evaluation Studio | NOT_EVIDENCED | Metrics/Confusion/ROC/PR/Dice/AP | AI |
| `COHORT-001` | Cohort Batch Analysis | PARTIAL | Multi-slide quantitative table/charts | Project/Jobs |
| `WORKFLOW-DAG-001` | Executable Workflow Graph | PARTIAL | DAG/Node/Edge/Retry/Resume | Jobs |
| `PROV-001` | Reproducibility Graph | PARTIAL | Input→Process→Output provenance | Project |
| `REPORT-001` | Scientific Report Builder | PARTIAL | Methods/Tables/Figures/Manifest | Project |
| `INTEROP-ROI-001` | ROI Format Interoperability | PARTIAL | QuPath/ASAP/ImageJ/OME tests | ROI |

## 7.3. P2 — قابلیت‌های متمایزکننده و تخصصی

| ID | Task | خروجی قابل تحویل |
|---|---|---|
| `TMA-001` | TMA Grid/Core Workflow | Grid، Missing Cores، Per-Core Result |
| `IHC-MULTIPLEX-001` | Multiplex IF Analysis | Channels، Phenotype Rules، Per-cell Matrix |
| `PATH-COMPARTMENT-001` | Tissue Compartment Classification | Tumor/Stroma/Necrosis و Maskها |
| `SPATIAL-ADV-001` | Advanced Spatial Statistics | Nearest-neighbor، KNN، Ripley و Graph |
| `AI-ACTIVE-001` | Human-in-the-loop Active Learning | Review، Correction، Retraining |
| `AI-EXPLAIN-001` | Uncertainty/Explainability | Uncertainty Map و Model Cards |
| `AUTO-SCRIPT-001` | Macro Recorder/Script Console | Scriptable API و Headless Batch |
| `PLUGIN-SDK-001` | Plugin SDK | Manifest، API و Permission |
| `REPORT-FIGURE-001` | Publication Figure Composer | Panel/ScaleBar/Legend/Export |
| `COLLAB-REVIEW-001` | Annotation Review | Review، Comment، Consensus |
| `PROJECT-RECOVERY-001` | Crash Recovery | Snapshots، Restore و Integrity |
| `VIEW-MEASUREMAP-001` | Measurement Map | Feature-colored object overlay |

## 7.4. P3 — اکوسیستم و Interoperability پیشرفته

| ID | Task | خروجی قابل تحویل |
|---|---|---|
| `IO-OMEZARR-001` | OME-Zarr NGFF | Read/Write + Labels + Multiscales |
| `IO-OMETIFF-001` | OME-TIFF/BigTIFF | Pixel + Metadata + Round-trip |
| `OMERO-CONNECT-001` | OMERO Connector | Browse/Import/Export/Permissions |
| `DICOM-WSI-001` | DICOM WSI | Import و Metadata |
| `DICOM-SEGSR-001` | DICOM SEG/SR | Export Mask و Structured Result |
| `PLUGIN-EXT-001` | Extension Marketplace/Manager | Install/Update/Disable امن |
| `3D-MICRO-001` | True 3D Microscopy Viewer | Voxel Volume، MIP، Orthogonal Views |
| `TEAM-SYNC-001` | Team Project Sync | Conflict Resolution و Access Control |

---

# بخش هشتم — پروتکل اجرای Agent

## 8.1. قبل از هر Task

Agent باید یک جدول وضعیت به‌روز بسازد:

| ID | Current Status | Evidence | Missing Work | Tests |
|---|---|---|---|---|

هیچ Task نباید فقط با جست‌وجوی نام فایل Done شود.

## 8.2. طراحی قبل از کدنویسی

برای Taskهای دارای معماری جدید:

1. ورودی/خروجی را تعریف کن؛
2. Data Model را مشخص کن؛
3. Boundary بین Frontend، Tauri Command و Rust Service را روشن کن؛
4. خطاها و Cancellation را تعریف کن؛
5. Persistence و Provenance را مشخص کن؛
6. Test Strategy را پیش از پیاده‌سازی بنویس؛
7. سپس کد بزن.

## 8.3. معیار اتمام

Task فقط وقتی `DONE` است که:

- مسیر واقعی End-to-End دارد؛
- UI به Backend واقعی وصل است؛
- Data/State بعد از Restart در صورت نیاز باقی می‌ماند؛
- Errors و Edge Cases مدیریت می‌شوند؛
- Unit/Integration Tests پاس می‌شوند؛
- Build پاس می‌شود؛
- هیچ Mock یا Hardcoded Success در مسیر Production نمانده است؛
- Documentation و Help به‌روزرسانی شده‌اند؛
- Limitations دقیقاً ثبت شده‌اند.

## 8.4. اجرای خودکار

- Milestoneها را به ترتیب P0، P1، P2 و P3 اجرا کن.
- پس از اتمام یک Milestone متوقف نشو.
- برای تصمیم‌های مهندسی معمول از کاربر اجازه نگیر.
- برای عملیات مخرب، حذف داده، بازنویسی تاریخچه Git، Push اجباری یا افشای اطلاعات اقدام نکن.
- برای وابستگی بیرونیِ غیرقابل دسترس، Mock نگذار؛ Adapter و تست محلی را آماده کن و Blocker را مستند کن.
- هنگام محدودیت Context یا زمان، وضعیت پایدار و گزارش کامل بساز؛ کار ناتمام را Done اعلام نکن.

---

# بخش نهم — Definition of Product Excellence

TissueAI زمانی به یک Workstation رقابتی تبدیل می‌شود که مجموعه زیر در کنار هم وجود داشته باشند، نه اینکه تنها چند مورد از آن‌ها به شکل جداگانه کار کنند:

1. Native multi-vendor WSI و Image I/O؛
2. Scientific N-dimensional Data Model؛
3. Multi-layer Viewer با عملکرد بالا؛
4. Calibration و Measurement دقیق؛
5. ROI و Annotation قابل تبادل؛
6. Tissue Detection و QC؛
7. Cell/Nuclei Detection و Classification؛
8. Pixel Classification و Object Classification؛
9. IHC/Multiplex Analysis؛
10. TMA Workflow؛
11. Cohort-level Quantification؛
12. Model Registry و AI Evaluation؛
13. Workflow Graph و Scripting؛
14. Project Persistence و Provenance؛
15. Scientific Reporting؛
16. OME/QuPath/ImageJ/OMERO Interoperability؛
17. تست‌های علمی و Benchmarkهای قابل تکرار؛
18. Security و Data Integrity.

**مزیت رقابتی پیشنهادی TissueAI:** یکپارچه‌سازی کار علمی از مشاهده اسلاید تا QC، Annotation، AI، اندازه‌گیری، تحلیل گروهی و گزارش بازتولیدپذیر در یک Desktop Workstation سریع و قابل توسعه.

---

# بخش دهم — منابع رسمی و مستندات مرجع

## منابع TissueAI

- Repository: https://github.com/amirrezamortazavifard/TissueAI
- Current feature specification: https://github.com/amirrezamortazavifard/TissueAI/blob/main/options.md
- Backend module registration: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/lib.rs
- WSI Reader: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/wsi/reader.rs
- Scientific Image: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/scientific_image.rs
- Image Processing: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/image_processing.rs
- Histology: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/histology.rs
- ROI Measurement: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/measurement.rs
- ROI Manager: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/manager.rs
- AI Segmentation: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/ai_segmentation.rs
- Detection: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/detection.rs
- Multi-slide: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/multi_slide.rs
- Project: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/project/mod.rs
- Jobs: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/jobs/mod.rs
- Workflow: https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/workflow.rs

## QuPath

- Documentation: https://qupath.readthedocs.io/en/stable/
- Pixel Classification: https://qupath.readthedocs.io/en/stable/docs/tutorials/pixel_classification.html
- Cell Classification: https://qupath.readthedocs.io/en/stable/docs/tutorials/cell_classification.html
- Command Reference: https://qupath.readthedocs.io/en/stable/docs/reference/commands.html

## ImageJ / Fiji

- Analyze Menu: https://imagej.net/ij/docs/menus/analyze.html
- ImageJ: https://imagej.net/ij/
- Fiji: https://fiji.sc/

## napari

- Documentation: https://napari.org/stable/
- GitHub: https://github.com/napari/napari

## OMERO

- Documentation: https://omero.readthedocs.io/en/stable/
- Group Permissions: https://omero.readthedocs.io/en/stable/sysadmins/server-permissions.html

## Orbit

- Official Website: https://www.orbit.bio/
- Documentation: https://www.orbit.bio/documentation/

## ASAP

- GitHub: https://github.com/computationalpathologygroup/ASAP

## OME-NGFF / OME-Zarr

- Specification Index: https://ngff.openmicroscopy.org/specifications/index.html
- Open Microscopy Environment: https://www.openmicroscopy.org/

---

# Final Directive to Antigravity

این سند را به‌عنوان **Competitive Feature Gap Backlog** در کنار `AGENT.md` و نقشه‌راه‌های قبلی بخوان. هدف، تکرار کارهای انجام‌شده نیست؛ هدف بستن فاصله واقعی TissueAI با ابزارهای تخصصی مرجع است.

ابتدا وضعیت هر Task را با شواهد کد و تست تعیین کن. سپس Taskهای ناقص را با اولویت P0 تا P3 اجرا کن. قابلیت‌های موجود را بازنویسی نکن مگر اینکه تست یا بررسی نشان دهد ناقص، نادرست یا غیرقابل استفاده‌اند. در پایان، برای هر Task وضعیت `DONE`، `PARTIAL`، `BLOCKED` یا `NOT_STARTED` و مدرک تست ارائه کن.

**هیچ نتیجه‌ای را فقط به دلیل وجود یک فایل، ماژول، Command یا UI کنترل Done اعلام نکن. معیار نهایی، اجرای End-to-End، صحت علمی، پایداری داده، تست و قابلیت استفاده واقعی است.**
