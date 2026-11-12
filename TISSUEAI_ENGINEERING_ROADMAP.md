# TissueAI — Engineering Master Roadmap & Implementation Specification

**نوع سند:** سند مادر مهندسی، معماری، محصول و برنامه اجرایی  
**مخاطب اصلی:** Antigravity و سایر AI Coding Agents  
**نام محصول:** TissueAI  
**مخزن:** https://github.com/amirrezamortazavifard/TissueAI  
**شاخه مرجع:** `main` (مگر آنکه مالک پروژه خلاف آن را مشخص کند)  
**وضعیت سند:** مشخصات هدف و برنامه اجرایی؛ نه ادعای تکمیل قابلیت‌ها  
**زبان رابط نرم‌افزار:** انگلیسی  
**دامنه محصول:** Computational Histology، Digital Pathology، Scientific Image Analysis و AI-assisted Research Workflows  

---

# بخش صفر — دستورالعمل الزام‌آور برای Agent

این سند باید در ابتدای هر نشست توسعه‌ای که به TissueAI مربوط است، به‌طور کامل خوانده شود. هدف، اجرای مرحله‌ای و قابل‌راستی‌آزمایی برنامه است؛ نه بازنویسی یک‌باره کل پروژه.

## 0.1. مأموریت Agent

تو مسئول توسعه مهندسی TissueAI هستی. باید کد موجود را حفظ و تکمیل کنی و آن را به یک نرم‌افزار دسکتاپ پژوهشی برای مشاهده، مدیریت، پردازش و تحلیل تصاویر میکروسکوپی و بافت‌شناسی تبدیل کنی.

TissueAI باید در بلندمدت ترکیبی از نقاط قوت این محصولات باشد:

- **Fiji / ImageJ:** ابزارهای متنوع پردازش و اندازه‌گیری تصویر، قابلیت Automation و افزونه‌پذیری.
- **QuPath:** گردش کار پاتولوژی دیجیتال، مشاهده WSI، Annotation، Detection، Classification و تحلیل بافت.
- **napari:** معماری Layer-based و مشاهده داده‌های چندبعدی.
- **OMERO:** الگوهای مدیریت Dataset، Metadata و یکپارچه‌سازی داده‌های میکروسکوپی.

این پروژه نباید به کپی سطحی رابط یا فهرست قابلیت‌های محصولات فوق تبدیل شود. هر قابلیت باید در معماری موجود TissueAI به شکل منسجم، تست‌پذیر و قابل‌نگهداری پیاده‌سازی شود.

## 0.2. قواعد غیرقابل‌مذاکره

1. **ابتدا کد موجود را بررسی کن.** پیش از ایجاد یا تغییر هر ماژول، ساختار واقعی مخزن، پیاده‌سازی فعلی، قراردادهای IPC، مدل داده و تست‌های موجود را بررسی کن.
2. **هیچ قابلیتی را فقط نمایشی پیاده‌سازی نکن.** داده ساختگی، `Math.random()`، Mock دائمی، دکمه بدون عملکرد، Placeholder یا خروجی ثابت نباید به‌عنوان قابلیت کامل تحویل داده شود.
3. **منطق علمی را در Frontend پیاده‌سازی نکن.** UI باید نمایش، تعامل و مدیریت وضعیت را انجام دهد. منطق علمی باید در Domain/Application Services و Backend مناسب قرار بگیرد.
4. **Tauri Commands باید نازک بمانند.** Commandها ورودی را اعتبارسنجی کنند، سرویس مناسب را صدا بزنند و نتیجه یا خطای تایپ‌شده برگردانند؛ الگوریتم علمی و منطق دامنه در Command نوشته نشود.
5. **داده اصلی را تخریب نکن.** عملیات پردازش تصویر باید تا حد امکان Non-destructive باشد. Original Asset باید از Derived Asset و Result جدا بماند.
6. **هیچ Calibration ساختگی نساز.** مقادیر MPP، Magnification، Pixel Size، Physical Area و Scale نباید بدون Metadata معتبر یا تأیید صریح کاربر فرض شوند.
7. **هیچ ادعای پشتیبانی فرمت بر اساس پسوند فایل نداشته باش.** پشتیبانی واقعی یعنی Decoder بتواند Metadata، ابعاد، Tile/Plane و داده معتبر را بخواند و آزمون شود.
8. **عملیات سنگین باید Job باشند.** Inference، Batch، WSI Tile Processing، Registration و پردازش‌های طولانی باید Progress، Cancellation، Error و وضعیت قابل‌ردیابی داشته باشند.
9. **همه قابلیت‌ها باید تست داشته باشند.** حداقل Unit Test و در موارد لازم Integration، Golden Image، Regression و Performance Test اضافه کن.
10. **از تغییرات بی‌ارتباط خودداری کن.** هر Commit یا مرحله توسعه باید دامنه مشخص و محدود داشته باشد.
11. **پیش از تغییر ساختار، سازگاری نسخه و Migration را بررسی کن.** تغییر Schema یا فایل‌های ذخیره‌شده نباید پروژه‌های قبلی را خراب کند.
12. **از نسخه‌های سازگار و مجوزها مطمئن شو.** پیش از افزودن Dependency، نسخه، وضعیت نگهداری، پشتیبانی سیستم‌عامل، مجوز نرم‌افزاری، حجم بسته و روش توزیع را بررسی کن.
13. **UI کاملاً انگلیسی باشد.** تمام متن‌های داخل نرم‌افزار، نام دکمه‌ها، پیام‌ها، Tooltipها، Logهای کاربرمحور و خطاها به انگلیسی حرفه‌ای باشند. مکالمه با مالک پروژه می‌تواند فارسی باشد.
14. **حالت روشن و تاریک باید هم‌ارز باشند.** هیچ صفحه، Dialog، نمودار، فرم یا Overlay نباید فقط در یک Theme درست کار کند.
15. **قابلیت‌های علمی را با دقت و واحد گزارش کن.** اگر Calibration نامعلوم است، خروجی را در واحد Pixel گزارش کن و مقدار فیزیکی جعلی نساز.
16. **اطلاعات محرمانه را وارد Git نکن.** کلیدها، Tokenها، فایل پیکربندی واقعی، داده بیماران، تصاویر محرمانه، دیتابیس کاربر، Cache، Binary و فایل‌های محلی Agent نباید Commit شوند.
17. **وضعیت Visibility مخزن را تغییر نده.** Public یا Private بودن مخزن فقط با دستور روشن مالک پروژه تغییر می‌کند. عمومی بودن فعلی مخزن برای بررسی، مجوز انتشار داده خصوصی یا فایل محرمانه نیست.
18. **قواعد AGENT.md / AGENTS.md موجود را بخوان و رعایت کن.** اگر میان این سند و دستورالعمل معتبر مخزن تعارض وجود داشت، تعارض را گزارش کن و بدون تصمیم مالک، قانون موجود را بی‌صدا نقض نکن.
19. **در PowerShell از `;` برای اجرای ترتیبی استفاده کن.** فرض نکن `&&` در محیط PowerShell کار می‌کند.
20. **قبل از پایان هر مرحله Git را بررسی کن.** `git status --short`، فهرست فایل‌های تغییرکرده و نتیجه تست‌ها را بررسی کن. از `git add .` کورکورانه استفاده نکن.

## 0.3. پروتکل شروع هر نشست

در ابتدای هر نشست این کارها را انجام بده:

1. `pwd` و مسیر واقعی Root مخزن را مشخص کن.
2. `git status --short` و `git branch --show-current` را اجرا کن.
3. `git remote -v` را برای اطمینان از مقصد Remote بررسی کن.
4. فایل‌های `AGENT.md`، `AGENTS.md` و دستورالعمل‌های محلی/والد را بخوان.
5. `package.json`، فایل‌های Tauri، `Cargo.toml`، ساختار `src/` و `src-tauri/` را بررسی کن.
6. تست‌ها، Workflowهای CI و فایل‌های مستندات را پیدا کن.
7. نسخه، مسیر اجرای برنامه و فرمان‌های Build/Test واقعی را یادداشت کن.
8. وضعیت واقعی قابلیت موردنظر را در کد تأیید کن؛ به نام فایل یا مستندات قدیمی اکتفا نکن.
9. یک برنامه کوتاه برای همان مرحله بساز و فقط پس از آن کدنویسی را شروع کن.

## 0.4. پروتکل اجرای هر قابلیت

برای هر قابلیت:

1. رفتار فعلی را مشخص کن.
2. قرارداد ورودی/خروجی را طراحی کن.
3. تغییرات Domain، Application، Infrastructure، IPC و UI را تفکیک کن.
4. تست واحد و تست یکپارچه مناسب را قبل یا هم‌زمان با پیاده‌سازی اضافه کن.
5. قابلیت واقعی را پیاده‌سازی کن؛ نه فقط UI یا Stub.
6. خطاها، Edge Caseها و Cancellation را مدیریت کن.
7. Build و Testهای مرتبط را اجرا کن.
8. نتیجه و فایل‌های تغییرکرده را گزارش کن.
9. کار را فقط وقتی Done علامت بزن که معیارهای پذیرش همان Task پاس شده باشند.

## 0.5. تعریف وضعیت Task

- `NOT STARTED`: هنوز شروع نشده است.
- `INVESTIGATING`: در حال بررسی کد و طراحی قراردادها است.
- `IN PROGRESS`: پیاده‌سازی آغاز شده است.
- `BLOCKED`: وابستگی، تصمیم مالک، مجوز، ابزار یا داده موردنیاز موجود نیست.
- `IMPLEMENTED`: کد نوشته شده، اما تست/پذیرش کامل نشده است.
- `VERIFIED`: تمام Acceptance Criteria و تست‌های مرتبط پاس شده‌اند.

هرگز Task را صرفاً به دلیل وجود یک فایل، یک صفحه UI، یک Command یا یک Struct، `VERIFIED` اعلام نکن.

---

# بخش یک — تعریف محصول و مرزهای دامنه

## 1.1. تعریف رسمی محصول

**TissueAI یک Research-oriented Computational Histology and Digital Pathology Workstation است** که امکان مشاهده تصاویر میکروسکوپی و Whole Slide، مدیریت پروژه و Dataset، پردازش علمی تصویر، Annotation و Measurement، تحلیل بافت و استفاده از مدل‌های هوش مصنوعی را در یک محیط دسکتاپ یکپارچه فراهم می‌کند.

## 1.2. گروه‌های کاربری

1. **Histology / Pathology Researcher:** مشاهده بافت، Annotation، تحلیل سلول و اندازه‌گیری.
2. **Microscopy Researcher:** کار با تصاویر چندکاناله، Z-Stack، Fluorescence و تصاویر چندبعدی.
3. **AI Researcher:** اجرای مدل‌ها، ارزیابی، مقایسه و مدیریت مدل.
4. **Medical / Biomedical Student:** مشاهده آموزشی و انجام تحلیل کنترل‌شده.
5. **Computational Researcher:** ساخت Pipeline، پردازش Batch و استخراج داده.

## 1.3. مرز ادعاهای محصول

- در نسخه‌های اولیه محصول باید به‌عنوان ابزار پژوهشی و آموزشی معرفی شود.
- خروجی مدل AI نباید بدون اعتبارسنجی بالینی، به‌عنوان تشخیص قطعی بیماری یا توصیه درمانی عرضه شود.
- در UI، گزارش‌ها و README از ادعاهای اثبات‌نشده مانند Clinical-grade، FDA-cleared، Diagnostic-grade یا Validated Diagnosis استفاده نکن.
- خروجی AI باید با برچسب Research Prediction، Model Output یا Experimental Result مشخص شود؛ مگر آنکه در آینده شواهد و مجوزهای لازم برای ادعای قوی‌تر وجود داشته باشد.

## 1.4. چهار ستون اصلی محصول

### Explore

- بازکردن تصاویر Raster، Microscopy و WSI.
- مشاهده Pyramid و Multi-resolution.
- جابه‌جایی و Zoom روان.
- مشاهده Metadata، Channels، Z و T.
- مدیریت Layerها و Viewport.

### Process

- فیلترها و تبدیل‌های تصویر.
- تنظیمات شدت و رنگ.
- Thresholding و Morphology.
- عملیات Stack و Channel.
- پردازش Tile-based و Batch.

### Analyze

- ROI و Annotation.
- Measurement و Morphometry.
- Tissue Detection.
- Nuclei / Cell Detection و Segmentation.
- Classification، Spatial Analysis و Heatmap.

### Automate

- Job Queue.
- Workflow Graph.
- Batch Processing.
- AI Model Registry و Inference.
- Script / Plugin API در مراحل بعد.
- Export و گزارش قابل‌بازتولید.

---

# بخش دو — مبنای فعلی و یافته‌های اولیه ممیزی

**هشدار مهم:** موارد این بخش بر اساس بررسی استاتیک نسخه‌ای از مخزن در زمان ممیزی تهیه شده‌اند. Agent باید همه آن‌ها را در Checkout فعلی دوباره تأیید کند. ممکن است مالک پروژه یا Commitهای جدید وضعیت را تغییر داده باشند. این بخش را به‌عنوان فهرست فرضیه‌های قابل‌راستی‌آزمایی بخوان، نه دستور حذف یا بازنویسی کورکورانه.

## 2.1. فناوری‌های مشاهده‌شده

- Frontend: React، TypeScript و Vite.
- Desktop Runtime: Tauri 2.
- Backend: Rust.
- AI / ML: وابستگی‌ها و مسیرهایی برای ONNX Runtime و Burn مشاهده شده‌اند.
- UI: Titlebar سفارشی، Bottom Dock، Theme و افکت‌های بصری.
- Backend Modules: حوزه‌هایی برای WSI، ROI، Image Processing، AI Segmentation، Registration، Spatial Analysis، Skeleton Analysis و Workflow.

Agent باید نسخه‌های واقعی و Dependency Graph فعلی را از فایل‌های Manifest استخراج کند.

## 2.2. یافته‌های فنی که باید دوباره بررسی شوند

### FIND-001 — WSI Pyramid مصنوعی

در پیاده‌سازی بررسی‌شده، Reader با `image::load` تصویر کامل را Decode می‌کرد و سطوح کوچک‌تر را با Downsample تولید می‌کرد. این روش معادل خواندن Pyramid اصلی یک فایل WSI نیست.

**اقدام لازم:** مسیر کامل Open/Read/Tile را در نسخه فعلی Trace کن. اگر همچنان تصویر کامل در حافظه Decode می‌شود، آن را به معماری واقعی Tile/Pyramid تبدیل کن.

### FIND-002 — Calibration و Magnification پیش‌فرض

در نسخه بررسی‌شده، مقادیری مانند `0.25 µm/pixel` و `40x` به‌صورت ثابت در مسیر خواندن ثبت می‌شدند.

**اقدام لازم:** منبع Calibration را از Metadata استخراج کن. مقدار ناموجود باید Unknown بماند. امکان ثبت Calibration دستی با منشأ Manual و تأیید کاربر فراهم شود.

### FIND-003 — محدودیت Pixel Type در Processing

بعضی عملیات پردازش برای U8 و RGB محدود بودند؛ در حالی که مدل Pixel Type انواع بیشتری را معرفی می‌کرد. همچنین یک ناسازگاری درباره تعریف I16 و بافر متناظر آن گزارش شده بود.

**اقدام لازم:** تمام مسیرهای Decode، Storage، Processing، Serialization و Export را با هم بررسی کن تا هر Pixel Type واقعاً پشتیبانی‌شده End-to-End باشد.

### FIND-004 — ROI Persistence

مدیریت ROI در نسخه بررسی‌شده متکی به ساختار حافظه‌ای HashMap/Mutex بود و ذخیره‌سازی پایدار کامل پروژه و Annotation باید تأیید شود.

**اقدام لازم:** بررسی کن آیا ROI بعد از بستن برنامه و بازکردن پروژه باقی می‌ماند. اگر خیر، Persistence، Migration و Undo/Redo را پیاده‌سازی کن.

### FIND-005 — Calibration داخل Measurement

گزارش شده بود که ROI هنگام ایجاد به Calibration معتبر متصل نمی‌شود و Measurement ممکن است بر پایه داده پیش‌فرض محاسبه شود.

**اقدام لازم:** مسیر Coordinate → Pixel Measurement → Physical Measurement را Trace و با داده مرجع آزمون کن.

### FIND-006 — Telemetry ساختگی

در داشبورد بررسی‌شده مقادیری مانند CPU، RAM و GPU با `Math.random()` تولید می‌شدند.

**اقدام لازم:** اگر هنوز وجود دارد، حذف کن و Telemetry واقعی یا وضعیت `Unavailable` نمایش بده.

### FIND-007 — WSI Tile به شکل Data URL

مسیر فعلی Tile ظاهراً از Data URL مبتنی بر Base64 استفاده می‌کرد.

**اقدام لازم:** آن را Benchmark کن؛ در صورت ایجاد سربار، انتقال باینری/Asset Protocol را با API مناسب Tauri بررسی کن. صرفاً به دلیل ترجیح معماری، بدون Benchmark آن را تغییر نده.

### FIND-008 — CSP و Capabilityها

در نسخه بررسی‌شده CSP غیرفعال/Null و برخی مجوزها گسترده بودند.

**اقدام لازم:** CSP و Tauri Capabilities را بررسی و به حداقل مجوز ضروری محدود کن؛ Build و عملکرد واقعی را پس از تغییر آزمایش کن.

### FIND-009 — مستندات UI قدیمی

سند طراحی قبلی درباره Sidebar صحبت می‌کرد، در حالی که ساختار UI بررسی‌شده از Bottom Dock استفاده می‌کرد.

**اقدام لازم:** مستندات را با کد همگام کن. هیچ سند قدیمی نباید مبنای بازنویسی UI باشد، مگر آنکه مالک آن را تأیید کند.

### FIND-010 — README و Quality Gates

README در بررسی قبلی هنوز محتوای پیش‌فرض/کم‌جزئیات قالب Tauri را داشت. وجود اسکریپت‌های صریح Test و Lint نیز باید بررسی شود.

**اقدام لازم:** مستندات واقعی محصول و CI را تکمیل کن. فقط Workflowهایی را اضافه کن که در محیط پروژه قابل‌اجرا و نگهداری باشند.

---

# بخش سه — معماری هدف

## 3.1. اصول معماری

1. Separation of Concerns.
2. Domain Logic مستقل از Tauri و React.
3. Reader و Writerهای قابل‌تعویض.
4. Typed Interfaces و Error Contracts.
5. Non-destructive Processing.
6. Asynchronous Job Execution.
7. Persistent Project State.
8. Reproducibility و Provenance.
9. Resource-aware Processing.
10. Testability و Observability.

## 3.2. لایه‌های هدف

### A. Presentation Layer

مسئول:

- Workspace و Navigation.
- Viewer و Layer Rendering.
- Tool Interaction.
- Dialogs و Inspector.
- Job / Progress Presentation.
- State مربوط به رابط.

ممنوع:

- الگوریتم علمی سنگین.
- Calibration و Measurement مرجع در TypeScript.
- دسترسی مستقیم و پراکنده به دیتابیس.
- خواندن فایل بزرگ در Main Thread.
- نگهداری نسخه جداگانه و ناسازگار از حقیقت علمی.

### B. Tauri / IPC Boundary

مسئول:

- دریافت درخواست تایپ‌شده.
- اعتبارسنجی ورودی.
- بررسی Permission و Scope.
- فراخوانی Application Service.
- برگرداندن DTO یا Job ID.
- ارسال Eventهای Progress.

Commandها نباید خودشان عملیات سنگین یا منطق دامنه را اجرا کنند.

### C. Application Layer

سرویس‌های کاربردی پیشنهادی:

- `ProjectService`
- `DatasetService`
- `ImageAssetService`
- `ImageReaderService`
- `ViewerService`
- `RoiService`
- `MeasurementService`
- `ProcessingService`
- `SegmentationService`
- `ModelRegistryService`
- `InferenceService`
- `JobService`
- `WorkflowService`
- `ExportService`
- `SystemInfoService`

### D. Domain Layer

مدل‌ها و قواعد اصلی:

- Project، Dataset، Asset، ImageSeries.
- ImageDimensions، Axis، PixelType، Calibration.
- ROI، Annotation، Classification، Measurement.
- ProcessingOperation و ProcessingRun.
- ModelDescriptor و InferenceRun.
- Job، Workflow و WorkflowNode.
- Provenance و Versioned Metadata.

Domain نباید به React، Tauri Command یا جزئیات اتصال به دیتابیس وابسته باشد.

### E. Infrastructure Layer

Adapterهای قابل‌تعویض:

- OpenSlide Reader.
- Bio-Formats Reader.
- Standard Raster Reader.
- OME-TIFF Reader/Writer.
- OME-Zarr Reader/Writer.
- SQLite Project Repository.
- File-system Asset Repository.
- ONNX Runtime Adapter.
- CPU/GPU Compute Providers.
- Logging و Diagnostics.

## 3.3. ساختار پیشنهادی Backend

ساختار نهایی باید با سبک فعلی پروژه تطبیق داده شود؛ این طرح یک الگوی هدف است، نه مجوز ساخت پوشه‌های تکراری:

```text
src-tauri/src/
  app/
    services/
    dto/
    events/
  domain/
    project/
    image/
    calibration/
    roi/
    measurement/
    processing/
    ai/
    workflow/
    job/
  infrastructure/
    readers/
      openslide/
      bioformats/
      raster/
      ome/
    storage/
      sqlite/
      filesystem/
    inference/
      onnx/
    compute/
  ipc/
    commands/
    events/
  errors/
  logging/
  main.rs
```

اگر ساختار ماژول‌بندی فعلی همین تفکیک را به شکل دیگری دارد، همان را ارتقا بده و از ایجاد دو معماری موازی جلوگیری کن.

## 3.4. Frontend Structure

ساختار پیشنهادی:

```text
src/
  app/
    routing/
    providers/
    state/
  features/
    home/
    projects/
    datasets/
    viewer/
    annotations/
    processing/
    analysis/
    ai-models/
    workflows/
    jobs/
    settings/
  components/
    layout/
    dialogs/
    forms/
    feedback/
    data-display/
  services/
    ipc/
    events/
  types/
  hooks/
  styles/
```

از انتقال همه فایل‌ها به این ساختار به‌صورت یک‌باره خودداری کن. ابتدا نقشه ساختار فعلی را تهیه کن و Migration را با حفظ Build و Importها مرحله‌ای انجام بده.

## 3.5. قرارداد Frontend/Backend

- DTOهای IPC باید Versionable و صریح باشند.
- نوع داده‌های بزرگ نباید بی‌دلیل از طریق JSON و Base64 کپی شوند.
- برای عملیات طولانی، Command باید Job ID برگرداند.
- Progress از طریق Eventهای تایپ‌شده ارسال شود.
- UI باید Event Listener را هنگام Unmount پاک کند.
- Errorها باید Code، Message، Context و قابلیت نمایش امن داشته باشند.
- هیچ Stack Trace، Path حساس یا Secret نباید مستقیماً در UI کاربر نمایش داده شود.
- ورودی‌های Geometry، File Path، Model Path و Parameters در Backend دوباره اعتبارسنجی شوند.

---

# بخش چهار — مدل داده علمی و Project System

## 4.1. Project Model

Project حد بالای واحد کاری کاربر است.

حداقل فیلدهای مفهومی:

- `id`: شناسه ثابت و غیرقابل‌تغییر.
- `name`: نام قابل‌نمایش.
- `description`: توضیح اختیاری.
- `created_at`، `updated_at`.
- `schema_version`.
- `project_format_version`.
- `root_uri` یا مسیر Project.
- `settings`.
- `provenance_summary`.

قواعد:

- Rename نباید ID را عوض کند.
- Project باید قابلیت Reopen داشته باشد.
- Project باید نسخه Schema خود را نگهداری کند.
- Migration باید قبل از اعمال، Backup یا مسیر Recovery مناسب داشته باشد.
- در بازکردن Project ناسازگار، خطای واضح و قابل‌فهم نشان داده شود؛ داده خام بی‌صدا بازنویسی نشود.

## 4.2. Dataset Model

هر Project می‌تواند چند Dataset داشته باشد.

فیلدهای مفهومی:

- Dataset ID.
- Project ID.
- Name و Description.
- Category/Tags.
- Creation/Modification Time.
- Ordered Asset References.
- Optional grouping و metadata.

کارکردها:

- Create، Rename، Delete با تأیید.
- Add/Remove Assets.
- Search و Filter.
- Sort.
- Batch Selection.
- Summary از تعداد اسلاید، حجم، نوع و وضعیت پردازش.

## 4.3. ImageAsset و ImageSeries

یک فایل ورودی لزوماً معادل یک Plane یا یک Image ساده نیست. مدل باید این تفاوت را پوشش دهد.

`ImageAsset`:

- Asset ID.
- Source URI و نوع Link/Copy.
- File Name، Format، File Size.
- Content Fingerprint/Hash در صورت مناسب بودن.
- Reader ID و Reader Version.
- Import Date.
- Source Metadata.
- Import Status و Error.

`ImageSeries`:

- Series ID.
- Asset ID.
- Width و Height.
- Axes و Axis Order.
- Channels، Z، T و سایر Dimensionهای پشتیبانی‌شده.
- Pixel Type.
- Color Model.
- Pyramid/Resolution Levels.
- Calibration.
- Physical Units.

قواعد:

- Axis Order نباید بدون بررسی Metadata فرض شود.
- Channel، Z و T باید معنای مستقل داشته باشند.
- Seriesهای یک فایل باید جداگانه قابل‌شناسایی باشند.
- داده ناشناخته حذف یا با مقدار ساختگی جایگزین نشود.

## 4.4. Image Dimensions و Axis Model

ابعاد پایه:

- X: عرض.
- Y: ارتفاع.
- C: کانال.
- Z: عمق/Plane.
- T: زمان.

الزامات:

- نگهداری طول هر محور.
- نگهداری نام و واحد Axis در صورت وجود.
- مشخص‌کردن Axisهای ناشناخته یا اختصاصی.
- پشتیبانی از Axisهای اضافی در معماری آینده، بدون شکستن مدل پایه.
- امکان انتخاب Channel، Z Slice و Timepoint.

از فرض ثابت `XYCZT` برای همه فایل‌ها خودداری کن؛ ترتیب واقعی باید از Format Reader دریافت و به Canonical Axis Model تبدیل شود.

## 4.5. Pixel Types و Color Models

حداقل Pixel Typeهای هدف:

- `U8`
- `U16`
- `I8`
- `I16`
- `U32`
- `I32`
- `F32`
- `F64`

در صورت نیاز و پشتیبانی واقعی Reader، نوع‌های دیگر را اضافه کن.

الزامات:

- Enum و Typed Buffer باید کاملاً همگام باشند.
- تعداد بایت هر Pixel Type درست محاسبه شود.
- Endianness در فرمت‌هایی که لازم است مدیریت شود.
- Overflow و Underflow در عملیات عددی کنترل شود.
- NaN و Infinity در داده‌های Float تعریف رفتار داشته باشند.
- تبدیل نوع باید صریح و قابل‌ردیابی باشد.

Color Model باید از Pixel Type جدا باشد:

- Grayscale.
- RGB.
- RGBA.
- Multi-channel.
- Indexed/Palette در صورت پشتیبانی.
- Fluorescence channel data.

## 4.6. Calibration Model

Calibration باید منبع، مقدار، واحد و اطمینان داشته باشد.

فیلدهای مفهومی:

- X pixel size.
- Y pixel size.
- Z spacing (در صورت وجود).
- Time interval (در صورت وجود).
- Unit.
- Source: Metadata، User-defined، Imported یا Unknown.
- Confidence/Validation Status.
- Original Metadata Reference.
- Timestamp و Author/Actor.

قواعد حیاتی:

1. X و Y ممکن است برابر نباشند.
2. Unknown باید یک حالت واقعی باشد.
3. Magnification و MPP مفاهیم متفاوت‌اند؛ یکی را از دیگری بدون اطلاعات معتبر نتیجه نگیر.
4. Calibration دستی باید از Metadata اصلی قابل‌تشخیص باشد.
5. هر Measurement فیزیکی باید Calibration Snapshot یا Reference نسخه‌دار داشته باشد.
6. تغییر Calibration باید اثر آن بر Measurementهای موجود را شفاف کند؛ نتایج قدیمی نباید بی‌صدا با Calibration جدید بازتفسیر شوند.

## 4.7. Metadata System

Metadata را در سه سطح نگهداری کن:

1. **Raw Metadata:** همان چیزی که Reader از فایل دریافت کرده است.
2. **Normalized Metadata:** ساختار یکپارچه داخلی.
3. **User Metadata:** اطلاعات اضافه‌شده توسط کاربر.

برای هر Field، در صورت امکان Source و Original Value را حفظ کن. داده ناشناخته را حذف نکن. از ذخیره اطلاعات حساس در Log یا گزارش ناخواسته خودداری کن.

## 4.8. Project Persistence

پیشنهاد هدف:

- SQLite برای Metadata، روابط، وضعیت Project، ROI، Job History، Workflow و Indexها.
- فایل‌های اصلی و خروجی‌های حجیم در File System یا Formatهای مناسب.
- Cacheها در مسیر قابل‌بازسازی و جدا از داده اصلی.
- امکان Linked Import و Managed/Copy Import.
- امکان Relink فایل گم‌شده.
- ذخیره Atomic برای جلوگیری از Project نیمه‌نوشته.

حداقل جداول/موجودیت‌های منطقی:

- projects
- datasets
- assets
- image_series
- image_dimensions
- calibrations
- metadata_records
- roi_collections
- rois
- annotations
- annotation_classes
- measurements
- processing_runs
- derived_assets
- models
- inference_runs
- jobs
- workflows
- workflow_nodes
- workflow_edges
- provenance_events
- schema_migrations

نام‌گذاری و نوع ستون‌ها باید بر اساس استاندارد فعلی Database پروژه انجام شود؛ این فهرست یک نقشه دامنه‌ای است.

## 4.9. Migration و Recovery

- تمام Schema Changeها باید Migration شماره‌دار داشته باشند.
- Migration باید قابل‌تست باشد.
- Upgrade از حداقل نسخه‌های پشتیبانی‌شده تعریف شود.
- Backup قبل از Migration مخرب یا پرریسک ایجاد شود.
- خرابی دیتابیس باید پیام Recovery داشته باشد.
- در صورت قطع برق یا Crash، WAL/Transactionها به شکل امن مدیریت شوند.
- تست Open/Save/Close/Crash-Recovery اضافه شود.

---

# بخش پنج — WSI و Image Reader Infrastructure

**اولویت: P0 — زیرساخت حیاتی محصول**

## 5.1. هدف

TissueAI باید بتواند فایل‌های بزرگ را بدون Decode کامل در RAM مشاهده کند و در هر لحظه فقط Resolution و Tileهای موردنیاز Viewport را بخواند.

## 5.2. Reader Abstraction

یک قرارداد مرکزی مانند `ImageSource` یا Interface هم‌ارز تعریف کن.

عملیات موردنیاز:

- `open` و `close`.
- `read_metadata`.
- `read_dimensions`.
- `read_axes`.
- `read_pixel_type`.
- `read_calibration`.
- `list_resolution_levels`.
- `read_thumbnail`.
- `read_region`.
- `read_tile`.
- `read_plane` برای داده‌های چندبعدی.
- `read_channel` در صورت پشتیبانی.
- `is_remote` یا قابلیت‌های منبع، فقط اگر واقعاً پیاده‌سازی شده باشد.

هر Reader باید قابلیت‌های پشتیبانی‌شده خود را اعلام کند؛ برای مثال، همه Readerها لزوماً Tile، Multi-channel، Z/T یا Pyramid ندارند.

## 5.3. Readerهای هدف

### OpenSlide

- پشتیبانی از فرمت‌هایی که نسخه و Build مورد استفاده OpenSlide واقعاً پشتیبانی می‌کند.
- خواندن Pyramid Levelهای واقعی.
- Tile/Region Read.
- Metadata و MPP در صورت موجودبودن.
- مدیریت خطاهای فایل خراب یا Decoder.
- بستن Resourceها و جلوگیری از Handle Leak.

### Bio-Formats

- ارزیابی پوشش فرمت‌های میکروسکوپی.
- بررسی هزینه و نیازمندی Runtime/Packaging پیش از انتخاب Integration.
- حفظ Metadata و Dimensionها.
- مدیریت Stack و Channel.
- تست با فایل‌های نمونه از فرمت‌های متفاوت.

### OME-TIFF

- خواندن OME-XML و ساختارهای Pixel/Dimension.
- نگهداری Channel، Z، T و Physical Size.
- پشتیبانی از Tiled/Striped TIFF بر اساس Decoder انتخابی.
- نوشتن OME-TIFF فقط بعد از طراحی Writer و تست Round-trip.

### OME-Zarr

- معماری Chunk/Multiscale.
- خواندن Multiscale Metadata.
- مدیریت Axisها و Coordinate Transformations.
- Chunk Cache و دسترسی انتخابی.
- ابتدا Reader؛ Writer را پس از تثبیت مدل داده اجرا کن.

### Standard Raster Reader

- PNG/JPEG/BMP و فرمت‌های Raster پشتیبانی‌شده.
- تشخیص اینکه Calibration وجود ندارد.
- عدم ادعای WSI برای فایل Raster عادی.

## 5.4. پشتیبانی فرمت‌ها و Import Registry

در UI یک جدول قابلیت داخلی داشته باش که به ازای هر Reader مشخص کند:

- Extensions/Format Signatures.
- Pyramid Support.
- Tile Support.
- Multi-channel Support.
- Z/T Support.
- Calibration Support.
- Metadata Support.
- Read/Write Support.

صرف پسوند فایل ملاک کافی نیست. در صورت Ambiguous Format، محتوای فایل و Reader Probe بررسی شود.

## 5.5. Pyramid Resolver

وظایف:

- دریافت ابعاد و Downsample واقعی هر Level.
- انتخاب Level مناسب بر اساس Scale فعلی Viewer.
- جلوگیری از انتخاب Level بی‌دلیل پرهزینه.
- مدیریت Levelهای غیر یکنواخت.
- تبدیل مختصات بین Level و Level 0.
- نگهداری Transform دقیق و تست‌شده.

قواعد:

- Level 0 باید مرجع مختصات اصلی Slide باشد.
- ROI و Annotation باید در مختصات مرجع ذخیره شوند، نه مختصات موقت Tile.
- Downsample هر Level باید از Metadata یا Reader دریافت شود؛ فرض توان دو نکن.

## 5.6. Tile Request Manager

قابلیت‌ها:

- Tile Size قابل‌تنظیم یا سازگار با Reader.
- Priority براساس فاصله و ارتباط با Viewport.
- Deduplication درخواست Tile تکراری.
- Request Cancellation هنگام تغییر سریع Viewport.
- Prefetch همسایه‌ها.
- محدودیت Concurrency.
- Backpressure هنگام افزایش درخواست‌ها.
- Retry محدود و مشخص برای خطای موقت.
- جلوگیری از Cache کردن داده نامعتبر.
- تشخیص Tile مفقود و نمایش خطای موضعی.

## 5.7. Tile Cache

- Cache باید محدودیت حافظه مشخص داشته باشد.
- سیاست LRU یا سیاست مبتنی بر کارایی Benchmark‌شده انتخاب شود.
- اندازه Cache بر حسب Byte مدیریت شود، نه صرفاً تعداد Tile.
- Cache باید با Asset ID، Level، Coordinate، Channel، Z و T Key شود.
- تغییر منبع یا Hash فایل نباید Tileهای منبع قدیمی را به منبع جدید نسبت دهد.
- Cache قابل پاک‌سازی و بازسازی باشد.
- Cache در کنار Project Data اصلی قرار نگیرد، مگر با طراحی صریح.

## 5.8. Thumbnail و Overview

- Thumbnail سریع و کم‌هزینه.
- Overview Map کل اسلاید.
- مستطیل Viewport روی Overview.
- امکان کلیک برای Navigation.
- استفاده از Thumbnail Cache مستقل.
- جلوگیری از Decode دوباره در هر بار بازکردن پنل.

## 5.9. Color و Orientation

- Orientation و Rotation فایل را رعایت کن.
- Color Profile/ICC در صورت وجود حفظ شود.
- تفاوت Data Pixel و Display Transform روشن باشد.
- LUT و Brightness/Contrast نباید داده اصلی را بی‌دلیل تغییر دهند.
- در Fluorescence، Channel Rendering و Composite باید قابل‌کنترل باشد.

## 5.10. معیارهای پذیرش WSI

1. بازکردن اسلاید WSI نباید مستلزم نگهداری کل تصویر Decodeشده در RAM باشد.
2. Viewer فقط Tileهای موردنیاز را درخواست کند.
3. Zoom In/Out بین Pyramid Levelها بدون تغییر ناگهانی مختصات انجام شود.
4. Pan سریع باعث انباشته‌شدن درخواست‌های بی‌استفاده نشود.
5. Tileهای قدیمی پس از تغییر Slide روی Slide جدید ظاهر نشوند.
6. Overview Map با Viewport هماهنگ باشد.
7. MPP فقط در صورت دریافت معتبر از Metadata یا Calibration دستی نمایش داده شود.
8. Unknown MPP در UI قابل‌تشخیص باشد.
9. فایل خراب با خطای قابل‌فهم مدیریت شود؛ برنامه Crash نکند.
10. حداقل یک مجموعه تست WSI واقعی/نمونه با مجوز روشن برای آزمون موجود باشد.
11. آزمون‌های Transform بین Pyramid Level و Level 0 پاس شوند.
12. حافظه و زمان بارگذاری روی دستگاه و Dataset مرجع ثبت شوند.

---

# بخش شش — Scientific Image Engine

**اولویت: P0/P1**

## 6.1. هدف

یک موتور پردازش مستقل از UI بساز که انواع Pixel Type، داده چندکاناله و تصویر بزرگ را پشتیبانی کند. API باید قابلیت اجرای Full Image، Region و Tile را داشته باشد.

## 6.2. Operation Contract

هر Operation باید موارد زیر را تعریف کند:

- Operation ID و Version.
- Display Name.
- Input Requirements.
- Output Pixel Type/Color Model.
- Parameters و Schema.
- Parameter Validation.
- Whether it is In-place یا Out-of-place.
- Tile Compatibility.
- Halo/Border Requirements.
- Deterministic Behavior.
- Cancellation Support.
- Resource Estimate در صورت امکان.
- Provenance Output.

## 6.3. عملیات تبدیل هندسی

حداقل:

- Crop.
- Resize.
- Resample.
- Rotate 90/180/270.
- Arbitrary Rotate.
- Horizontal/Vertical Flip.
- Translate.
- Affine Transform.
- Perspective Transform در صورت نیاز.

الزامات:

- Interpolation Method صریح باشد.
- Transform Matrix ثبت شود.
- تغییر ابعاد و Calibration به شکل درست مدیریت شود.
- Resampling و Crop از هم تفکیک شوند.
- ROIها در صورت اعمال Transform، قابل‌تبدیل و قابل‌ردیابی باشند.

## 6.4. Enhancement و Intensity

- Brightness.
- Contrast.
- Gamma.
- Min/Max Display Range.
- Auto Contrast.
- Histogram.
- Histogram Equalization.
- CLAHE.
- Invert.
- Normalize.
- Intensity Window/Level.

باید بین Display Adjustment و Pixel Modification تمایز وجود داشته باشد. کاربر باید بداند کدام عملیات فقط نحوه نمایش را تغییر می‌دهد و کدام داده خروجی جدید تولید می‌کند.

## 6.5. Spatial Filters

- Mean/Average.
- Gaussian.
- Median.
- Minimum/Maximum.
- Bilateral در صورت توجیه عملکردی.
- Sharpen.
- Unsharp Mask.
- Sobel.
- Scharr.
- Laplacian.
- Canny یا Edge Detection معادل.
- Custom Convolution Kernel.

الزامات:

- Kernel و Border Mode مشخص باشد.
- NaN و Pixel Typeهای مختلف مدیریت شوند.
- در پردازش Tile، Halo متناسب با Kernel لحاظ شود تا مرز Tile نتیجه را خراب نکند.
- عملکرد Filterهای سنگین Benchmark شود.

## 6.6. Thresholding

روش‌های پایه:

- Manual Threshold.
- Otsu.
- Triangle.
- Yen.
- Li.
- Mean Threshold.
- Adaptive/Local Threshold.

الزامات:

- Histogram و Threshold Preview.
- پشتیبانی از کانال/Plane انتخاب‌شده.
- تعریف رفتار برای داده Float و Multi-channel.
- خروجی Binary Mask با Metadata مشخص.
- امکان ذخیره Parameters و Re-run.

## 6.7. Morphological Operations

- Erosion.
- Dilation.
- Opening.
- Closing.
- Morphological Gradient.
- Top Hat.
- Black Hat.
- Structuring Elementهای Rectangle، Ellipse، Cross و Custom.
- اندازه Kernel بر حسب Pixel و در صورت Calibration معتبر بر حسب واحد فیزیکی.

## 6.8. Segmentation کلاسیک

- Connected Components.
- Region Growing.
- Watershed.
- Distance Transform.
- Seeded Segmentation.
- Hole Filling.
- Small Object Removal.
- Label Map Generation.

خروجی Label Map باید شناسه هر Object را حفظ کند و به Overlay/ROI قابل‌تبدیل باشد.

## 6.9. Color Analysis

- RGB/Grayscale/HSV و در صورت نیاز CIELAB.
- Channel Split/Merge.
- Color Deconvolution برای H&E و H-DAB.
- Stain Vector Configuration.
- Color Balance و LUT.
- Multi-channel Composite.

در Color Deconvolution، پارامترهای Stain Vector، Reference و Version باید در Provenance ثبت شوند. نتیجه صرفاً به دلیل نام H&E نباید بدون بررسی رنگ/ورودی قطعی فرض شود.

## 6.10. Stack و Multidimensional Processing

- Z Projection: Mean، Maximum، Minimum، Sum و سایر روش‌های لازم.
- Channel Split/Merge.
- Plane Extraction.
- Timepoint Extraction.
- Stack Registration در صورت پشتیبانی.
- Time Series Measurement.
- Batch Operation روی محورهای منتخب.

عملیات باید مشخص کنند روی کدام Axis اجرا می‌شوند و چه Axisهایی در خروجی حفظ یا Collapse می‌شوند.

## 6.11. Tiled Processing

- Operationهای قابل اجرا روی Tile باید Interface مشخص داشته باشند.
- Kernelهای محلی باید Halo تعریف کنند.
- Operationهای Global مانند بعضی Histogramها به Pass اول/دوم نیاز دارند.
- در پایان Tileها باید Seam/Boundary Artifact آزمون شود.
- Memory Budget و Cancellation رعایت شود.

## 6.12. معیارهای پذیرش Image Engine

- عملیات روی Pixel Typeهای اعلام‌شده واقعاً اجرا شوند.
- تبدیل نوع صریح باشد.
- Golden Testهای عددی وجود داشته باشند.
- داده ورودی در پردازش Non-destructive حفظ شود.
- مرز Tile نتیجه اشتباه ایجاد نکند.
- Calibration پس از Transform با قاعده روشن به‌روزرسانی شود.
- عملیات قابل Re-run و ثبت در Processing History باشند.
- Errorها قابل‌فهم باشند و برنامه را Crash نکنند.

---

# بخش هفت — Viewer و UI/UX Workbench

**اولویت: P0 برای Viewer Core، سپس P1 برای تکمیل تجربه کاری**

## 7.1. اصل طراحی

TissueAI باید یک **Project-centric Scientific Workbench** باشد. کاربر نباید با مجموعه‌ای از ابزارهای پراکنده مواجه شود. نقطه شروع، Project و Dataset است و ابزارها در Context همان Asset فعال می‌شوند.

هویت بصری فعلی را بدون دلیل کنار نگذار. افکت‌ها، رنگ‌ها و Bottom Dock در صورتی حفظ شوند که تمرکز، خوانایی و عملکرد علمی را مختل نکنند.

## 7.2. ساختار Main Workspace

### Top Application Bar

شامل:

- Brand و نام TissueAI.
- Current Project.
- Current Dataset و Slide.
- Save/Sync State.
- Global Search یا Command Palette.
- Notifications/Job Status.
- Help و Settings.
- Window Controls.

عنوان و Breadcrumb باید Context فعلی را نشان دهند.

### Left Panel — Project Explorer

درخت پیشنهادی:

```text
Project
  Datasets
    Dataset A
      Slide 001
      Slide 002
    Dataset B
  Annotations
  Analysis Runs
  Workflows
  Models
  Reports
```

قابلیت‌ها:

- Expand/Collapse.
- Search.
- Filter.
- Sort.
- Context Menu.
- Drag-and-drop در محدوده‌های مجاز.
- Asset Status.
- Missing Source Indicator.
- Multi-select.
- تعداد فایل‌ها و نتایج.

### Center — Scientific Viewer

- Pan/Zoom.
- Tile Rendering.
- Overview Map.
- Scale Bar.
- Cursor Coordinates.
- Layer Rendering.
- Channel/Plane Controls.
- Compare Mode.
- Fullscreen/Focus Mode.

### Right Panel — Inspector

تب‌ها یا بخش‌های Contextual:

- Properties.
- Metadata.
- Channels.
- Layers.
- Annotation Details.
- Measurements.
- Classification.
- Processing Parameters.

این پنل باید بر اساس نوع انتخاب‌شده تغییر کند؛ نه آنکه تمام اطلاعات همیشه نمایش داده شوند.

### Bottom Panel — Results / Jobs / Console

قابلیت‌ها:

- Analysis Results.
- Measurement Table.
- Job Queue.
- Logs/Console برای کاربران فنی.
- Export Status.
- Error Details.

Bottom Panel باید قابل‌باز و بسته‌شدن و Resize باشد.

## 7.3. Home / Dashboard

داشبورد نباید اعداد ساختگی نمایش دهد.

بلوک‌های پیشنهادی:

- Recent Projects.
- Open Project.
- Create Project.
- Import Images.
- Recent Files.
- Active/Queued Jobs.
- Recent Analysis Runs.
- Available Model Summary.
- System Resource Status فقط در صورت دریافت واقعی.
- Documentation / Getting Started.

اگر CPU/GPU/RAM در Backend قابل‌خواندن نیست، مقدار `Unavailable` یا حذف آن بخش مجاز است؛ تولید داده تصادفی ممنوع است.

## 7.4. Navigation و Information Architecture

ماژول‌ها را در گروه‌های منطقی قرار بده:

- Workspace: Home، Projects، Viewer.
- Image: Processing، Channels، Stack.
- Analysis: ROI، Measurements، Segmentation، Spatial Analysis.
- AI: Models، Inference، Evaluation.
- Automation: Jobs، Workflows.
- Data: Import، Export، Integrations.
- Settings: Preferences، Storage، Performance، Privacy، About.

نیازی نیست همه آیتم‌ها همیشه در سطح اول Navigation باشند. قابلیت‌های پیشرفته باید Contextual و بر اساس Workflow ظاهر شوند.

## 7.5. Command Palette

میانبر پیشنهادی `Ctrl+K` یا میانبر سازگار با سیستم‌عامل.

عملیات قابل‌جست‌وجو:

- Open Project.
- Import Image.
- Open Slide.
- Fit to Screen.
- Zoom In/Out.
- Toggle Panels.
- Select Tool.
- Create ROI.
- Run Processing Operation.
- Open Model Registry.
- View Jobs.
- Save Project.

Command Palette باید نام عملیات، Category، Shortcut و Context مجاز را نشان دهد.

## 7.6. Tool Interaction

ابزارهای Viewer:

- Select.
- Pan.
- Zoom.
- Point.
- Line.
- Rectangle.
- Ellipse.
- Polygon.
- Polyline.
- Freehand/Brush.
- Measure Distance.
- Measure Angle.
- Count/Mark.

الزامات:

- انتخاب Tool مشخص و قابل‌مشاهده باشد.
- Shortcutها در Help قابل‌مشاهده باشند.
- Cursor با Tool هماهنگ شود.
- Escape عملیات جاری را Cancel کند.
- کلیک اشتباه یا Drag ناقص باعث Annotation خراب نشود.
- Toolهای Measurement و Drawing از هم قابل‌تشخیص باشند.

## 7.7. Layer Panel

حداقل Layer Typeها:

- Base Image.
- Channel Composite.
- Segmentation Mask.
- ROI/Annotation.
- Heatmap.
- Detection Points.
- Vector/Contour.
- Registration Overlay.

هر Layer:

- Visible.
- Opacity.
- Name.
- Color/LUT.
- Blend Mode در صورت پشتیبانی.
- Lock.
- Source/Provenance.
- Reorder.

Layerها باید از داده اصلی مجزا باشند و تغییر Visibility/Opacity نباید Pixel Data را تغییر دهد.

## 7.8. Compare Mode

- Side-by-side.
- Overlay/Blend.
- Checkerboard در صورت مناسب.
- Synchronized Pan/Zoom.
- Difference View برای داده سازگار.
- Registration Status.
- نمایش واضح Slide/Asset هر طرف.

قبل از محاسبه Difference، سازگاری Dimensions، Calibration و Registration بررسی شود.

## 7.9. Theme و Visual System

- Dark و Light Theme با Semantic Tokens.
- رنگ وضعیت‌ها مستقل از Theme.
- کنتراست مناسب Text و Controls.
- رنگ Annotationها قابل‌تشخیص و قابل‌تنظیم.
- Heatmap Color Scale با Legend.
- نمودارها و Tableها در هر دو Theme خوانا باشند.
- رنگ به‌تنهایی نباید تنها راه انتقال وضعیت باشد.
- انیمیشن‌ها کوتاه، محدود و قابل‌کاهش باشند.
- `prefers-reduced-motion` رعایت شود.
- `user-select: none` در کل برنامه اعمال نشود؛ فقط در نواحی‌ای که Selection متن مزاحم تعامل است.

## 7.10. Accessibility و UX

- Keyboard Navigation.
- Focus Indicator.
- Tooltip برای Iconهای مبهم.
- Label برای Form Controls.
- متن خطای واضح و Actionable.
- عدم تکیه بر Color تنها.
- اندازه هدف تعاملی مناسب.
- Zoom رابط بدون شکستن Layout.
- جدول‌ها با Keyboard قابل پیمایش باشند.
- برای عملیات طولانی Progress و Cancel موجود باشد.

## 7.11. Empty، Loading، Error و Success States

برای هر صفحه و ابزار چهار وضعیت طراحی کن:

- Empty: توضیح گام بعدی.
- Loading: Progress واقعی یا Indeterminate همراه امکان Cancel در صورت پشتیبانی.
- Error: علت و اقدام قابل‌انجام.
- Success: نتیجه و امکان مشاهده/Export.

هیچ صفحه‌ای نباید فقط یک Spinner بدون توضیح داشته باشد.

## 7.12. Design System و Component Library

- Design Tokens برای Color، Spacing، Radius، Typography، Elevation.
- Button، IconButton، Input، Select، Tabs، Tooltip، Popover، Dialog، Toast، Table، Tree، Splitter و Progress.
- Focus/Disabled/Loading/Error States.
- Semantic Tokens برای Light/Dark.
- Story/Preview Page یا تست‌های Visual در صورت سازگاری ابزارهای موجود.

---

# بخش هشت — ROI، Annotation و Measurement

**اولویت: P0 برای Persistence و Calibration، P1 برای امکانات پیشرفته**

## 8.1. ROI Geometry

انواع پایه:

- Point.
- MultiPoint.
- Line/Polyline.
- Rectangle.
- Rotated Rectangle در صورت نیاز.
- Ellipse.
- Polygon.
- Freehand Polygon.
- Mask/Label Region.

برای هر ROI:

- ID ثابت.
- Asset/Series ID.
- Coordinate Space.
- Geometry.
- Class/Label.
- Color.
- Name.
- Parent/Hierarchy.
- Created/Updated Time.
- Source/Provenance.
- Optional Lock/Visibility.

## 8.2. Coordinate System

- مختصات ذخیره‌شده باید در یک Coordinate Space مرجع و مستند باشند؛ برای WSI ترجیحاً Level 0 Pixel Coordinates.
- Tile-local Coordinates فقط برای Render یا محاسبات موضعی استفاده شوند.
- Transformهای Level/Viewport/Screen از Geometry ذخیره‌شده مستقل باشند.
- تبدیل‌ها باید برای Zoom، Pan، Rotation و Pyramid Level تست شوند.
- جهت محور Y و Origin به‌طور ثابت و مستند تعریف شود.

## 8.3. Annotation Hierarchy

قابلیت‌ها:

- Annotation Group.
- Parent/Child.
- Class Hierarchy.
- Class Color.
- Tags.
- Notes.
- Review Status.
- Lock/Visibility.
- Search/Filter.

نمونه Classهای قابل‌تنظیم توسط کاربر:

- Tumor.
- Stroma.
- Necrosis.
- Background.
- Inflammatory Region.
- Artifact.

این‌ها فقط نمونه Class هستند، نه تشخیص خودکار و نه Class ثابت اجباری.

## 8.4. Measurement Engine

### هندسی

- Length.
- Area.
- Perimeter.
- Angle.
- Bounding Box.
- Centroid.
- Feret Diameter / Max Feret.
- Min Feret.
- Circularity.
- Aspect Ratio.
- Solidity.
- Eccentricity در صورت پشتیبانی.

### شدت و رنگ

- Mean Intensity.
- Median.
- Min/Max.
- Standard Deviation.
- Integrated Density.
- Histogram Summary.
- Channel-specific Metrics.

### Object / Region

- Object Count.
- Area Fraction.
- Density.
- Nearest-neighbor Distance.
- Object Size Distribution.
- Shape Feature Distribution.

## 8.5. Measurement Provenance

هر Measurement باید شامل مواردی باشد:

- Measurement ID.
- ROI/Annotation ID.
- Asset/Series ID.
- Algorithm ID و Version.
- Parameters.
- Pixel Calibration Snapshot.
- Unit.
- Value.
- Creation Time.
- Source Processing Run.
- Validity/Warnings.

اگر Calibration ناموجود است، Unit پیکسلی باشد. اگر Calibration بعداً تغییر کرد، Measurement قدیمی باید به Calibration Snapshot سابق متصل بماند.

## 8.6. ROI Editing و History

- Create/Edit/Delete.
- Move/Resize/Rotate.
- Vertex Editing.
- Add/Remove Vertex.
- Boolean Union/Intersection/Difference در صورت پشتیبانی هندسی.
- Undo/Redo.
- Copy/Paste/Duplicate.
- Multi-select.
- Batch Reclassify.
- Import/Export.

Undo/Redo باید تغییرات Domain را ثبت کند؛ فقط Undo بصری در React کافی نیست.

## 8.7. Import/Export Annotation

- فرمت داخلی Versioned و پایدار.
- GeoJSON در صورت تعریف دقیق Coordinate Semantics.
- فرمت‌های سازگار با QuPath در محدوده مشخص و آزمون‌شده.
- CSV برای Measurementها.
- JSON برای Metadata/Results.
- نگهداری Class، ID، Geometry و Provenance.

تبدیل فرمت نباید Coordinate System یا واحد را بی‌صدا تغییر دهد.

---

# بخش نه — Digital Histology و ابزارهای تخصصی بافت

**اولویت: P1**

## 9.1. Tissue Detection

- تشخیص ناحیه بافت از Background.
- Threshold/Color-based روش پایه.
- امکان استفاده از Model در نسخه بعد.
- تولید Tissue Mask.
- Morphological Cleanup.
- حذف Regionهای بسیار کوچک با Parameter قابل‌تنظیم.
- نمایش Overlay.
- ذخیره نتیجه همراه Algorithm و Parameters.

## 9.2. Stain Processing

- H&E Color Deconvolution.
- H-DAB Color Deconvolution.
- تنظیم Stain Vectors.
- نمایش Channelهای جداشده.
- بازسازی تصویر از Channelها در صورت پشتیبانی.
- ثبت Configuration و Reference.
- هشدار در ورودی‌های نامناسب یا رنگ‌های غیرمعمول.

## 9.3. Nuclei Detection و Segmentation

Pipeline پیشنهادی:

1. انتخاب Slide/Region.
2. انتخاب Stain/Channel.
3. Tissue Mask.
4. Tile Extraction.
5. Preprocessing.
6. Model/Classical Detection.
7. Instance Separation.
8. Post-processing.
9. Object Filtering.
10. Feature Extraction.
11. Classification.
12. Overlay و Result Persistence.

خروجی باید Label Map یا Object Collection قابل‌استفاده باشد، نه صرفاً تصویر رنگی.

## 9.4. Cell-Level Analysis

- Cell/Nucleus Count.
- Nucleus Area.
- Shape Metrics.
- Intensity Features.
- Cell Density.
- Spatial Coordinates.
- Class Distribution.
- Neighborhood Features در صورت نیاز.
- Distribution Charts.
- Export به CSV/Parquet در صورت پشتیبانی زیرساخت.

## 9.5. Tissue Classification

- تعریف Class Schema توسط کاربر.
- Region Classification.
- Object Classification.
- Model-based و Rule-based روش‌ها.
- Confidence Score با توضیح معنای آن.
- امکان Review و Correct کردن نتیجه.
- ثبت مدل و نسخه و Dataset مرجع.

## 9.6. Heatmap و Overlay

- Heatmap باید Legend و Range داشته باشد.
- مقیاس رنگ قابل‌تغییر باشد.
- Opacity قابل‌کنترل باشد.
- Pixel Coordinates/Physical Coordinates روشن باشند.
- داده Heatmap از مدل و Run مشخص قابل‌ردیابی باشد.
- Empty/No Prediction با مقدار صفر اشتباه نشود.

## 9.7. Spatial Analysis

- Object Density Map.
- Nearest Neighbor.
- Distance to ROI Boundary.
- Region Proximity.
- Cell Neighborhood.
- Spatial Distribution.
- Cluster Analysis در صورت پیاده‌سازی معتبر.

روش آماری، فرض‌ها و Parameterها باید ثبت شوند. از نمایش نتیجه آماری بدون مشخص‌کردن روش محاسبه خودداری کن.

---

# بخش ده — AI Platform و Model Management

**اولویت: P2 پس از تثبیت Image/WSI/ROI Core**

## 10.1. Model Registry

هر مدل باید Descriptor استاندارد داشته باشد:

- Model ID.
- Name.
- Version.
- Task Type.
- Framework/Runtime.
- Model File URI.
- File Hash.
- License.
- Author/Source.
- Input Shape.
- Input Pixel Type.
- Input Color/Channel Requirements.
- Normalization.
- Preprocessing.
- Output Schema.
- Postprocessing.
- Class Labels.
- Threshold Defaults.
- Hardware Requirements.
- Documentation.
- Validation Dataset/Results در صورت موجودبودن.

مدل ناشناخته نباید بدون بررسی Schema و Hash اجرا شود.

## 10.2. Model Adapter Interface

یک Adapter Contract ایجاد کن تا مدل‌های متفاوت در یک Pipeline استاندارد اجرا شوند:

- Load/Unload.
- Validate Model.
- Describe Input/Output.
- Preprocess.
- Inference.
- Postprocess.
- Release Resources.
- Report Runtime and Device.

یک Adapter اختصاصی برای هر مدل یا خانواده مدل داشته باش؛ از شرط‌های پراکنده و Model-specific در تمام UI/Backend جلوگیری کن.

## 10.3. ONNX Runtime

- بررسی دقیق نسخه و Providerهای موجود.
- CPU Provider به‌عنوان مسیر پایه قابل‌اعتماد.
- GPU Provider فقط در صورت نصب و پشتیبانی واقعی.
- Runtime Capability Detection.
- Session Lifecycle.
- Memory Management.
- Thread Configuration.
- Error Handling.
- Model Hash Verification.
- No silent CPU/GPU assumption.

UI باید Device واقعی اجرای Inference را نشان دهد.

## 10.4. مدل‌های هدف

این مدل‌ها گزینه‌های توسعه هستند؛ هیچ‌کدام را بدون ارزیابی سازگاری، مجوز، Pre/Postprocessing و Benchmark به‌عنوان پشتیبانی‌شده اعلام نکن.

### StarDist

- Nuclei Instance Segmentation.
- Polygon/Star-convex Output Decoding.
- Tile Boundary Reconciliation.
- Object ID Generation.

### Cellpose

- Cell/Nucleus Segmentation.
- Channel Configuration.
- Diameter/Scale Parameters.
- Flow/Mask Output Handling.

### U-Net

- Semantic Segmentation.
- Class Probability Maps.
- Multi-class Output.
- Post-processing.

### HoVer-Net

- Nuclei Instance Segmentation.
- Nuclear Type Classification در صورت وجود Head مناسب.
- Output Maps و Watershed/Postprocessing.

### Mesmer

- ارزیابی کاربرد و ورودی مناسب برای Tissue/Cell Segmentation.
- مدیریت وابستگی‌ها و مدل.

### YOLO Segmentation

- Detection + Instance Mask.
- Box/Mask/Confidence Mapping.
- Class Mapping.

### SAM و مدل‌های سازگار با پزشکی

- Interactive Prompt-based Segmentation.
- Point/Box/Mask Prompt.
- Region/Tiling Strategy.
- کنترل مصرف VRAM/RAM.

## 10.5. Inference Pipeline

```text
Asset / Region / Tile
        ↓
Input Validation
        ↓
Preprocessing
        ↓
Tile Planner
        ↓
Model Adapter
        ↓
Inference Runtime
        ↓
Output Decoder
        ↓
Tile Stitching / Object Reconciliation
        ↓
Post-processing
        ↓
Mask / Objects / Scores
        ↓
Validation + Provenance
        ↓
Project Persistence + Viewer Layer
```

## 10.6. Tile Inference

- Tile size و overlap قابل‌تنظیم یا مبتنی بر Model Descriptor باشد.
- Edge Tileها مدیریت شوند.
- Coordinate Mapping به Level 0 صحیح باشد.
- Overlap Stitching از Duplicate یا Missing Object جلوگیری کند.
- Batch Size براساس منابع تنظیم شود.
- Cancellation در بین Tileها کار کند.
- Model Output و Tile Mapping قابل‌ردیابی باشد.

## 10.7. AI Results

خروجی باید شامل:

- Inference Run ID.
- Model ID/Version/Hash.
- Input Asset/ROI.
- Parameters.
- Device/Runtime.
- Start/End Time.
- Runtime.
- Warnings.
- Output Asset/Mask/Objects.
- Confidence Semantics.
- Provenance.

## 10.8. Model Evaluation

- Train/Validation/Test Separation را در Metadata مشخص کن.
- Confusion Matrix برای Taskهای مناسب.
- Precision، Recall، F1.
- Dice، IoU برای Segmentation.
- Object-level Metrics در صورت نیاز.
- Calibration/Confidence Evaluation در صورت نیاز.
- Per-class Metrics.
- Export Evaluation Report.

نتایج ارزیابی باید به Dataset، نسخه مدل و Configuration مشخص متصل باشند.

## 10.9. Model Download و Security

- دانلود بدون تأیید کاربر انجام نشود، مگر تنظیمات صریح وجود داشته باشد.
- Source، License، Size و Hash نمایش داده شود.
- فایل مدل قبل از Load اعتبارسنجی شود.
- فایل‌های مدل در مسیر Data/AppData نگهداری شوند، نه Installation Directory.
- خطاهای Load و Runtime به شکل امن گزارش شوند.

---

# بخش یازده — Job Engine و Resource Management

**اولویت: P0 برای عملیات سنگین**

## 11.1. Job Lifecycle

وضعیت‌های حداقل:

- Pending.
- Validating.
- Queued.
- Running.
- Cancelling.
- Completed.
- Failed.
- Cancelled.
- Paused (فقط اگر Resume واقعی پیاده‌سازی شده باشد).

## 11.2. Job Data

- Job ID.
- Job Type.
- Project ID.
- Asset IDs.
- Input References.
- Parameters.
- Status.
- Progress.
- Current Stage.
- Started/Updated/Completed Time.
- Error Code/Details.
- Cancellation Token.
- Resource Profile.
- Output References.
- Provenance ID.

## 11.3. Job Scheduler

- محدودیت Concurrency.
- اولویت Job.
- محدودیت RAM/VRAM در صورت قابل‌اندازه‌گیری.
- جلوگیری از اجرای نامحدود عملیات سنگین.
- مدیریت Jobهای وابسته.
- عدم قفل‌شدن UI.
- Cancellation واقعی و تعاونی.
- جلوگیری از اجرای دوباره Jobهای Duplicate.

## 11.4. Progress Reporting

- Progress درصدی فقط وقتی قابل‌محاسبه است.
- Stageهای توصیفی برای عملیات نامعلوم.
- UI نباید درصد جعلی یا پیشرفت خطی ساختگی نشان دهد.
- آخرین Update Time نمایش داده شود.
- Failure باید Error و Stage را مشخص کند.

## 11.5. Resource Management

- Cache Budget.
- Max Parallel Reader Operations.
- Max Inference Batch.
- CPU Thread Limits.
- GPU Memory Awareness در صورت پشتیبانی.
- Temporary File Cleanup.
- عدم حذف Cache فعال.
- رفتار مشخص هنگام کمبود حافظه.

---

# بخش دوازده — Workflow Engine و Automation

**اولویت: P2/P3**

## 12.1. Workflow Model

Workflow باید یک Graph از Nodeها و Edgeها باشد، نه صرفاً فهرستی از نام عملیات.

Node Typeهای هدف:

- Import/Read.
- Select Region.
- Preprocessing.
- Filter.
- Threshold.
- Segmentation.
- Measurement.
- Classification.
- Export.
- Report.

## 12.2. Workflow Node Contract

هر Node باید:

- Type و Version داشته باشد.
- Input Ports و Output Ports مشخص داشته باشد.
- Parameter Schema داشته باشد.
- Validation داشته باشد.
- Error Contract داشته باشد.
- قابلیت Cancellation داشته باشد.
- Resource Requirements مشخص داشته باشد.
- Output Type را تعریف کند.

## 12.3. Graph Validation

- شناسایی Cycle نامعتبر.
- بررسی اتصال Portهای سازگار.
- بررسی نوع Input/Output.
- بررسی Parameterهای ضروری.
- نمایش Nodeهای ناقص.
- تشخیص وابستگی به Model مفقود.
- پیش‌بینی خطا قبل از Run.

## 12.4. Execution

- Topological Execution.
- Parallelism فقط برای Nodeهای Independent.
- Job Engine مشترک.
- Checkpoint در صورت امکان.
- Retry با سیاست روشن.
- Cancellation.
- Resume فقط در صورت ذخیره State کافی.
- ثبت Input/Output هر Node.

## 12.5. Reproducibility

Workflow Run باید:

- Workflow Version.
- Node Versions.
- Parameters.
- Input Asset Fingerprints.
- Model Versions/Hashes.
- Runtime/Environment Info.
- Outputs.
- Timestamp.
- Error/Warning.

را ذخیره کند.

## 12.6. Workflow UI

- Node Palette.
- Canvas.
- Edge Connection.
- Inspector.
- Validation Panel.
- Run/Cancel.
- Progress.
- Run History.
- Export/Import Workflow.

از ساخت Canvas زیبا بدون Graph Validation و اجرای واقعی خودداری کن.

---

# بخش سیزده — Registration، Spatial، Skeleton و 3D

این قابلیت‌ها در اولویت بعد از تثبیت هسته داده و Viewer هستند.

## 13.1. Image Registration

- Landmark-based Registration.
- Rigid Transform.
- Affine Transform.
- Non-rigid Registration فقط با الگوریتم معتبر.
- Similarity Metrics.
- Transform Preview.
- Transform Persistence.
- Overlay Validation.
- Inverse Transform در صورت امکان.

Registration باید ورودی و خروجی، Coordinate System، Transform، Parameters و Quality Metric را ثبت کند.

## 13.2. Spatial Analysis

- Coordinate-based Objects.
- Distance Matrix برای حجم داده قابل‌کنترل.
- Nearest Neighbor.
- Neighborhood Radius.
- Density Estimation.
- Region Association.
- Spatial Summary.
- Export Tabular Results.

برای Datasetهای بزرگ از ساختارهای Spatial Index مناسب استفاده کن؛ ماتریس N×N را بدون برآورد حافظه برای میلیون‌ها Object تولید نکن.

## 13.3. Skeleton Analysis

- Binary Mask Input.
- Skeletonization.
- Branch Detection.
- Endpoint/Junction Detection.
- Branch Length.
- Branch Count.
- Graph Representation.
- Calibration-aware Length.
- Overlay و Export.

## 13.4. 3D Volume

- Z-Stack Validation.
- Voxel Calibration در X/Y/Z.
- Volume Rendering.
- Orthogonal Views در صورت پشتیبانی.
- Segmentation Surface.
- 3D ROI.
- Volume/Surface Measurements.
- Memory Budget و Downsampling.

3D را فقط زمانی فعال کن که Axis و Calibration داده معتبر باشند.

---

# بخش چهارده — Import، Export و Interoperability

## 14.1. Import UX

- File Picker.
- Drag-and-drop.
- Multi-file Import.
- Folder Import با کنترل Recursion.
- Reader Detection.
- Metadata Preview.
- Import Mode: Link یا Copy.
- Duplicate Detection در صورت وجود Hash.
- Import Queue.
- Error Report برای هر فایل.

هیچ فایل بزرگی نباید بدون نمایش وضعیت و امکان Cancel به شکل غیرقابل‌کنترل Import شود.

## 14.2. Export تصویر

فرمت‌ها بر اساس قابلیت Writer واقعی:

- PNG/JPEG برای تصویر نمایشی.
- TIFF برای تصاویر Raster.
- OME-TIFF برای داده چندبعدی و Metadata سازگار.
- OME-Zarr در مرحله توسعه مربوط.

Export باید مشخص کند:

- Original یا Processed.
- Pixel Type.
- Channel/Plane Selection.
- Compression.
- Calibration.
- Metadata Preservation.
- Output Path.

## 14.3. Export نتایج

- CSV برای Tables/Measurements.
- JSON برای ساختار کامل و Versioned.
- GeoJSON برای Geometry در صورت تعریف Coordinate Semantics.
- PNG/TIFF Mask.
- Label Map.
- Reports.
- Model Evaluation Summary.

## 14.4. QuPath/Fiji Compatibility

هدف در فازهای اولیه، Interoperability است نه اجرای کامل Macro یا Plugin آن نرم‌افزارها.

- Annotationهای قابل‌تبدیل را Import/Export کن.
- Coordinate و Calibration را حفظ کن.
- Measurementها را با نام و Unit روشن Export کن.
- فرمت‌های سازگار را با نمونه‌های واقعی و نسخه مشخص Test کن.
- در صورت عدم پشتیبانی کامل، در UI و مستندات دقیقاً محدودیت را اعلام کن.

## 14.5. OMERO Integration

- ابتدا مشخص کن کاربر به چه نوع Server و نسخه‌ای متصل است.
- Authentication امن.
- Project/Dataset/Image Mapping.
- Metadata Sync.
- Download/Import منتخب.
- Permission Handling.
- خطای Network و Retry.
- عدم ذخیره Credential به شکل Plain Text.

این Integration در فازهای متأخر قرار دارد و نباید توسعه هسته محلی را متوقف کند.

---

# بخش پانزده — Plugin و Scripting Architecture

**اولویت: P3**

## 15.1. اصول

- Plugin باید Interface نسخه‌دار داشته باشد.
- Plugin بتواند قابلیت، Command، Processing Operation یا Model Adapter ثبت کند.
- Plugin نباید بدون Permission به فایل‌های دلخواه یا شبکه دسترسی بگیرد.
- Plugin ناسازگار نباید برنامه را Crash کند.
- Plugin باید قابل Disable/Uninstall باشد.

## 15.2. Plugin Manifest

حداقل:

- Plugin ID.
- Name.
- Version.
- API Version.
- Author.
- License.
- Description.
- Entry Point.
- Permissions.
- Dependencies.
- Supported OS.
- Integrity Hash/Signature در صورت امکان.

## 15.3. Scripting

- ابتدا Use Caseهای واقعی Automation را مشخص کن.
- API پایدار برای Project، Image، ROI، Processing و Export تعریف کن.
- اجرای Script باید Resource Limit و Cancellation داشته باشد.
- Script نباید به صورت پیش‌فرض به Secret یا Pathهای غیرمجاز دسترسی داشته باشد.
- Console و Error Trace برای کاربر فنی فراهم شود.

از طراحی Plugin Marketplace یا Script Runtime پیش از تثبیت Public API خودداری کن.

---

# بخش شانزده — امنیت، حریم خصوصی و فایل‌های محلی

## 16.1. Tauri Security

- CSP را به سیاست مشخص و حداقلی تبدیل کن.
- Capabilityها را به حداقل لازم محدود کن.
- Scope فایل‌ها را محدود کن.
- URLهای مجاز و External Linkها را کنترل کن.
- Frontend ورودی قابل‌اعتماد فرض نشود.
- تمام File Pathها در Backend اعتبارسنجی شوند.
- IPC Commandها ورودی محدود و تایپ‌شده داشته باشند.
- از اجرای Shell یا Command دلخواه بدون ضرورت و کنترل اجتناب کن.

## 16.2. Secrets

- `.env*`، Token، API Key، Credential و فایل Config واقعی Commit نشوند.
- نمونه Config فقط با مقادیر بی‌خطر و Placeholder منتشر شود.
- Secret در Log، Error، Crash Report یا Export وارد نشود.
- تنظیمات حساس در مسیر امن سیستم‌عامل یا سازوکار مناسب نگهداری شوند.

## 16.3. Scientific/Medical Data Privacy

- داده‌های ورودی ممکن است شامل اطلاعات شناسایی بیمار باشند.
- هیچ داده واقعی بیمار را در Test Fixture، Screenshot، GitHub Issue یا CI قرار نده.
- Dataset عمومی آزمون باید مجوز استفاده روشن داشته باشد.
- در گزارش‌ها، نام فایل و مسیر حساس را در صورت نیاز Mask کن.
- Telemetry خارجی بدون رضایت و طراحی مشخص اضافه نشود.

## 16.4. Repository Hygiene

- Binary و Installer وارد Git نشود.
- `target/`، `node_modules/`، `dist/` و Cacheها Commit نشوند.
- دیتابیس شخصی و تصاویر ورودی کاربران Commit نشوند.
- فایل‌های Agent محلی مطابق دستورالعمل موجود مخزن از Push مستثنا باشند.
- فایل‌های محلی IDE و Debug Script بررسی و محدود شوند.
- قبل از Commit، staged file list به‌صورت دقیق بررسی شود.

---

# بخش هفده — تست، Validation و Quality Engineering

## 17.1. Test Pyramid

### Unit Tests

برای:

- Pixel Buffer.
- Pixel Type Conversion.
- Calibration.
- Coordinate Transform.
- ROI Geometry.
- Measurement Algorithms.
- Histogram/Threshold.
- Morphology.
- Tile Coordinate Mapping.
- Workflow Validation.
- Job State Transitions.
- Project Migrations.

### Integration Tests

برای:

- Reader → Metadata → Tile.
- Project → Asset → Reader.
- ROI → Persistence → Reopen.
- Processing → Derived Asset → History.
- Model → Inference → Result Layer.
- Workflow → Jobs → Outputs.
- Export → Re-import.

### End-to-End Tests

سناریوهای کاربر:

1. Create Project.
2. Import Raster.
3. View Image.
4. Draw ROI.
5. Measure Area/Length.
6. Save Project.
7. Close and Reopen.
8. Verify ROI and Measurements.
9. Run Processing.
10. Export Result.

سناریوی WSI:

1. Open WSI.
2. Read Metadata.
3. Display Overview.
4. Zoom/Pan.
5. Request Tiles.
6. Draw ROI.
7. Measure with valid Calibration.
8. Save and Reopen.

سناریوی AI:

1. Register/Select Model.
2. Validate Input.
3. Run Inference.
4. Cancel a test run.
5. Verify Job State.
6. Inspect Output.
7. Save Result.
8. Reopen Project and verify Provenance.

## 17.2. Golden Image Tests

- تصاویر کوچک Synthetic با Ground Truth بساز.
- خروجی Filter و Threshold با Reference مقایسه شود.
- تفاوت Floating Point با Tolerance مشخص بررسی شود.
- Pixel Typeهای مختلف پوشش داده شوند.
- Tile Seam و Boundary بررسی شود.
- تغییرات ناخواسته الگوریتم‌ها Regression ایجاد نکنند.

## 17.3. Calibration Tests

سناریوها:

- Metadata دارای MPP.
- Metadata فاقد MPP.
- MPP دستی.
- X و Y متفاوت.
- Z Spacing موجود/ناموجود.
- Calibration تغییرکرده بعد از Measurement.
- Scale Bar با Zoom متفاوت.
- ROI در Pyramid Levelهای مختلف.

نتایج باید با مقادیر محاسبه‌شده مستقل و مرجع مقایسه شوند.

## 17.4. Performance Tests

حداقل Metricها:

- Time to First Image.
- Time to First Tile.
- Tile Latency P50/P95.
- Pan/Zoom Responsiveness.
- Cache Hit Rate.
- Peak RAM.
- CPU Usage.
- GPU/VRAM در صورت امکان.
- Inference Throughput.
- Batch Completion Time.
- Import/Export Time.

Benchmark باید روی Hardware و Dataset مشخص ثبت شود؛ اعداد بدون ذکر محیط قابل مقایسه نیستند.

## 17.5. Stress Tests

- حرکت سریع Viewer.
- تغییر سریع Slide.
- بستن پنجره هنگام Job.
- Cancel در میانه Tile Processing.
- فایل خراب.
- فایل بسیار بزرگ.
- تعداد زیاد ROI.
- تعداد زیاد Tile.
- کمبود حافظه.
- Storage پر.
- قطع دسترسی فایل.
- Crash و Recovery.

## 17.6. CI Quality Gates

در صورت سازگاری با ساختار مخزن، مراحل زیر در CI اضافه شوند:

- Frontend Type Check.
- Frontend Lint.
- Frontend Build.
- Rust Format Check.
- Rust Clippy.
- Rust Unit Tests.
- Integration Tests قابل‌اجرا در Runner.
- Dependency/Security Audit در حد ابزارهای پایدار.

نسخه و Runnerها باید Pin یا کنترل شوند تا Build غیرقابل‌بازتولید نشود.

---

# بخش هجده — Performance و Resource Budget

## 18.1. اصول

- هیچ عملیات بزرگ بدون برآورد حافظه اجرا نشود، اگر برآورد امکان‌پذیر است.
- از کپی غیرضروری Pixel Buffer جلوگیری شود.
- Tile و Chunk واحد پایه برای داده بزرگ باشند.
- UI Main Thread برای Decode یا Inference مسدود نشود.
- Cache محدودیت روشن و قابل‌تنظیم داشته باشد.
- Resourceها پس از بستن Slide/Project آزاد شوند.

## 18.2. موارد Benchmark

- بازکردن Raster معمولی.
- بازکردن WSI.
- Pan و Zoom روی WSI.
- 1K، 10K و تعداد بزرگ‌تر Annotation.
- Filter روی Raster و Tile.
- Batch Processing.
- Inference روی Tile و کل Slide.
- بازکردن Project با تعداد زیاد Asset.

اندازه Datasetها و Hardware مورد استفاده در Benchmark ثبت شود.

## 18.3. Cache Strategy

- Tile Cache.
- Thumbnail Cache.
- Derived Asset Cache.
- Model Cache.
- Metadata Cache.

هر Cache باید:

- Key پایدار داشته باشد.
- سقف مصرف داشته باشد.
- سیاست Eviction داشته باشد.
- قابلیت Clear داشته باشد.
- قابل‌بازسازی باشد.
- از داده اصلی تفکیک شود.

---

# بخش نوزده — Release، Versioning و Documentation

## 19.1. Semantic Versioning

- PATCH: Bug Fix و اصلاح کوچک بدون شکستن قرارداد.
- MINOR: قابلیت جدید سازگار با نسخه قبل.
- MAJOR: تغییرات Breaking در Data Schema، API یا معماری عمومی.

قواعد Versioning فعلی پروژه را بررسی و حفظ کن. اگر فایل‌های Version متعددی دارند، همه را طبق قرارداد موجود همگام کن؛ فایل تازه‌ای برای Version بدون نیاز اضافه نکن.

## 19.2. Documentation موردنیاز

- README واقعی محصول.
- Architecture Overview.
- Supported Formats Matrix.
- Data Model.
- Calibration Semantics.
- WSI Reader Architecture.
- Processing Operations Reference.
- ROI/Annotation Format.
- AI Model Adapter Guide.
- Workflow Guide.
- Build/Development Guide.
- Test Guide.
- Troubleshooting.
- Release Notes.
- Security/Privacy Notes.

README باید دست‌کم شامل موارد زیر باشد:

- TissueAI چیست.
- چه مسئله‌ای را حل می‌کند.
- وضعیت فعلی و محدودیت‌ها.
- Screenshot واقعی و به‌روز.
- Platformهای پشتیبانی‌شده.
- نحوه Build و Run.
- فرمت‌های واقعاً پشتیبانی‌شده.
- وضعیت Research/Experimental.
- License و Citation در صورت تعیین‌شدن.

از نوشتن ادعای قابلیتی که هنوز Test نشده خودداری کن.

---

# بخش بیست — برنامه اجرایی مرحله‌ای و Task Backlog

هر Milestone باید مستقل Build و Test شود. Agent نباید همه فازها را یک‌جا و بدون گزارش میانی اجرا کند. ابتدا Milestone 0 را تکمیل کن؛ سپس مراحل بعدی را به ترتیب پیش ببر. در صورت محدودیت منابع یا تعارض معماری، آن را مستند و قبل از ایجاد ساختار موازی گزارش کن.

## M0 — Repository Audit و تثبیت Baseline

**اولویت:** P0  
**هدف:** شناخت دقیق کد موجود و ثبت وضعیت واقعی پیش از تغییر.

### M0-01 — Repository Inventory

- ساختار Root، Frontend و Backend را استخراج کن.
- ماژول‌های Rust و Componentهای اصلی React را فهرست کن.
- مسیر IPC Commandها را مشخص کن.
- مسیر Database و AppData را پیدا کن.
- تمام فایل‌های Config و Manifest را ثبت کن.

**Acceptance Criteria:** یک Architecture Inventory با مسیرهای واقعی فایل‌ها و مسئولیت هر ماژول تهیه شده باشد.

### M0-02 — Existing Feature Matrix

برای هر قابلیت وضعیت زیر را ثبت کن:

- Implemented and Tested.
- Implemented but Not Verified.
- Partial.
- UI Only.
- Backend Only.
- Planned/Docs Only.
- Missing.

**Acceptance Criteria:** هیچ قابلیت صرفاً بر اساس نام Module، Command یا صفحه UI، کامل محسوب نشده باشد.

### M0-03 — Build/Test Baseline

- Build Frontend.
- Check Rust Build.
- Run Existing Tests.
- Record Warnings and Errors.
- Record Version and Environment.

**Acceptance Criteria:** Baseline قابل‌بازتولید ثبت شده باشد؛ خطاهای قدیمی از خطاهای جدید تفکیک شده باشند.

### M0-04 — Data Flow Trace

برای حداقل Open Image، WSI Tile، ROI، Measurement، Processing و Save Project، جریان Frontend تا Backend و Storage را رسم کن.

**Acceptance Criteria:** مسیر داده و نقاط تبدیل/کپی/ذخیره برای هر جریان مشخص باشد.

### M0-05 — Risk Register

ریسک‌ها را با Severity، Probability، Impact، Mitigation و Owner ثبت کن.

**Acceptance Criteria:** تمام FINDهای بخش دو تعیین وضعیت شده باشند.

---

## M1 — Scientific Data Model و Calibration

**اولویت:** P0  
**وابستگی:** M0

### M1-01 — Pixel Type Consistency

- Pixel Type Enum را با Typed Buffer تطبیق بده.
- Size/Stride/Alignment را کنترل کن.
- Endianness موردنیاز را مشخص کن.
- Conversion API تعریف کن.
- I16 و سایر نوع‌های اعلام‌شده را End-to-End تست کن.

**Acceptance Criteria:** هیچ Pixel Type در Enum وجود نداشته باشد که Buffer یا مسیر پردازش واقعی ندارد؛ نوع‌های ناقص یا تکمیل شوند یا صریحاً Unsupported اعلام شوند.

### M1-02 — Axis Model

- Canonical Axis Model بساز.
- X/Y/C/Z/T را پشتیبانی کن.
- ترتیب واقعی Axis از Reader به Canonical تبدیل شود.
- Dimensionهای ناشناخته حفظ شوند.

**Acceptance Criteria:** Synthetic Test با چند ترتیب Axis بتواند بدون جابه‌جایی Channel و Z/T Decode و Round-trip شود.

### M1-03 — Calibration Domain

- Calibration با X/Y/Z/Time و Unit تعریف کن.
- Source و Validity نگهداری شود.
- Unknown واقعی پشتیبانی شود.
- مقادیر ثابت فرضی حذف شوند.

**Acceptance Criteria:** اگر Metadata کالیبراسیون نداشته باشد، Measurement فیزیکی تولید نشود؛ Pixel Measurement در دسترس باشد.

### M1-04 — Metadata Normalization

- Raw و Normalized Metadata جدا شوند.
- Source Fieldها حفظ شوند.
- Unknownها حذف نشوند.

**Acceptance Criteria:** Metadata Reader بدون از دست‌رفتن مقادیر اصلی قابل‌ردیابی باشد.

### M1-05 — Scientific Model Tests

- Pixel Conversion Tests.
- Axis Tests.
- Calibration Tests.
- Unit Tests.

**Acceptance Criteria:** تست‌های خودکار برای Edge Caseهای Data Model اضافه و اجرا شده باشند.

---

## M2 — WSI Reader و Tile Infrastructure

**اولویت:** P0  
**وابستگی:** M1

### M2-01 — Reader Contract

Interface مرکزی Reader را تعریف کن و قابلیت‌های هر Reader را صریح کن.

### M2-02 — OpenSlide Adapter

- Native dependency و Packaging را بررسی کن.
- Reader را اضافه کن.
- Metadata و Pyramid واقعی بخوان.
- Tile و Region بخوان.
- Resource Lifecycle را مدیریت کن.

### M2-03 — Raster Reader Separation

- Raster معمولی را از WSI جدا کن.
- برای Raster Calibration نامعلوم بماند، مگر Metadata معتبر باشد.
- WSI-only Feature برای Raster ساختگی نمایش داده نشود.

### M2-04 — Pyramid Resolver

- Levelها و Downsample واقعی.
- Coordinate Mapping.
- Level Selection.
- Unit Test.

### M2-05 — Tile Manager

- Priority.
- Deduplication.
- Cancellation.
- Prefetch.
- Concurrency Limit.
- Error Handling.

### M2-06 — Tile Cache

- Byte Budget.
- Eviction.
- Key دقیق.
- Invalidation.
- Cache Statistics.

### M2-07 — Overview/Thumbnail

- Thumbnail Generation.
- Overview View.
- Viewport Rectangle.
- Click Navigation.

### M2-08 — WSI Validation Dataset

مجموعه‌ای از اسلایدهای مجاز/نمونه با Metadata شناخته‌شده و نتایج موردانتظار تهیه کن.

**Acceptance Criteria کل M2:** بازشدن WSI بدون Decode کامل، انتخاب Pyramid Level صحیح، Tile صحیح، MPP معتبر/Unknown درست، عدم Crash و Benchmark ثبت‌شده.

---

## M3 — Viewer Core و Rendering

**اولویت:** P0  
**وابستگی:** M2

### M3-01 — Viewport State

- Zoom.
- Pan.
- Center.
- Fit to Screen.
- Actual Size در صورت معنی‌دار بودن.
- Coordinate Transform.

### M3-02 — Tile Renderer

- Tile request lifecycle.
- Placeholder/Loading Tile.
- Error Tile.
- Cache Integration.
- Stale Request Cancellation.

### M3-03 — Input Handling

- Mouse/Trackpad.
- Wheel Zoom.
- Pan.
- Keyboard.
- Tool Interaction.

### M3-04 — Overview Map و Scale Bar

- Viewport sync.
- Calibration-aware Scale Bar.
- Unknown Calibration State.

### M3-05 — Multichannel Viewer

- Channel Visibility.
- Per-channel LUT.
- Composite.
- Z/T Selector.
- Intensity Range.

### M3-06 — Layer Engine

- Base Image.
- ROI.
- Mask.
- Heatmap.
- Detection.
- Opacity/Visibility/Order.

### M3-07 — Viewer Performance

- Main Thread آزاد بماند.
- Pan/Zoom Benchmark.
- Memory Leak Check.
- Stale Tile Check.

**Acceptance Criteria کل M3:** Viewer روی WSI و Raster به‌صورت روان و صحیح کار کند؛ Zoom/Pan، مختصات، Layer و Calibration در آزمون‌ها درست باشند.

---

## M4 — Project، Persistence و ROI

**اولویت:** P0  
**وابستگی:** M1 و M2

### M4-01 — Project Repository

- Create/Open/Close/Rename.
- Versioned Schema.
- SQLite Migration.
- Atomic Save.

### M4-02 — Dataset و Asset Management

- Create Dataset.
- Import/Link/Copy Asset.
- Duplicate Detection.
- Missing File/Relink.
- Asset Metadata.

### M4-03 — ROI Persistence

- Geometry Serialization.
- Coordinate Space.
- Project/Asset Relation.
- Reopen Validation.

### M4-04 — Annotation Classes و Hierarchy

- Class Schema.
- Group/Parent/Child.
- Tags/Notes.
- Visibility/Lock.

### M4-05 — Measurement Engine

- Pixel Measurement.
- Physical Measurement.
- Calibration Snapshot.
- Shape Features.
- Intensity Features.

### M4-06 — Undo/Redo

- Domain-level command history.
- Edit/Delete/Create.
- Persistence یا Recovery در صورت طراحی.

### M4-07 — Project Recovery

- Corrupt/Interrupted Save Test.
- Migration Test.
- Backup/Recovery.

**Acceptance Criteria کل M4:** کاربر بتواند Project بسازد، Asset وارد کند، ROI ایجاد کند، اندازه‌گیری انجام دهد، برنامه را ببندد و پس از بازکردن دوباره همه داده‌ها را بدون تغییر ناخواسته بازیابی کند.

---

## M5 — Core Image Processing

**اولویت:** P1  
**وابستگی:** M1 و ترجیحاً M2

### M5-01 — Operation Framework

- Operation ID/Version.
- Parameter Schema.
- Input/Output Contract.
- Tile Compatibility.
- Cancellation.
- Provenance.

### M5-02 — Intensity Operations

Brightness، Contrast، Gamma، Histogram، Normalize و CLAHE.

### M5-03 — Spatial Filters

Gaussian، Median، Mean، Sharpen، Sobel و Convolution.

### M5-04 — Thresholding

Manual، Otsu، Triangle و Adaptive Threshold.

### M5-05 — Morphology

Erosion، Dilation، Opening، Closing و Structuring Elements.

### M5-06 — Segmentation Basics

Connected Components، Watershed، Distance Transform و Label Map.

### M5-07 — Geometric Transformations

Crop، Resize، Rotate، Flip، Resample و Affine.

### M5-08 — Color/Channel Operations

Split/Merge، LUT، Color Space و Color Deconvolution.

### M5-09 — Tile-safe Execution

Halo، Boundary، Global Pass و Memory Budget.

### M5-10 — Processing History

ثبت Operationها، Parameters، Input و Output.

**Acceptance Criteria کل M5:** هر Operation دارای تست عددی و Golden Image باشد؛ داده اصلی تخریب نشود؛ خروجی و Parameters قابل‌ردیابی باشند.

---

## M6 — Histology Analysis

**اولویت:** P1  
**وابستگی:** M4 و M5

### M6-01 — Tissue Detection

Mask بافت، Threshold/Color، Cleanup و Overlay.

### M6-02 — Stain Separation

H&E و H-DAB، تنظیم Vector و Validation.

### M6-03 — Nuclei Detection

Pipeline کلاسیک و امکان اتصال Model Adapter.

### M6-04 — Morphometry

ویژگی‌های هندسی و شدت برای Objectها.

### M6-05 — Cell/Tissue Classification

Class Schema، Manual Review و Model Result.

### M6-06 — Heatmap

Legend، Range، Opacity و Provenance.

### M6-07 — Spatial Analysis

Density، Distance و Neighborhood.

### M6-08 — Batch Histology

اجرای یکسان Workflow روی چند Slide و گزارش per-slide.

**Acceptance Criteria کل M6:** حداقل یک Workflow کامل از Tissue Detection تا Measurement و Export روی Dataset مرجع قابل اجرا و تکرار باشد.

---

## M7 — AI Model Platform

**اولویت:** P2  
**وابستگی:** M1، M2، M3، M4 و M11 Job Engine

### M7-01 — Model Descriptor و Registry

### M7-02 — ONNX Runtime Adapter

### M7-03 — CPU/GPU Capability Detection

### M7-04 — Pre/Postprocessing Contracts

### M7-05 — Tile Inference

### M7-06 — StarDist Adapter

### M7-07 — Cellpose Adapter

### M7-08 — U-Net Adapter

### M7-09 — Model Result Layer و Persistence

### M7-10 — Evaluation Metrics و Reports

### M7-11 — Model Integrity و License Metadata

**Acceptance Criteria کل M7:** حداقل یک مدل با فایل واقعی، Input/Output مشخص، Inference واقعی، Tile Mapping صحیح، Result Persistence و تست قابل‌تکرار اجرا شود. وجود Registry یا Model Card به‌تنهایی کافی نیست.

---

## M8 — Job Engine و Workflow

**اولویت:** P1 برای Job، P2 برای Workflow  
**وابستگی:** M2 و M5

### M8-01 — Job Domain و State Machine
### M8-02 — Job Queue و Scheduler
### M8-03 — Progress Events و Cancellation
### M8-04 — Resource Limits
### M8-05 — Job History و Persistence
### M8-06 — Workflow Node/Edge Model
### M8-07 — Graph Validation
### M8-08 — DAG Executor
### M8-09 — Retry/Checkpoint در صورت پشتیبانی
### M8-10 — Workflow UI

**Acceptance Criteria:** عملیات طولانی از UI جدا اجرا شوند، Progress واقعی داشته باشند، Cancel کار کند و Run History قابل‌بررسی باشد.

---

## M9 — Export و Interoperability

**اولویت:** P1/P2

### M9-01 — CSV Measurement Export
### M9-02 — Versioned JSON Export
### M9-03 — Mask/Label Export
### M9-04 — TIFF/OME-TIFF Writer
### M9-05 — Annotation GeoJSON/QuPath Compatibility
### M9-06 — Import/Export Round-trip Tests
### M9-07 — OMERO Integration Design/Prototype

**Acceptance Criteria:** Export و Re-import اطلاعات، مختصات، واحدها و Metadata را بدون تغییر ناخواسته حفظ کند؛ محدودیت‌های Format مستند باشند.

---

## M10 — UI/UX و Product Polish

**اولویت:** P1، هم‌زمان با تثبیت هر Feature

### M10-01 — Design Audit

- تمام Screenها و مسیرهای ناوبری را فهرست کن.
- وضعیت فعلی را Screenshot بگیر.
- Componentهای تکراری را پیدا کن.
- Design Tokens را مشخص کن.

### M10-02 — Workspace Layout

- Project Explorer.
- Center Viewer.
- Inspector.
- Bottom Results/Jobs.
- Responsive Splitters.

### M10-03 — Project Dashboard

- Recent Projects.
- Import/Open/Create.
- Recent Jobs.
- Real System Status.

### M10-04 — Tool UX

- Tool Selection.
- Keyboard Shortcuts.
- Context Menus.
- Command Palette.

### M10-05 — Layer/Inspector UX

### M10-06 — Empty/Loading/Error/Success States

### M10-07 — Light/Dark Parity

### M10-08 — Accessibility/Reduced Motion

### M10-09 — Visual Regression

**Acceptance Criteria:** رابط کاربری از نظر عملکرد، Theme، Keyboard، خطا و Stateها کامل باشد؛ هیچ دکمه تزئینی یا داده ساختگی باقی نماند.

---

## M11 — Security، QA و Release Readiness

**اولویت:** P0/P1 و ادامه‌دار

### M11-01 — CSP و Tauri Capability Review
### M11-02 — File/Path Validation
### M11-03 — Secret/Config Audit
### M11-04 — Dependency/License Audit
### M11-05 — Crash/Recovery Tests
### M11-06 — CI Quality Gates
### M11-07 — Release Packaging Verification
### M11-08 — Documentation و README
### M11-09 — Supported Format Matrix
### M11-10 — Release Checklist

**Acceptance Criteria:** Build و Test در CI قابل‌اجرا باشند، مجوزها محدود باشند، داده حساس وارد Repository نشده باشد و مستندات با قابلیت واقعی منطبق باشند.

---

# بخش بیست‌ویک — اولویت‌بندی و ترتیب وابستگی

## 21.1. ترتیب کلان

ترتیب پیشنهادی:

1. M0 — Audit.
2. M1 — Scientific Data Model.
3. M2 — WSI Reader.
4. M3 — Viewer Core.
5. M4 — Project/ROI Persistence.
6. M5 — Core Processing.
7. M11 — Security/QA در تمام مراحل و تکمیل Gateها.
8. M6 — Histology.
9. M8 — Job Engine و سپس Workflow.
10. M7 — AI Platform.
11. M9 — Export/Interoperability.
12. M10 — UI Polish به‌صورت پیوسته، نه فقط در انتها.

Dependencyهای واقعی ممکن است بعضی Taskها را موازی کنند، اما WSI، Calibration و Data Model نباید دور زده شوند.

## 21.2. قابلیت‌هایی که نباید زودتر از موعد ساخته شوند

- Model Marketplace قبل از Model Registry امن و API نسخه‌دار.
- Plugin Marketplace قبل از Plugin API پایدار.
- Distributed Processing پیش از Job Engine محلی قابل‌اعتماد.
- تشخیص بالینی قبل از Validation و Regulatory Assessment.
- 3D Advanced قبل از مدل C/Z/T و Voxel Calibration.
- Workflow Designer قبل از Operation Contract و Job Engine.
- ادعای پشتیبانی عمومی WSI قبل از Reader و Tile Tests واقعی.

---

# بخش بیست‌ودو — قالب گزارش اجباری Agent پس از هر Milestone

در پایان هر Milestone، گزارشی با قالب زیر ارائه بده:

```text
MILESTONE: Mx — Name
STATUS: VERIFIED / IMPLEMENTED / BLOCKED

1. Summary
- What was implemented.
- What was intentionally not changed.

2. Code Changes
- File path: purpose of change.
- File path: purpose of change.

3. Architecture
- New interfaces/services/models.
- Dependencies and integration points.

4. Tests
- Command executed.
- Number of tests passed/failed.
- Build result.
- Benchmark result where applicable.

5. Acceptance Criteria
- AC-01: PASS/FAIL with evidence.
- AC-02: PASS/FAIL with evidence.

6. Known Limitations
- Remaining bugs.
- Unsupported formats/types.
- Platform limitations.

7. Data Safety
- Migration impact.
- Backup/Recovery behavior.
- No sensitive files staged.

8. Git
- Branch.
- Changed files.
- git status --short.
- Commit hash if committed.
- Push status if required by the repository instructions.

9. Next Milestone
- Exact next Task IDs.
- Blocking dependencies.
```

گزارش باید نتیجه واقعی فرمان‌ها را بیان کند. هیچ تستی را بدون اجرا Passed اعلام نکن.

---

# بخش بیست‌وسه — Definition of Done عمومی

یک قابلیت زمانی Done است که تمام شرایط مرتبط زیر برقرار باشند:

1. رفتار موردنیاز دقیقاً پیاده‌سازی شده باشد.
2. UI، Backend و Storage قرارداد سازگار داشته باشند.
3. مسیر خطا و ورودی نامعتبر مدیریت شده باشد.
4. Loading/Progress/Cancel در صورت نیاز وجود داشته باشد.
5. داده اصلی ناخواسته تخریب نشود.
6. Calibration و Units درست باشند.
7. داده بعد از Save/Close/Reopen حفظ شود، اگر قابلیت Persistent است.
8. Unit Test نوشته و پاس شده باشد.
9. Integration/E2E Test متناسب نوشته و پاس شده باشد.
10. Regression مهم رخ نداده باشد.
11. UI در Light و Dark Theme صحیح باشد.
12. Keyboard و Accessibility در حد قابلیت رعایت شده باشد.
13. Performance و Memory بررسی شده باشد، اگر عملیات سنگین است.
14. Documentation به‌روز شده باشد.
15. محدودیت واقعی قابلیت مستند شده باشد.
16. هیچ داده ساختگی یا Mock ناخواسته باقی نمانده باشد.
17. Git Diff فقط شامل فایل‌های موردنیاز باشد.
18. Build نهایی موفق باشد.

---

# بخش بیست‌وچهار — منابع رسمی برای تصمیم‌گیری فنی

Agent باید پیش از انتخاب یا ارتقای Dependency، مستندات رسمی و وضعیت نسخه فعلی را بررسی کند. این فهرست نقطه شروع است و جای بررسی Compatibility و License را نمی‌گیرد.

## Scientific Imaging و WSI

- OpenSlide: https://openslide.org/
- OpenSlide Documentation: https://openslide.org/api/python/
- Bio-Formats: https://www.openmicroscopy.org/bio-formats/
- OME Data Model: https://ome-model.readthedocs.io/
- OME-NGFF / OME-Zarr: https://ngff.openmicroscopy.org/
- TIFF Specification / Library Documentation متناسب با Reader انتخابی.

## Reference Applications

- Fiji: https://fiji.sc/
- ImageJ: https://imagej.net/
- QuPath: https://qupath.github.io/
- napari: https://napari.org/
- OMERO: https://www.openmicroscopy.org/omero/

## Desktop / Runtime / AI

- Tauri: https://tauri.app/
- Tauri Security: https://tauri.app/security/
- ONNX Runtime: https://onnxruntime.ai/docs/
- Rust Documentation: https://doc.rust-lang.org/
- React Documentation: https://react.dev/
- TypeScript Documentation: https://www.typescriptlang.org/docs/

هنگام استفاده از کد یا الگوریتم پروژه‌های دیگر:

- License را بررسی کن.
- متن Attribution لازم را رعایت کن.
- Code Copy را بدون مجوز انجام نده.
- ترجیحاً از استاندارد، API و مفهوم معماری الهام بگیر.
- نسخه و تاریخ بررسی Dependency را در تصمیم معماری ثبت کن.

---

# بخش بیست‌وپنج — فرمان نهایی به Antigravity

تو نباید این سند را به یک بازنویسی بزرگ، تولید حجم زیادی فایل یا ساخت UI نمایشی تبدیل کنی.

**روش اجرای الزامی:**

1. ابتدا M0 را کامل انجام بده و وضعیت واقعی Repository را مستند کن.
2. پس از Audit، Taskهای M1 را به ترتیب اجرا کن.
3. هر Task را با قرارداد، تست و معیار پذیرش تکمیل کن.
4. بعد از هر Milestone، گزارش استاندارد بخش بیست‌ودو را ارائه بده.
5. تنها پس از Verified شدن وابستگی‌ها به Milestone بعدی برو.
6. در صورت نیاز به Dependency جدید، پیش از نصب، دلیل، مجوز، حجم، Platform Support و جایگزین‌ها را بررسی کن.
7. اگر یک قابلیت در معماری فعلی وجود دارد، آن را تکمیل کن؛ نسخه موازی و تکراری نساز.
8. اگر بخشی از این سند با واقعیت کد یا محدودیت کتابخانه‌ها ناسازگار است، مسئله را با شواهد توضیح بده و کم‌ریسک‌ترین طراحی جایگزین را پیشنهاد کن.
9. اگر نیاز به تصمیم محصولی/علمی/حقوقی مالک وجود دارد، Task را Blocked کن و تصمیم موردنیاز را دقیق بیان کن؛ خودسرانه ادعای علمی یا محصولی نساز.
10. کیفیت، صحت علمی، پایداری داده و قابلیت نگهداری بر تعداد قابلیت‌های تحویل‌شده اولویت دارند.

**هدف نهایی:** ساخت یک Workstation علمی پایدار، قابل‌اعتماد، سریع، توسعه‌پذیر و خوش‌طراحی برای Computational Histology و Digital Pathology؛ با هسته پردازش تصویر واقعی، WSI Engine صحیح، Project System پایدار، Annotation دقیق، AI قابل‌ردیابی و تجربه کاربری یکپارچه.

---

**پایان سند — TissueAI Engineering Master Roadmap**
