# TissueAI — Deep Re-Audit, Critical Gap Analysis & Next-Phase Engineering Specification

**نسخه سند:** 1.0  
**تاریخ ممیزی:** 2026-11-12  
**مخزن:** https://github.com/amirrezamortazavifard/TissueAI  
**شاخه بررسی‌شده:** `main`  
**نوع سند:** ممیزی عمیق کد موجود + تحلیل ریسک + مشخصات اجرایی توسعه تکمیلی  
**مخاطب اجرایی:** Antigravity / AI Coding Agent  
**رابطه با مستند قبلی:** این سند مکمل `TISSUEAI_ENGINEERING_ROADMAP.md` و `options.md` است؛ جایگزین آن‌ها نیست.

---

# دستور مستقیم به Agent

این سند را به‌عنوان یک ممیزی تکمیلی و Backlog مهندسی برای مخزن فعلی TissueAI اجرا کن. هدف، اضافه‌کردن قابلیت‌های نمایشی یا افزایش تعداد صفحات نیست؛ هدف، رساندن محصول به سطح یک **Scientific Digital Pathology Workstation قابل‌اعتماد، سریع، توسعه‌پذیر و قابل‌بازتولید** است.

## قوانین اجرای غیرقابل مذاکره

1. ابتدا Repository فعلی را از نو بررسی کن. محتوای GitHub، فایل‌های محلی و وضعیت واقعی شاخه `main` ممکن است بعد از این ممیزی تغییر کرده باشند.
2. این سند و `options.md` را فهرست کارهای پیشنهادی بدان، نه مدرک وجود قابلیت. وجود یک فایل، Struct، Tauri Command، دکمه یا عنوان منو هرگز به معنی کامل‌بودن قابلیت نیست.
3. قبل از شروع هر Task، وضعیت آن را با یکی از برچسب‌های زیر تعیین کن:
   - `VERIFIED_COMPLETE`: مسیر واقعی End-to-End وجود دارد و تست قابل‌تکرار موفق است.
   - `IMPLEMENTED_PARTIAL`: بخش‌هایی از قابلیت وجود دارد، اما مسیر کامل یا معیارهای پذیرش ناقص‌اند.
   - `DECLARED_ONLY`: قابلیت فقط در سند، UI، نام ماژول یا Stub دیده شده است.
   - `BLOCKED`: وابستگی فنی، مجوز، پلتفرم یا داده لازم موجود نیست.
   - `NOT_STARTED`: شواهد پیاده‌سازی وجود ندارد.
   - `NEEDS_RUNTIME_VALIDATION`: از روی Static Review نمی‌توان صحت اجرا را تأیید کرد.
4. هیچ Task را صرفاً با Mock Data، Placeholder، Fake Telemetry، خروجی ثابت، شبیه‌سازی Progress یا UI غیرمتصل به Backend تکمیل‌شده اعلام نکن.
5. برای الگوریتم‌های علمی، خروجی باید با Dataset مرجع، مقادیر شناخته‌شده، یا نرم‌افزار مرجع مقایسه شود. «بدون Crash اجرا شد» معیار صحت علمی نیست.
6. داده اصلی را هرگز درجا تخریب نکن. هر تغییر پیکسل باید به‌عنوان Asset مشتق‌شده با Provenance مستقل ثبت شود؛ مگر آنکه کاربر صریحاً Export/Overwrite را انتخاب کرده باشد و امکان Undo/Backup وجود داشته باشد.
7. مقادیر مجهول را حدس نزن. MPP، Magnification، Pixel Type، Channel Meaning، Z Spacing، Time Interval و Stain Vector باید از Metadata معتبر یا تأیید کاربر بیایند. مقدار نامعلوم باید `Unknown` بماند.
8. هر Task را با کمترین Refactor لازم در معماری فعلی اجرا کن. بازنویسی گسترده بدون نیاز اثبات‌شده ممنوع است.
9. تغییرات Backend، Frontend، Schema، Project Migration، Tests و Documentation را در همان Task هماهنگ کن.
10. از Python Runtime اجباری، Java Runtime اجباری یا وابستگی به Cloud برای عملیات اصلی محصول استفاده نکن. Adapter اختیاری برای آن‌ها تنها در صورت نیاز واقعی، رضایت کاربر و حفظ عملکرد Offline قابل قبول است.
11. هیچ داده بیمار، اسلاید، تصویر میکروسکوپی، Prompt یا API Key را بدون رضایت صریح از دستگاه خارج نکن. Telemetry و Crash Reporting باید Opt-in باشند و امکان Redaction داشته باشند.
12. هیچ‌گاه ادعای Clinical Diagnosis یا آمادگی بالینی نکن؛ تا زمانی که اعتبارسنجی مستقل، ارزیابی بالینی و الزامات قانونی کاربرد موردنظر طی نشده‌اند، محصول Research-use باقی می‌ماند.
13. پس از هر Milestone گزارش بده: فایل‌های تغییرکرده، تصمیم‌های معماری، تست‌ها و نتایج، محدودیت‌های باقی‌مانده، داده‌های استفاده‌شده، Performance و کار بعدی.
14. هیچ Task را به‌صورت خودکار در GitHub منتشر نکن مگر آنکه دستورالعمل خصوصی مخزن و دستور صریح مالک پروژه چنین اجازه‌ای بدهند. این سند مجوز تغییر Visibility یا انتشار Secrets نیست.

---

# 1. خلاصه مدیریتی

## 1.1 ارزیابی کلی

در بررسی مجدد، TissueAI نسبت به وضعیت اولیه دارای اجزای بیشتری در Backend است: مدل داده علمی با Pixel Typeهای متنوع، ساختار Metadata، ماژول‌های WSI، ROI و Measurement، Histology، Image Processing، Registration، Spatial Analysis، Skeleton، Workflow، Job State و چند مسیر AI در کد دیده می‌شوند. همچنین `options.md` به یک سند بسیار مفصل ImageJ/Fiji Expansion تبدیل شده است.

با وجود این پیشرفت، چند ریسک بنیادی هنوز مانع آن هستند که محصول را یک Workstation علمی قابل‌اعتماد بدانیم:

1. Reader فعلی WSI هنوز فایل SVS/NDPI/MRXS را از طریق `image::ImageReader::decode()` به `DynamicImage` کامل تبدیل می‌کند؛ این رفتار معادل خواندن Native Pyramid/Tile از فایل اصلی نیست.
2. Web Server داخلی در `src-tauri/src/llm/web_server.rs` روی `0.0.0.0` گوش می‌دهد، CORS را برای Origin/Method/Header دلخواه باز می‌کند و مسیرهای Admin دارد. در کد بررسی‌شده Middleware احراز هویت قابل‌مشاهده‌ای برای این Routeها وجود ندارد؛ این مورد باید پیش از استفاده شبکه‌ای فوراً سخت‌سازی شود.
3. Measurement فیزیکی ROI در حالت Calibration ناهمسانگرد (Anisotropic) با ضرب Perimeter و Feret در `pixel_size_x` می‌تواند غلط باشد؛ Calibration اختیاری نیز می‌تواند به Default غیرکالیبره ختم شود.
4. مدل داده از Pixel Typeهای متنوع پشتیبانی اسمی دارد، اما بسیاری از عملیات پردازش هنوز فقط `U8` و RGB/RGBA را قبول می‌کنند. مسیر Import از `DynamicImage` نیز ممکن است برخی ورودی‌ها را به RGB8 تبدیل و دقت داده را کم کند.
5. Job Manager بیشتر یک Registry وضعیت است تا Scheduler اجرایی. لغو Job هم می‌تواند قبل از توقف واقعی Worker، وضعیت را `Cancelled` اعلام کند.
6. Project Persistence هنوز برای استفاده طولانی‌مدت نیازمند Schema Migration، Integrity Check، Asset Relinking و آزمون Crash Recovery است. مهم‌تر اینکه `project_add_image` خطای ذخیره را نادیده می‌گیرد.
7. Workspace علمی یکپارچه هنوز باید از مسیرهای مستقل ابزارها و پروژه‌های Chat جدا شود. صفحه `ProjectPage` بررسی‌شده در Frontend با Thread/Assistant/Chat Folders کار می‌کند، نه با `TissueAiProject` علمی.
8. لایه امنیت Tauri نیازمند CSP، Scope محدودتر Network، حذف اتکای کاذب به جلوگیری سراسری Context Menu/Shortcut و سخت‌سازی مدل‌های رمزنگاری‌شده است.

**نتیجه:** مرحله بعدی نباید «اضافه‌کردن هرچه بیشتر مدل AI» باشد. اول باید Security، WSI، Calibration، Typed Processing، Project Integrity و Job Execution قابل‌اعتماد شوند. سپس توسعه قابلیت‌های رقابتی و تمایزدهنده معنا پیدا می‌کند.

## 1.2 یافته‌های مثبت و پیشرفت‌هایی که باید حفظ شوند

| حوزه | مشاهده | تصمیم |
|---|---|---|
| Scientific Image Model | مدل Asset، Dimensions، Pixel Type، Axis و Metadata در کد وجود دارد | حفظ و تکمیل؛ بازنویسی بی‌دلیل ممنوع |
| Typed Buffers | انواع U8/U16/I16/U32/I32/F32/F64/RGB/RGBA تعریف شده‌اند | همه عملیات باید این مدل را واقعاً رعایت کنند |
| Provenance | مدل Lineage و اطلاعات عملیات مشتق‌شده وجود دارد | به Run Manifest کامل تبدیل شود |
| WSI Abstraction | Trait و Readerهای استاندارد/پیرامونی وجود دارند | مرزبندی درست است؛ Decoder واقعی هنوز لازم است |
| ROI | شکل‌های ROI، Hierarchy و History وجود دارد | Calibration، Persistence و UX تکمیل شود |
| Project | ذخیره JSON، فایل موقت، Backup و fsync در مسیر ذخیره دیده می‌شود | مهاجرت Schema و مدیریت Asset اضافه شود |
| AI | ماژول ONNX/Segmentation و Decoder/Tile Planning وجود دارد | End-to-End Inference و Evaluation اثبات شود |
| Hardware Panel | داده‌های ساختگی قبلی به فراخوانی اطلاعات سیستم تغییر کرده‌اند | Telemetry واقعی‌تر و معنادارتر شود |
| Secrets | Provider Keyها در مسیر اصلی از OS Keyring استفاده می‌کنند و Fallback رمز‌شده مستند شده است | حفظ؛ Threat Model و تست بازیابی تکمیل شود |
| Documentation | `options.md` اکنون مشخصات مفصل ۲۳۸۸ خطی دارد | آن را با وضعیت کد Sync نگه دار؛ ادعاهای تحقق را تست کن |

---

# 2. دامنه، روش و محدودیت ممیزی

## 2.1 دامنه بررسی

این ممیزی بر روی شاخه عمومی `main` و فایل‌های قابل مشاهده در مخزن GitHub انجام شده است. مسیرهای اصلی بررسی‌شده:

- `src/` — React، TypeScript، Routing، Home، صفحات ابزار و State.
- `src-tauri/src/` — Rust، Tauri Commands، Scientific Models، WSI، ROI، Processing، AI، Job، Project، LLM و Export.
- `src-tauri/Cargo.toml` و `src-tauri/tauri.conf.json` — Dependency و Runtime Configuration.
- `src-tauri/capabilities/default.json` — Permission و Network Scope.
- `package.json` — Scripts و Dependencies.
- `README.md` و `options.md` — وضعیت مستندات.

## 2.2 طبقه‌بندی اطمینان یافته‌ها

- **Confirmed by Source:** مستقیماً از کد جاری قابل مشاهده است.
- **Strong Risk:** الگوی موجود ریسک مشخصی ایجاد می‌کند، اما برای اثبات آسیب یا شکست نهایی تست اجرایی لازم است.
- **Not Proven:** سورس عمومی، تست، مدل یا Dataset لازم برای تأیید کامل را نشان نمی‌دهد.
- **Runtime Required:** فقط اجرای برنامه، Build، Profiling یا آزمایش روی نمونه واقعی می‌تواند وضعیت را مشخص کند.

## 2.3 محدودیت

این سند جایگزین اجرای برنامه، بررسی Build محلی، آزمون Native Decoder روی اسلاید واقعی، Benchmark روی سیستم سخت‌افزاری، Security Penetration Test یا اعتبارسنجی علمی نیست. Static Code Review می‌تواند خطرهای مهمی را آشکار کند، اما نمی‌تواند عملکرد همه قابلیت‌ها را اثبات کند.

Agent باید در ابتدای اجرا Commit SHA و زمان بررسی خودش را ثبت کند؛ چون مخزن ممکن است پس از تاریخ این ممیزی تغییر کرده باشد.

---

# 3. یافته‌های بحرانی و اقدامات فوری (P0)

این بخش پیش از توسعه امکانات جدید باید تعیین تکلیف شود.

## SEC-001 — محدودسازی Web Server داخلی به Loopback

**وضعیت ممیزی:** `CONFIRMED_BY_SOURCE`  
**شدت:** بحرانی  
**فایل اصلی:** `src-tauri/src/llm/web_server.rs`

### شواهد

در انتهای فایل، Listener با آدرس `0.0.0.0:{port}` Bind می‌شود. این یعنی سرویس به Interfaceهای شبکه‌ای سیستم هم گوش می‌دهد، نه فقط Loopback. همان Router شامل Session، Chat و Admin API است. کد جاری CORS را با `allow_origin(Any)`, `allow_methods(Any)` و `allow_headers(Any)` تنظیم می‌کند.

### الزامات اصلاح

1. Default Binding باید `127.0.0.1` یا `::1` باشد.
2. Bind روی LAN فقط با اقدام صریح کاربر، Warning روشن و نمایش آدرس قابل‌دسترسی فعال شود.
3. در حالت LAN، Authentication و Authorization اجباری باشد.
4. فقط Originهای دقیق و شناخته‌شده مجاز شوند. `Any` در حالت Production ممنوع است.
5. Admin API به‌صورت پیش‌فرض Disabled باشد.
6. Port انتخابی و Binding Mode در Settings نمایش داده شود.
7. سرویس پس از خاموش‌شدن برنامه Listener و Taskهای پس‌زمینه را متوقف کند.
8. یک تست Integration تأیید کند که حالت Default از IP غیر Loopback قابل‌دسترسی نیست.

### معیار پذیرش

- اجرای برنامه به‌تنهایی Endpoint شبکه‌ای عمومی ایجاد نکند.
- تست از یک Interface غیر Loopback در حالت Default شکست بخورد.
- LAN Mode فقط پس از Consent صریح فعال شود.
- CORS برای Origin نامعتبر رد شود.

## SEC-002 — احراز هویت و مجوزدهی همه Routeهای Web Server

**وضعیت ممیزی:** `STRONG_RISK / CONFIRMED_ROUTE_STRUCTURE`  
**شدت:** بحرانی  
**فایل:** `src-tauri/src/llm/web_server.rs`

### شواهد

Routeهای زیر در Router ثبت شده‌اند:

- `/api/sessions`
- `/api/sessions/{id}`
- `/api/chat`
- `/api/admin/stats`
- `/api/admin/users`
- `/api/admin/activity`
- `/api/admin/users/{id}/sessions`
- `/api/admin/users/{id}` با DELETE
- `/api/admin/sessions/{id}` با DELETE

در مسیرهای کاربری، شناسه از Header موسوم به `X-User-Id` استخراج می‌شود و در برخی مسیرها Cookie/شناسه تولیدشده در Browser هم دخیل است. شناسه‌ای که کلاینت آزادانه در Header بفرستد، Authentication نیست. Routeهای Admin باید جداگانه در برابر Authorization بررسی شوند.

### الزامات اصلاح

1. هویت کاربر باید از Session Token تصادفی و غیرقابل‌حدس یا سازوکار Authentication امن استخراج شود؛ نه از `X-User-Id` قابل جعل.
2. Token حداقل 256-bit تصادفی باشد، در Log ظاهر نشود و به شکل Hash‌شده یا سازوکار امن مناسب نگهداری شود.
3. Sessionها باید Expire، Rotate و Revoke شوند.
4. Authorization برای هر Resource باید مالکیت و Role را سمت Backend بررسی کند.
5. Admin Routeها فقط برای Role ادمین و با Feature Flag مستقل فعال شوند.
6. عملیات حذف User/Session باید CSRF Protection یا روش متناسب با نوع Auth داشته باشند.
7. برای Endpointهای حساس Rate Limit، Request Size Limit و Audit Log اعمال شود.
8. `X-Forwarded-For` و `X-Real-IP` فقط در صورت وجود Proxy مورداعتماد پذیرفته شوند؛ از Header ارسالی کلاینت به‌عنوان IP معتبر استفاده نکن.
9. تست‌های دسترسی غیرمجاز، IDOR، Session Replay، Token Expiry، Role Escalation و Admin Access نوشته شوند.
10. اطلاعات IP، Activity و Chat History به‌عنوان داده حساس تلقی شوند و Retention/Deletion مشخص داشته باشند.

### معیار پذیرش

- درخواست بدون Token معتبر `401` دریافت کند.
- User A نتواند Sessionهای User B را بخواند، تغییر دهد یا حذف کند.
- User عادی نتواند هیچ Admin Endpoint را اجرا کند.
- Token منقضی‌شده و Revoke‌شده رد شوند.

## SEC-003 — سخت‌سازی CSP و Capabilityهای Tauri

**وضعیت:** `CONFIRMED_BY_SOURCE`  
**شدت:** بالا تا بحرانی  
**فایل‌ها:** `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml`

### یافته‌ها

- `tauri.conf.json` مقدار CSP را `null` قرار داده است.
- `default.json` مجوز Fetch برای `https://**` و HTTP محلی را مجاز می‌کند.
- در `Cargo.toml` قابلیت `devtools` به Dependency اصلی Tauri اضافه شده است.

### الزامات

1. CSP Production با توجه به منابع واقعی برنامه تنظیم شود؛ نه با Copy/Paste یک Policy عمومی.
2. `connect-src`, `img-src`, `font-src`, `style-src`, `script-src`, `object-src`, `frame-src` و `base-uri` مشخص شوند.
3. `unsafe-eval` و `unsafe-inline` بدون ضرورت اثبات‌شده استفاده نشوند.
4. اگر App به Providerهای LLM متصل می‌شود، Domainهای لازم از طریق Network Service محدود و قابل‌کنترل باشند؛ مجوز عمومی HTTPS برای همه Contextها راه‌حل پیش‌فرض نباشد.
5. DevTools در Build نهایی به‌صورت ناخواسته فعال نباشد. تفاوت Debug/Release صریح و Test شود.
6. Capabilityها به چند سطح محدود تقسیم شوند: Main Window، Local File Import، External Link، Model Download و Network Provider.
7. مجوز فایل فقط به مسیر انتخاب‌شده کاربر یا Workspace تأییدشده اعمال شود.
8. اسناد Security توضیح دهند هر Permission چرا لازم است.

### معیار پذیرش

- Build Release با CSP فعال اجرا شود.
- هیچ Command غیرضروری به Frontend عمومی در دسترس نباشد.
- تست منفی برای URL، Path و Permission خارج از Scope وجود داشته باشد.

## SEC-004 — رمزنگاری مدل‌های AI: حذف کلید و IV مشتق‌شده ثابت

**وضعیت:** `CONFIRMED_BY_SOURCE`  
**شدت:** بالا  
**فایل:** `src-tauri/src/crypto.rs`

### یافته

در `crypto.rs` مسیر `AES-CBC` وجود دارد و یک Salt/Signature ثابت در Source برای مشتق‌سازی Default Key و IV ثابت/Deterministic استفاده شده است. چنین کلیدی در نرم‌افزار Client قابل استخراج است و نباید به‌عنوان حفاظت قوی از وزن مدل تلقی شود. AES-CBC به‌تنهایی Authentication/Integrity را فراهم نمی‌کند.

در مقابل، `provider_secrets.rs` مسیر دیگری برای ذخیره Provider Secrets دارد که OS Keyring را در اولویت می‌گذارد و در Fallback از AES-256-GCM با Machine-derived key استفاده می‌کند؛ Comment آن نیز محدودیت مقاومت در برابر مهاجم دارای دسترسی به Code و Disk را تصریح می‌کند. این دو مسیر را با یکدیگر اشتباه نگیر.

### الزامات اصلاح

1. فرمت جدید مدل رمز‌شده باید AEAD مانند AES-256-GCM یا XChaCha20-Poly1305 باشد.
2. Nonce برای هر فایل/نسخه به‌صورت CSPRNG و غیرتکراری تولید شود؛ هرگز از Hash کلید، نام محصول یا IV ثابت استفاده نشود.
3. Header فرمت باید شامل Magic، Version، Algorithm ID، Nonce، Salt در صورت نیاز، Key ID، مدل Metadata و Authentication Tag باشد.
4. AAD باید Metadata حساس به Tampering مانند Model ID، Version و Content Type را احراز کند.
5. Key Derivation با Argon2id یا سازوکار مناسب فقط برای Passphrase کاربر؛ برای کلیدهای اپلیکیشن از OS Keychain/Keyring یا سرویس صدور کلید استفاده شود.
6. کلید Master محرمانه داخل Source Code یا Binary ثابت قرار نگیرد.
7. فرمت قدیمی فقط برای Decrypt/Migrate خوانده شود؛ فایل جدید با CBC نوشته نشود.
8. مهاجرت اتمیک باشد: ابتدا Decrypt و Verify در فایل موقت، سپس اعتبارسنجی، سپس Rename اتمیک؛ فایل قدیمی تا موفقیت کامل حفظ شود.
9. مدل بعد از Decrypt از نظر Hash، Size و Schema اعتبارسنجی شود.
10. حافظه حاوی Key با Zeroize پاک شود؛ Secret در Debug Log چاپ نشود.
11. Documentation صریحاً بگوید Encryption داخل Client مانع قطعی استخراج Weight توسط مالک دستگاه نمی‌شود. برای محافظت واقعی از IP مدل، Server-side Inference یا Licensing/Key Delivery مناسب لازم است.

### معیار پذیرش

- تغییر یک بیت از Ciphertext یا Metadata احراز‌شده باعث شکست Decrypt شود.
- Nonceهای تصادفی در چند Encrypt مستقل تکراری نباشند.
- تست Compatibility برای فایل‌های قدیمی موجود باشد.
- هیچ کلید/IV پیش‌فرض محرمانه در Source یا Release Binary ثابت نباشد.

## WSI-001 — پیاده‌سازی Native Whole-Slide Reader واقعی

**وضعیت:** `IMPLEMENTED_PARTIAL`؛ Native WSI I/O هنوز اثبات نشده  
**شدت:** بحرانی  
**فایل:** `src-tauri/src/wsi/reader.rs`

### یافته

در Reader موسوم به `PyramidalSlideReader`، مسیر Decode از `image::ImageReader::open(...).decode()` استفاده می‌کند و خروجی را در `DynamicImage` کامل نگه می‌دارد. `build_pyramid_levels()` ابعاد را به‌صورت محاسباتی نصف می‌کند. Factory نیز با پسوندهایی مانند SVS/NDPI/MRXS همین Reader را انتخاب می‌کند. تشخیص پسوند، Native Decoder نیست.

### معماری لازم

یک Trait مستقل تعریف کن که مفهوم Reader را به Format خاص وابسته نکند:

```rust
pub trait ImageSource: Send + Sync {
    fn metadata(&self) -> Result<SlideMetadata, ImageReadError>;
    fn levels(&self) -> Result<Vec<PyramidLevelInfo>, ImageReadError>;
    fn read_region(&self, request: RegionRequest) -> Result<PixelBuffer, ImageReadError>;
    fn read_tile(&self, request: TileRequest) -> Result<TileBuffer, ImageReadError>;
    fn thumbnail(&self, request: ThumbnailRequest) -> Result<TileBuffer, ImageReadError>;
    fn close(&mut self) -> Result<(), ImageReadError>;
}
```

این Interface نمونه قراردادی است؛ Agent باید Ownership، Thread Safety، Error Type و Lifetimes را با نسخه واقعی Rust تنظیم کند.

### Backendهای پیشنهادی

- `OpenSlideReader`: برای فرمت‌های WSI مورد پشتیبانی OpenSlide.
- `BioFormatsAdapter`: برای فرمت‌های میکروسکوپی متنوع که از مسیر Native Rust در دسترس نیستند؛ فقط در صورتی که بسته‌بندی Runtime و License قابل‌قبول باشد.
- `OmeTiffReader`: برای OME-TIFF استاندارد با خواندن Region/Tile و Metadata.
- `OmeZarrReader`: برای Chunk/Multiscale Arrays و Datasetهای NGFF.
- `StandardRasterReader`: فقط برای Raster معمولی، نه به‌عنوان WSI Decoder.

### الزامات دقیق

1. `PyramidalSlideReader` موجود را به Reader واقعی تبدیل کن یا نام و قرارداد آن را اصلاح کن تا ادعای Native Pyramid نداشته باشد.
2. ابعاد Levelها، Downsample، Tile Size و Tile Count از Decoder واقعی دریافت شوند؛ ساخت Pyramid مصنوعی فقط برای Raster معمولی و با Flag صریح قابل استفاده باشد.
3. `is_pyramidal` تنها وقتی True باشد که فایل/Backend واقعاً چندسطحی را تأیید کرده باشد.
4. `read_region` باید از مختصات Level 0 و سطح موردنیاز درست استفاده کند.
5. فایل بزرگ نباید به‌طور کامل در RAM Decode شود.
6. Reader باید Tile/Region را On-demand بخواند.
7. فایل خراب، فایل Truncated، Metadata ناقص، سطح بدون داده و فرمت ناشناخته Error قابل‌فهم داشته باشند.
8. Reader فقط بر اساس Extension تصمیم نگیرد؛ Signature/Magic، Metadata و قابلیت Decoder نیز بررسی شوند.
9. فرمت‌های نامعتبر نباید به‌عنوان SVS/NDPI/MRXS پذیرفته شوند.
10. Metadata خام حفظ شود، اما Metadata نرمال‌شده و قابل استفاده توسط UI جدا باشد.
11. OpenSlide و Adapterهای Native از نظر مجوز کتابخانه و الزامات Distribution بررسی شوند؛ وابستگی LGPL/Native Runtime در بسته‌بندی Windows/macOS/Linux مستند شود.
12. فایل مرجع و Test Fixtureهای کوچک/قانونی برای هر Vendor داشته باش.

### تست‌ها و معیار پذیرش

- حداقل یک SVS واقعی، یک NDPI واقعی، یک MRXS واقعی و یک OME-TIFF Pyramid با License مناسب در CI یا Test Lab بررسی شوند.
- ابعاد، MPP، Level count و Thumbnail با Reader مستقل مرجع مقایسه شوند.
- درخواست یک Tile در Level 0 نباید نیازمند Decode کل اسلاید باشد.
- Memory Profiling روی اسلاید بسیار بزرگ انجام شود؛ افزایش RAM باید با Tile/Cache Budget قابل‌کنترل باشد، نه با کل پیکسل‌های Slide.
- تست Tileهای لبه، ناحیه خارج تصویر، مختصات منفی، Overflow و Level نامعتبر وجود داشته باشد.
- در صورت عدم امکان پشتیبانی یک فرمت، UI آن را صریحاً Unsupported اعلام کند؛ پسوند پذیرفته‌شده نباید پشتیبانی جعلی القا کند.

## WSI-002 — حفظ و اعتبارسنجی Metadata اسلاید

**شدت:** بالا

### الزامات

Metadata را به دو بخش تقسیم کن:

- `RawMetadata`: تمام Tags اصلی با Namespace، Source، Data Type و Value.
- `NormalizedMetadata`: نام نرمال، مقدار، واحد، Confidence و منبع استخراج.

فیلدهای ضروری:

- Vendor / Scanner Model / Scanner Serial (در صورت موجودبودن و با Privacy policy).
- Objective Magnification و Numerical Aperture.
- MPP-X و MPP-Y جداگانه.
- Pyramid level dimensions و downsample factors واقعی.
- Pixel Type، Channel Count، ICC Profile.
- Acquisition Date و timezone در صورت وجود.
- Stain/Slide Metadata در صورت وجود.
- Image Orientation / Origin / Physical Units.
- OME Dimension Order و Plane mapping.

### معیار پذیرش

- Metadata نامعلوم Unknown بماند.
- مقدار استخراج‌شده منبع و Confidence داشته باشد.
- مقدارهای MPP غیرمتناهی، صفر/منفی، خارج از دامنه معقول یا ناسازگار رد یا Flag شوند.
- UI بین «Metadata واقعی» و «مقدار کاربر واردشده» تفاوت بگذارد.

## CAL-001 — اصلاح Calibration و Measurement فیزیکی ROI

**وضعیت:** `CONFIRMED_BY_SOURCE`  
**شدت:** بحرانی  
**فایل‌ها:** `src-tauri/src/roi/measurement.rs`, `src-tauri/src/roi/manager.rs`, `src-tauri/src/scientific_models/scientific_image.rs`

### یافته

`MeasurementEngine::measure()` در حال حاضر Perimeter و هر دو Feret را با `pixel_size_x` ضرب می‌کند. این برای Calibration ناهمسانگرد صحیح نیست. در Manager، اگر Calibration ارسال نشود، امکان استفاده از Default وجود دارد؛ Default یک Calibration معتبر فیزیکی نیست، اما باید تضمین شود که مقادیر آن به‌عنوان µm نمایش داده نشوند.

### الزامات

1. همه محاسبات هندسی فیزیکی باید از مختصات تبدیل‌شده به Physical Space انجام شوند.
2. برای هر نقطه `(x,y)` تبدیل جداگانه X و Y اعمال شود؛ سپس Perimeter، Feret و سایر اندازه‌ها روی مختصات فیزیکی محاسبه شوند.
3. Area با `pixel_size_x * pixel_size_y` محاسبه شود.
4. Centroid فیزیکی با Origin/Orientation در صورت پشتیبانی از آن‌ها محاسبه شود.
5. در نبود Calibration معتبر، فیلد فیزیکی `None/Unknown` باشد، نه `0` یا عددی که واقعی به نظر برسد.
6. واحد اندازه‌گیری صریحاً ثبت شود: px، µm، mm یا واحد دیگر.
7. Calibration از منبع مشخص بیاید: Scanner Metadata، OME Metadata، User Calibration، یا Unknown.
8. کاربر هنگام Calibration دستی، فاصله مرجع، تعداد پیکسل و واحد را وارد کند؛ نرم‌افزار مقدار و منبع را در Project ثبت کند.
9. اختلاف MPP-X و MPP-Y حفظ شود؛ هرگز میانگین‌گیری خاموش انجام نشود.
10. `roi_add` و `roi_update` باید Calibration/Slide Context را از Asset مرتبط دریافت کنند و با `unwrap_or_default` به‌صورت خاموش جایگزین نکنند.
11. اگر ROI از یک Slide به Slide دیگر منتقل می‌شود، تغییر Calibration و Coordinate Transform صریح باشد.
12. نسخه الگوریتم Measurement و Calibration در نتیجه ذخیره شود.

### تست‌های عددی اجباری

- Pixel size برابر X=0.25 µm و Y=0.50 µm.
- Rectangle با عرض 100px و ارتفاع 100px.
- Area مورد انتظار: 100 × 100 × 0.25 × 0.50 = 1250 µm².
- Perimeter فیزیکی مورد انتظار: 2 × (100×0.25 + 100×0.50) = 150 µm.
- تست Feret روی Segment افقی، عمودی و زاویه‌دار.
- تست Calibration ناموجود: هیچ خروجی µm یا µm² تولید نشود.

## DATA-001 — جلوگیری از Overflow در Dimensions و Buffer Size

**شدت:** بحرانی برای فایل‌های بزرگ/ورودی مخرب

### یافته

محاسبه `total_samples()` در `scientific_image.rs` حاصل‌ضرب ابعاد را بدون `checked_mul` محاسبه می‌کند. ابعاد فایل، Metadata و Array Size ورودی غیرقابل‌اعتماد محسوب شوند.

### الزامات

1. تمام Multiplicationهای Dimension با `checked_mul` انجام شوند.
2. محدودیت حداکثر Dimensions، Bytes، Channels، Z و T براساس Resource Budget داشته باش.
3. پیش از تخصیص Buffer، Memory Budget و OS Allocation بررسی شود.
4. `stride`، alignment و channel packing بخشی از Buffer Layout باشند.
5. Array Length، Pixel Count و Expected Bytes هنگام Import اعتبارسنجی شوند.
6. Overflow، Allocation Failure و Truncated Data Error Type مشخص داشته باشند.
7. `usize` و Serialization روی سیستم‌های 32/64-bit با تست‌های مناسب بررسی شوند.

### معیار پذیرش

- ورودی Dimension با حاصل‌ضرب سرریزکننده هیچ‌گاه Panic یا Allocate اشتباه نکند.
- فایل با Header جعلی و اندازه بسیار بزرگ پیش از Allocate رد شود.

---

# 4. اصلاحات Scientific Data Model و Image I/O

## DATA-002 — حفظ کامل Bit Depth و جلوگیری از Lossy Import

**وضعیت:** `IMPLEMENTED_PARTIAL`  
**شدت:** بالا  
**فایل:** `scientific_models/scientific_image.rs`, `commands/scientific_image.rs`

### یافته

Typed Buffer انواع زیادی تعریف می‌کند، اما مسیر `from_dynamic_image` برای دسته‌ای از DynamicImageهای پشتیبانی‌نشده به RGB8 تبدیل می‌شود. این مسیر می‌تواند اطلاعات bit-depth، float یا channel data را از دست بدهد. از طرف دیگر، Decode فعلی بسیاری از Readerها بر اساس `image` crate است.

### الزامات

1. Import باید قبل از تبدیل، Pixel Type اصلی را تشخیص دهد.
2. U16 نباید به U8 تبدیل شود مگر با درخواست صریح کاربر.
3. F32/F64 نباید Normalize و Overwrite شوند؛ Normalize فقط در Display Pipeline اعمال شود.
4. RGB/RGBA و Multichannel علمی از هم تفکیک شوند. «سه کانال» الزاماً RGB نیست.
5. Alpha Channel حفظ و معنای آن ثبت شود.
6. Endianness، Planar/Interleaved Layout و Row Stride مشخص باشند.
7. Signed Pixel Typeها با unsigned جابه‌جا نشوند.
8. Conversionها باید با نام مشخص (مثلاً `convert_to_u8_preview`) و Provenance قابل‌ردیابی انجام شوند.
9. LUT/Display Range به Pixel Data اصلی دست نزند.
10. Import Summary پس از بازشدن فایل، Pixel Type، Dimensions، Channels، Calibration و هشدارهای احتمالی را نمایش دهد.

### معیار پذیرش

- Round-trip برای U8، U16، I16، U32، I32، F32 و F64 روی Fixtureها بدون Loss ناخواسته.
- Hash/Checksum با داده‌های مرجع مقایسه شود.
- تست RGB، RGBA، Grayscale، Multi-channel و Indexed جداگانه وجود داشته باشد.

## DATA-003 — محورهای N-D عمومی و Plane Model

**شدت:** بالا

### الزامات

1. مدل تصویر فقط به تعداد ثابت ترکیب‌های `AxisOrder` محدود نشود؛ محورهای عمومی با نام، اندازه، ترتیب، واحد و مختصات داشته باش.
2. X، Y، Z، C، T و در صورت نیاز Axisهای اضافه مثل Position، Scene یا Mosaic قابل‌نمایش باشند.
3. Plane Indexing و Coordinate Transform مشخص داشته باشند.
4. Metadata محور و Time Increment نگهداری شوند.
5. Viewer بتواند C/Z/T را مستقل کنترل کند.
6. Stack Projection روی محور مشخص، با Method و Param ثبت شود.
7. Resample بین محورهای مختلف باید Interpolation مناسب Pixel Type/Label انتخاب کند.

## DATA-004 — Histogram و Statistics چندکاناله واقعی

### الزامات

1. Histogram برای هر Channel، Z Plane، Time Point و ROI قابل محاسبه باشد.
2. Global Histogram فقط به‌عنوان Aggregate با عنوان روشن نمایش داده شود.
3. شمارنده Binها از نوعی باشد که برای تعداد پیکسل بالا Overflow نکند؛ `u64` یا Accumulator مناسب.
4. Histogram برای U8، U16 و Float با Bin Strategy مشخص کار کند.
5. Float Data به‌صورت خودکار به 256 Bin U8 تبدیل نشود.
6. Statistics شامل Count، Min، Max، Mean، Median، Variance، StdDev و Percentiles باشد.
7. NaN/Inf و Masked Pixels رفتار مستند داشته باشند.
8. ROI Statistics بر اساس Mask معتبر و Coordinate System مشخص محاسبه شود.

## IO-001 — OME-TIFF و OME-Zarr Interoperability

**شدت:** بالا / مزیت رقابتی

### الزامات

1. OME-TIFF Reader/Writer با Dimension Order، Channel Metadata، Physical Size، Plane Metadata و XML Metadata.
2. OME-Zarr Reader/Writer با Multiscale، Chunking، Axis Metadata، Coordinate Transformations، Labels و Image Metadata طبق نسخه Schema پشتیبانی‌شده.
3. نسخه Specification که پیاده‌سازی می‌شود به‌صورت صریح در Documentation ثبت شود؛ در تاریخ این ممیزی، نسخه 0.6 در مستندات OME-NGFF دیده می‌شود، اما Agent باید پیش از پیاده‌سازی نسخه جاری را دوباره بررسی کند.
4. Chunk cache محدود، Prefetch و Range Read در صورت پشتیبانی Source.
5. OME-Zarr باید برای Local Directory و بعداً Remote Object Store قابل توسعه باشد؛ Remote صرفاً با Opt-in و Authentication امن.
6. Writer باید فایل خروجی را با Schema Validator و Reader مستقل اعتبارسنجی کند.
7. داده خام، Labels و Tables ارتباط بین‌فایلی مشخص داشته باشند.
8. Metadata غیرقابل‌نگاشت حذف خاموش نشود؛ در Export Report فهرست شود.

## IO-002 — DICOM Whole Slide Microscopy

**اولویت:** P2، پس از تکمیل WSI پایه

1. بررسی DICOM WSI و SOP Classهای مربوطه.
2. خواندن Pyramid/Frames/Tiles، Optical Paths، Focal Planes و Metadata.
3. ارتباط با DICOM Metadata باید استاندارد و قابل‌اعتبارسنجی باشد.
4. اطلاعات شناسایی بیمار باید در UI/Export با Privacy Controls مدیریت شود.
5. De-identification فقط با Preview، Log و عدم دستکاری فایل اصلی.
6. DICOM Writer فقط پس از پیاده‌سازی کامل و Validation استاندارد فعال شود.

---

# 5. WSI Viewer، Tile Engine و Performance

## WSI-003 — Tile Transport بدون Base64 Data URL برای جریان پرتعداد

**وضعیت:** نیازمند Optimization/Benchmark  
**شدت:** بالا

### مسئله

مسیر فعلی Tile در Command می‌تواند Tile را به Base64 Data URL تبدیل کند. این روش در Tileهای پرتعداد، حافظه و IPC بیشتری مصرف می‌کند و ممکن است باعث String Allocation و GC Pressure شود.

### الزامات

1. Benchmark واقعی Base64 در برابر Binary Asset Protocol یا انتقال Binary مناسب Tauri انجام بده.
2. در صورت مفیدبودن، Tile به‌صورت Binary/Asset برگردد و Frontend بدون Base64 Decode آن را Render کند.
3. Tile Cache از `Arc<[u8]>`/Bytes یا مالکیت اشتراکی مناسب برای کاهش Clone استفاده کند.
4. Cache Key باید شامل Slide ID، Source Version، Level، X، Y، Tile Size، Channel/Layer، Transform و Render Parameters باشد.
5. Cache Invalidation پس از تغییر Source، LUT، Channel یا Processing Layer انجام شود.
6. UI هنگام درخواست جدید، Tileهای قدیمی مربوط به Viewport قبلی را با نسل Request/Generation ID کنار بگذارد.
7. خطای Tile نباید کل Viewer را Crash کند.

### معیار پذیرش

- Benchmark 100، 500 و 1000 Tile در هر Session.
- اندازه حافظه، CPU، Copy Count و Frame Time ثبت شود.
- نتیجه مقایسه قبل/بعد ضمیمه شود.

## WSI-004 — Cache Policy و Memory Budget

### الزامات

1. Cache محدود بر اساس Byte Budget، نه فقط تعداد Tile.
2. LRU یا سیاست مناسب با O(1) در Get/Promote در صورت نیاز.
3. Cache Levelهای مختلف و Thumbnail و Rendered Tile از هم تفکیک شوند.
4. Memory Pressure از OS یا Application Budget دریافت شود.
5. Memory Eviction مرحله‌ای و قابل‌مشاهده باشد.
6. User بتواند Cache Budget را از Settings تنظیم کند؛ Default متناسب با RAM و قابل‌اعتماد باشد.
7. Hard Cap مستقل برای RAM و GPU VRAM وجود داشته باشد.
8. از Unbounded Clone یا HashMapهای بدون Eviction جلوگیری شود.
9. Cache Metrics شامل Hit Rate، Miss Rate، Eviction Count، Bytes Resident و Decode Latency باشد.

## WSI-005 — Tile Scheduler و Viewport Coordinate Correctness

### الزامات

1. تبدیل Coordinate Screen ↔ Level 0 ↔ Pyramid Level دقیق و تست‌شده باشد.
2. Zoom Anchor بر اساس Cursor حفظ شود.
3. Pan با Transform Matrices پایدار باشد.
4. Device Pixel Ratio در محاسبه Canvas دخیل باشد.
5. Tileهای اطراف Viewport بر اساس Priority بارگیری شوند.
6. Prefetch در جهت حرکت انجام شود، اما قابل‌لغو و محدود باشد.
7. درخواست‌های قدیمی هنگام Pan/Zoom سریع Cancel یا Deprioritize شوند.
8. Clamp ناحیه به حدود تصویر انجام شود.
9. Tileهای جزئی لبه، Overlap و اختلاف ابعاد Level صحیح Render شوند.
10. Scheduler در Zoom بسیار بالا و پایین، NaN/Infinity یا تعداد Tile غیرمعقول تولید نکند.

## WSI-006 — Viewer Layers و Rendering Pipeline

Viewer باید Layer-based باشد و هر Layer نوع و تنظیمات مشخص داشته باشد:

- Base Image.
- Channel Image.
- Segmentation Mask.
- Probability Map.
- ROI/Annotation.
- Detection Boxes / Centroids.
- Heatmap.
- Registration Overlay.
- Measurement Guides.
- Scale Bar / Grid / Coordinate Axes.

### قابلیت‌های الزامی

1. Visibility Toggle و Opacity مستقل.
2. Blend Modeهای استاندارد و آزمایش‌شده.
3. LUT و Channel Color.
4. Layer Reordering و Grouping.
5. انتخاب Layer فعال برای ابزارهای ROI/Brush.
6. Lock/Unlock لایه.
7. Layer Source و Provenance.
8. نمایش Legend و Color Scale برای Probability/Heatmap.
9. عدم مخلوط‌کردن Pixel Data و Render State.
10. نمایش Overlay باید با Pan/Zoom و Pyramid Level دقیقاً همگام بماند.

## WSI-007 — Viewer Navigation و Accessibility

1. Pan، Zoom to Cursor، Fit Slide، Actual Pixel، Zoom Presets.
2. Overview/Navigator Map با Viewport Indicator.
3. Scale Bar مبتنی بر Calibration معتبر.
4. Coordinates به شکل Pixel و Physical؛ در نبود Calibration فقط Pixel.
5. Keyboard Shortcuts قابل‌تنظیم و نمایش Command Palette.
6. High-DPI، Multi-Monitor و Window Resize تست شوند.
7. ابزار Pan و Selection در هر شرایط از هم قابل‌تشخیص باشند.
8. Reduce Motion و کاهش افکت‌های تزئینی قابل انتخاب باشد.
9. Color Contrast و Keyboard Navigation بررسی شود.
10. Context Menu فقط در سطحی که نیاز است کنترل شود؛ جلوگیری سراسری از کلیک راست راه‌حل امنیتی نیست.

---

# 6. Image Processing و Scientific Computation

## PROC-001 — Typed Processing واقعی

**وضعیت:** `IMPLEMENTED_PARTIAL`  
**شدت:** بالا

### یافته

برخی Commandهای Filter فقط U8/RGB/RGBA را می‌پذیرند؛ Threshold هم در مسیر بررسی‌شده به U8/RGB تبدیل می‌کند. این رفتار با ادعای Scientific Typed Buffer عمومی سازگار نیست.

### الزامات

1. Processing API باید بر اساس Pixel Type Generic یا Trait-based باشد.
2. U8/U16/I16/U32/I32/F32/F64 و RGB/RGBA پشتیبانی هدف باشند.
3. الگوریتم باید Pixel Domain و Display Domain را جدا نگه دارد.
4. تبدیل نوع داده تنها با Conversion Operation مشخص و ثبت‌شده صورت گیرد.
5. Threshold روی U16/F32 باید آستانه را در واحد/Range واقعی داده بگیرد.
6. NaN/Inf، Signed Range و Saturation مشخص باشند.
7. Arithmetic Overflow و Clipping Policy مستند شوند.
8. دقت محاسباتی خروجی و نوع خروجی با API مشخص شود.

## PROC-002 — پردازش Tile-based با Halo و Border Policy

1. عملیات Local مثل Blur/Median/Morphology روی Tile با Halo مناسب اجرا شوند.
2. Halo Width بر اساس Kernel Radius باشد.
3. Border Policy (Reflect/Replicate/Constant/Wrap) مشخص و UI قابل‌فهم باشد.
4. درز بین Tileها باید با آزمون Seam Detection بررسی شود.
5. Global Operations مانند Histogram/Normalization به چند مرحله Map/Reduce تبدیل شوند.
6. Output Tiled به صورت Lazy یا Chunked ذخیره شود.
7. لغو پردازش در مرز Tile و داخل Kernelهای زمان‌بر پشتیبانی شود.
8. نتیجه مستقل از ترتیب Thread/Tile باشد، مگر الگوریتم ذاتاً غیرقطعی باشد و این موضوع ثبت شود.

## PROC-003 — ImageJ-like Core Operations

قابلیت‌ها را در دسته‌های زیر پیاده‌سازی و تست کن:

### Geometry / Transform

- Crop، Resize، Resample، Rotate، Flip، Translate.
- Affine Transform و در صورت نیاز Perspective Transform.
- Nearest، Bilinear، Bicubic و مناسب‌ترین Interpolation برای داده.
- Label Mask باید از Nearest Neighbor استفاده کند؛ Mask نباید با Bilinear به Labelهای نامعتبر تبدیل شود.
- Transform Matrix و Inverse ثبت شوند.

### Enhancement / Display

- Brightness، Contrast، Gamma.
- Min/Max، Percentile، Auto Contrast.
- Histogram Equalization و CLAHE.
- LUTهای Grayscale و Pseudocolor.
- Normalize فقط با گزینه مشخص و به‌صورت Derived Asset.

### Filters

- Mean، Gaussian، Median، Bilateral در صورت پیاده‌سازی معتبر.
- Sharpen، Unsharp Mask، Laplacian.
- Edge Detection مانند Sobel/Canny با خروجی و واحد مشخص.
- Denoise مناسب میکروسکوپی.

### Morphology

- Erosion، Dilation، Opening، Closing.
- Top-hat، Bottom-hat.
- Distance Transform.
- Skeletonize/Thinning.
- Structuring Elementهای Disk/Square/Line و اندازه فیزیکی یا پیکسلی.

### Segmentation / Components

- Fixed/Auto Threshold.
- Otsu، Triangle، Yen و روش‌های قابل‌اعتبارسنجی.
- Region Growing.
- Connected Components با 4/8 connectivity برای 2D و Connectivity مناسب 3D.
- Watershed و Marker-controlled Watershed.
- Hole Filling و Remove Small Objects.

### Stack Operations

- Z-Projection: Maximum، Mean، Sum، Median.
- Channel Split/Merge.
- Time Projection و Temporal Difference.
- Batch Stack Processing.

### معیار پذیرش

برای هر الگوریتم:

- تعریف ورودی/خروجی و Pixel Type.
- Reference Implementation یا Golden Dataset.
- Expected Output و Numerical Tolerance.
- Edge Case.
- Performance Test.
- UI Parameter Validation.
- Provenance Record.

## HISTO-001 — Stain Deconvolution قابل‌اعتماد H&E و H-DAB

**شدت:** بالا / هسته تخصص پاتولوژی

### الزامات

1. Stain Matrix و Stain Vector به‌عنوان Profile نسخه‌دار ذخیره شوند.
2. Presetهای H&E و H-DAB با Source و دامنه اعتبار مشخص ارائه شوند؛ هیچ Preset جهان‌شمولی برای تمام Scanner/Stainها فرض نشود.
3. Optical Density Conversion با Background/White Reference درست انجام شود.
4. ورودی RGB/RGBA، Bit Depth، ICC Profile و Color Space بررسی شوند.
5. امکان Estimate Stain Vectors از Region منتخب و امکان اصلاح دستی باشد.
6. Matrix Condition/Invertibility بررسی شود؛ ماتریس بدشکل با پیام روشن رد شود.
7. خروجی کانال‌های Stain جداگانه، Normalization و Provenance داشته باشد.
8. Color Deconvolution نباید داده اصلی را Overwrite کند.
9. Color Profile و White Balance قابل‌ردیابی باشند.
10. تست H&E و H-DAB با نمونه‌های متنوع و مقایسه با خروجی مرجع انجام شود.

## HISTO-002 — Tissue Detection و Tissue Mask پیشرفته

### قابلیت‌ها

1. Threshold ساده فعلی به‌عنوان Baseline حفظ شود؛ اما تنها روش Tissue Detection نباشد.
2. روش‌های Color/OD-based، Saturation/Luminance-based و مدل AI قابل‌انتخاب باشند.
3. Mask smoothing، Hole filling، Remove islands و Tissue region merging داشته باشد.
4. Artifact regions مانند pen marks، folds، blur، bubbles و background مشخص شوند.
5. ROIهای Tissue، Background و Artifact طبقه‌بندی جدا داشته باشند.
6. Mask Preview و Confidence قابل مشاهده باشد.
7. Threshold به‌صورت Slide-specific قابل تنظیم و ذخیره شود.
8. در Batch، اختلاف Staining و Scanner با QC هشدار داده شود.

## HISTO-003 — Morphometry دقیق و مقیاس‌پذیر

1. Area/Perimeter/Shape Metrics برای Mask و Objectها.
2. Nuclear area، eccentricity، solidity، circularity، aspect ratio، Feret، compactness.
3. Mean/Median/SD/Percentile Intensity per channel.
4. Cell/Nucleus Cytoplasm Ratio در صورت Segmentation مناسب.
5. Gland/Lumen/Structure Quantification.
6. Tissue compartment ratios.
7. اندازه‌گیری‌ها هم در Pixel و هم Physical با Calibration معتبر.
8. Object IDs پایدار و رابطه Parent/Child بین Nucleus، Cell و Tissue Region.
9. توصیف دقیق اینکه Feature از Mask، Boundary یا Intensity محاسبه شده است.
10. عدم استفاده از Average RGB به‌عنوان جایگزین بی‌قیدوشرط برای Channel/Intensity علمی.

## HISTO-004 — Slide Quality Control و Artifact Detection

قابلیت بسیار ارزشمند و تمایزدهنده‌ای است که باید قبل از ادعای تحلیل گسترده AI به آن توجه شود.

### QCهای پیشنهادی

- Focus / Blur Score در سطح Tile و Slide.
- Tissue Coverage و Tissue Fragmentation.
- Fold Detection.
- Bubble / Air Pocket Detection.
- Pen Mark / Ink Detection.
- Dust / Debris / Stain Precipitate.
- Scanner Stripe / Stitching Artifact.
- Over/Under-staining و Color Drift.
- Missing Tissue / Tissue Edge / Scan Border.
- Compression Artifact.

### خروجی

برای هر Slide و Region:

- نوع مشکل.
- مختصات Region.
- Severity و Confidence.
- الگوریتم/مدل و Version.
- امکان Mark as False Positive.
- Quality Summary قبل از اجرای AI.

**معیار پذیرش:** QC خروجی را به‌صورت Overlay و Report ارائه دهد؛ کاربر بتواند Warning را تأیید/رد کند و نتایج قابل Export باشند.

---

# 7. ROI، Annotation و Pathology Objects

## ROI-001 — Annotation Persistence و Identity

1. هر ROI شناسه UUID پایدار داشته باشد.
2. ROI به Project ID، Dataset ID، Slide ID، Asset ID، Coordinate Space و Calibration مرتبط باشد.
3. مختصات مرجع برای WSI در Level 0 ذخیره شوند؛ Display Coordinates فقط برای View باشند.
4. Shape Typeها: Rectangle، Ellipse، Polygon، Polyline، Point، MultiPoint، Freehand، Brush Mask و Label Region.
5. Featureها: Name، Class، Color، Tags، Notes، CreatedBy، CreatedAt، ModifiedAt، Locked، Hidden و Parent ROI.
6. Annotation History باید قبل/بعد تغییر را نگه دارد؛ فقط Snapshot نهایی کافی نیست.
7. Geometry Validation برای Polygon خودمتقاطع، نقطه تکراری، Bounding Box نامعتبر و مختصات خارج از Slide.
8. امکان Group، Duplicate، Copy/Paste و Batch Edit.
9. ROIها در Close/Reopen پروژه حفظ شوند.
10. هر تغییر همراه با Calibration و App/Algorithm Version ثبت شود.

## ROI-002 — Measurement Engine و Spatial Units

- Pixel Area/Length.
- Physical Area/Length.
- Feret Max/Min.
- Circularity/Compactness.
- Aspect Ratio.
- Centroid.
- Perimeter.
- Intensity Statistics.
- Distance to Object/Boundary.
- Overlap/Intersection/Union.
- Count per mm² و Density per calibrated unit.

همه فیلدها باید `validity` و `unit` داشته باشند. مقدار ناموجود با صفر یکسان نیست.

## ROI-003 — Annotation Interoperability

### Import/Exportهای لازم

1. ImageJ ROI (`.roi`) و ROI ZIP.
2. QuPath-compatible GeoJSON با حفظ Object Class و Hierarchy تا حدی که Standard اجازه دهد.
3. OME-XML ROI.
4. GeoJSON برای Geometryهای سازگار؛ Export Report برای اطلاعات غیرقابل‌نگاشت.
5. CSV/TSV برای جدول Measurementها.
6. JSON Native کامل برای TissueAI.
7. خروجی Raster Mask با Label ID، Color/Palette و Metadata.
8. تبدیل مختصات بین Pixel، Physical و WSI Level 0.
9. Schema Validation برای XML/JSON/GeoJSON.
10. XML با Library/Writer امن تولید شود؛ String Interpolation مستقیم برای Name/Color/Attribute ممنوع است.

### معیار پذیرش

- Round-trip Import → Export → Import با حفظ Geometry و IDs تا جای ممکن.
- نام دارای `&`, `"`, `<`, Unicode و کاراکترهای خاص خروجی XML را خراب نکند.
- Export در نرم‌افزار مرجع باز شود.
- اختلافات Format Mapping گزارش شوند.

## ROI-004 — Annotation Review و Inter-Observer Agreement

قابلیت مهم برای پژوهش و اعتبارسنجی:

1. چند Reviewer بتوانند Annotationهای جداگانه داشته باشند.
2. ادغام Annotation با نسخه‌های مستقل و جلوگیری از Overwrite.
3. Compare و Consensus/Adjudication Workflow.
4. Confusion Matrix و Agreement Metric در صورت وجود Label Ground Truth.
5. Cohen's Kappa، Dice، IoU و Boundary Metrics با شرایط استفاده مشخص.
6. User/Reviewer ID و Timestamp قابل‌ردیابی.
7. اختلافات Annotation قابل Visualize باشد.
8. پروژه‌های آموزشی/Research Dataset قابل Export باشند.

---

# 8. AI Model Platform و Inference واقعی

## AI-001 — End-to-End Inference Contract

**شدت:** بالا

وجود ONNX Runtime، Decoder یا Tile Planner به‌تنهایی وجود یک Pipeline عملیاتی مدل را اثبات نمی‌کند. باید مسیر کامل زیر در نرم‌افزار قابل اجرا، تست و بازتولید باشد:

```text
Image / WSI
   -> Model Input Validation
   -> Preprocessing
   -> Tiled Sampling
   -> Runtime Provider Selection
   -> ONNX / Native Model Inference
   -> Output Tensor Validation
   -> Post-processing
   -> Tile/Slide Coordinate Mapping
   -> Cross-tile Instance Reconciliation
   -> Mask / Objects / Probability Maps
   -> Measurements / Classification
   -> Project Persistence
   -> Export + Provenance
```

### الزامات

1. Model Adapter مستقل از UI و نوع Model Runtime باشد.
2. Model Manifest شامل نام، Version، Author، License، Input Tensor، Output Tensor، Shape، Dtype، Normalization، Label Map، Stain Assumption، Calibration Assumption و Hash فایل باشد.
3. ONNX Input/Output names و shapes از Model Metadata یا Manifest خوانده شوند؛ Hardcode پنهان ممنوع.
4. Model loading failure، unsupported opset، missing provider و invalid tensor Error روشن بدهد.
5. CPU Execution همیشه مسیر قابل‌اعتماد Fallback داشته باشد.
6. GPU Provider بر اساس قابلیت واقعی سیستم انتخاب شود؛ صرف وجود GPU به معنی پشتیبانی ORT CUDA/DirectML/CoreML نیست.
7. GPU Memory Budget و Fallback هنگام کمبود حافظه مدیریت شود.
8. Inference به Job واقعی متصل باشد و Progress/Cancel داشته باشد.
9. Input/Output Transformها ثبت شوند.
10. Model Hash و Runtime Version در Result ذخیره شود.

## AI-002 — Tile-aware WSI Inference و Seam Reconciliation

1. Tile Overlap مناسب بر اساس Model Receptive Field تعریف شود.
2. Coordinate Output هر Tile به Level 0 تبدیل شود.
3. Predictionهای Overlap با NMS، IoU، Stitching یا روش مناسب Model Merge شوند.
4. False Split و False Merge در مرز Tiles تست شوند.
5. Border Artifacts با Valid Core Region یا روش معتبر کنترل شوند.
6. Tileهای ناموفق قابل Retry باشند.
7. Processing order نتیجه را تغییر ندهد.
8. امکان Resume از آخرین Tile ذخیره‌شده داشته باشد.
9. Output Mask/Instances به شکل Chunked/Tiled نگهداری شود؛ کل Mask یک اسلاید بزرگ به اجبار در RAM بارگذاری نشود.

## AI-003 — Model Registry و Model Zoo

### Model Families پیشنهادی

- StarDist: Nuclei Instance Segmentation.
- Cellpose: Cell/Nuclei Segmentation.
- U-Net / U-Net variants: Semantic Segmentation.
- Hover-Net: Nuclei Segmentation/Classification.
- InstanSeg: Instance Segmentation برای تصاویر زیستی.
- YOLO-seg: Detection/Instance Segmentation در کاربرد مناسب.
- SAM/Medical Adaptations: Interactive Prompt-based Segmentation؛ با توجه به License، Size و محدودیت دامنه.
- Tissue Classifiers: Tumor/Stroma/Necrosis/Inflammation و سایر Tissue Compartments، تنها پس از Dataset Validation.

مدل‌ها فقط به‌عنوان Adapterهای اختیاری اضافه شوند؛ از افزودن تمام مدل‌ها پیش از تثبیت Runtime و Data Model خودداری کن.

### Model Registry

1. Installed / Available / Incompatible / Corrupted / Update Available.
2. Version pinning و Model Hash.
3. License/Attribution.
4. Download Source و Integrity Signature.
5. Model File Size و Required RAM/VRAM.
6. Supported Pixel Types، Channels، Stain، Magnification و Calibration.
7. Model Test Suite و Example Input.
8. Rollback/Uninstall.
9. امکان نصب Offline از فایل محلی.
10. User Consent قبل از Download یا انتقال داده.

## AI-004 — Benchmark و Evaluation Workspace

برای هر مدل امکان ارزیابی مستقل فراهم شود:

- Dataset Split و Patient-level Split برای جلوگیری از Leakage.
- Precision، Recall، F1، IoU، Dice.
- Object Detection AP/mAP در صورت کاربرد.
- Boundary F-score / Hausdorff در کاربرد مناسب.
- Calibration Curve و Confidence Analysis.
- Confusion Matrix برای Classification.
- Sensitivity/Specificity در کاربرد و Threshold مشخص.
- Per-Class Metrics.
- Performance per Slide/Scanner/Stain.
- Latency per Tile و Throughput.
- Model Size و Peak RAM/VRAM.

نتایج باید با Dataset ID، Ground Truth Version، Model Hash، Parameters و Runtime ثبت شوند.

**نکته:** Metrics به‌تنهایی نشانه کارایی بالینی نیستند. نوع Dataset، Patient Split، External Validation و Failure Cases باید در گزارش نمایش داده شوند.

## AI-005 — Human-in-the-loop و Active Learning

1. کاربر بتواند Prediction را Accept/Reject/Edit کند.
2. Correctionها با Provenance و Model Version ثبت شوند.
3. Hard Exampleها در Review Queue ذخیره شوند.
4. Uncertain Regionها بر اساس معیار مشخص اولویت بگیرند.
5. Dataset Curation با De-identification و حقوق استفاده انجام شود.
6. Training فقط با Consent و Dataset مجاز.
7. Train/Validation/Test Leakage جلوگیری شود.
8. قبل و بعد Training، Metrics و Model Hash ثبت شود.
9. مدل جدید جایگزین مدل قبلی نشود؛ Version جدید و Rollback داشته باشد.
10. خروجی مدل همیشه به‌عنوان Prediction/Research Result برچسب بخورد، نه Diagnosis.

---

# 9. قابلیت‌های تخصصی که TissueAI را متمایز می‌کنند

این قسمت، فراتر از بازسازی Fiji است. هدف افزودن قابلیت‌هایی است که با یکپارچگی Digital Pathology، AI و Analysis تجربه‌ای بهتر از ابزارهای پراکنده فراهم کنند.

## ADV-001 — Tissue Compartment Analysis

### Compartments هدف

- Tumor / Neoplastic Tissue.
- Stroma.
- Necrosis.
- Inflammatory Regions.
- Adipose.
- Epithelium.
- Lumen / Glandular Structures.
- Background / Artifact.

### قابلیت‌ها

1. Tissue Classification با Model ID و Confidence.
2. Maskهای چندکلاسه و Layer مستقل.
3. Area/Ratio هر Compartment.
4. Spatial Distribution روی Slide.
5. Tumor-Stroma Ratio در Region/Slide.
6. Necrosis Percentage.
7. Density map و Zonal Statistics.
8. Region Sampling و Comparison.
9. مدل/Threshold/Color Normalization در Provenance.
10. عدم نمایش Metric در صورت عدم اعتماد/عدم پوشش مناسب.

## ADV-002 — Nuclei / Cell / Gland Analysis

1. Nuclei Detection و Instance Segmentation.
2. Cell Boundary Segmentation در داده مناسب.
3. Nucleus-to-Cell Association.
4. Nuclei Density per mm².
5. Nuclear Morphometry.
6. Nuclear Intensity per Channel.
7. Cell Phenotyping با پنل Marker و Threshold/Model.
8. Gland Detection، Lumen Detection و Gland Morphometry.
9. Spatial Relationship between Cell and Tissue Compartment.
10. Object-level Export با Coordinate، Class، Feature، Confidence و Model Version.

## ADV-003 — Multiplex Immunofluorescence / Multichannel Analysis

### قابلیت‌ها

- Channel Mapping و Channel Naming.
- Per-channel LUT، Contrast و Display Range.
- Spectral Unmixing در صورت وجود Reference Spectra.
- Autofluorescence Correction.
- Background Subtraction.
- Colocalization Metrics مانند Pearson/Spearman و Manders، با Mask و Threshold Strategy مشخص.
- Cell Phenotyping با Marker Panel.
- Channel Overlay و Composite View.
- Channel-specific ROI Statistics.
- Bleed-through/Signal Saturation Warning.

### معیار علمی

Colocalization نباید تنها با هم‌پوشانی بصری دو کانال اعلام شود. روش Threshold، Background، Mask، Signal Saturation و تعداد نمونه باید قابل گزارش باشند.

## ADV-004 — Spatial Cell Neighborhood & Graph Analysis

1. Cell Centroid Extraction.
2. k-Nearest Neighbors.
3. Radius-based Neighborhood.
4. Voronoi/Tessellation در صورت نیاز.
5. Delaunay Graph.
6. Distance-to-Tumor/Boundary.
7. Tumor Infiltration Density.
8. Spatial Autocorrelation / Clustering Metrics.
9. Ripley K/L با Edge Correction و توضیح Assumptions.
10. Neighborhood Composition.
11. Cell-cell Interaction Score در صورت تعریف علمی.
12. Region-wise Comparison.
13. Spatial Graph Export.
14. Visualization با Node/Edge Filter.

برای تمام آمار فضایی، تعداد سلول، واحد، Edge Correction، منطقه تحلیل و تنظیمات دقیق در Report ثبت شوند.

## ADV-005 — Serial Section Registration و Multi-slide Comparison

1. Rigid Registration.
2. Affine Registration.
3. Deformable Registration در صورت پشتیبانی و اعتبارسنجی.
4. Landmark-based Alignment.
5. Feature-based Alignment.
6. Multi-scale Coarse-to-fine.
7. Registration Confidence و Error Map.
8. Inverse Transform.
9. Color/Intensity Normalization برای نمایش مقایسه‌ای، نه تغییر Source.
10. Compare Slider، Checkerboard، Alpha Blend و Difference View.
11. Propagate Annotation بین Slideها با نمایش خطا/Confidence.
12. ثبت کامل Transform و نسخه الگوریتم.
13. Resampling Label Map با Nearest Neighbor.
14. تست روی Serial Sections و اختلاف بافت/شکل واقعی.

## ADV-006 — 3D Microscopy Stack و Volume Analysis

این قابلیت را با 3D Anatomy Viewer عمومی اشتباه نگیر؛ هدف، بازسازی حجم از Z-stack/Multichannel Microscopy است.

1. Z-stack Navigation.
2. Orthogonal XZ/YZ Views.
3. Maximum/Mean/Standard Projection.
4. Volume Rendering.
5. 3D Segmentation Labels.
6. Surface Extraction.
7. Voxel Calibration در X/Y/Z.
8. Volume، Surface Area و 3D Morphometry.
9. Time-lapse 4D Navigation.
10. GPU/Memory Budget و Downsample Strategy.
11. Export مدل/Volume با Metadata.
12. حفظ Transform و Calibration.

## ADV-007 — Research Notebook و Analysis Report

1. Analysis Runها در Project ذخیره شوند.
2. هر Run ورودی، خروجی، مدل، پارامتر، نسخه نرم‌افزار و Hash Source را ثبت کند.
3. Notebook/Notes به Slide، ROI و Result لینک شوند.
4. Report دارای Methods، Data Description، QC، Results، Limitations و Software/Model Version باشد.
5. Export به PDF/HTML/CSV/JSON با Template.
6. Figure Panel برای ساخت شکل با Scale Bar، Legend، ROI و Annotation.
7. جدول قابل‌فیلتر Measurementها.
8. Citation و Source Dataset در گزارش.
9. گزارش باید distinguish کند کدام مقادیر اندازه‌گیری‌شده، پیش‌بینی مدل یا دستی هستند.
10. Report Reproducibility Check داشته باشد.

## ADV-008 — Plugin / Extension SDK

1. Plugin API نسخه‌دار.
2. Capability permissions برای File, Network, GPU, Project, UI.
3. Plugin Manifest شامل ID، Name، Version، Author، License، Hash، Minimum TissueAI Version و Permissions.
4. Plugin Registry و Install/Uninstall/Update.
5. Unsigned Plugin به‌صورت پیش‌فرض اجرا نشود.
6. Pluginها در Process/Runtime محدود اجرا شوند؛ Native Code غیرقابل‌اعتماد نباید بی‌قیدوشرط در Process اصلی Load شود.
7. ABI/Protocol Compatibility تست شود.
8. Plugin Crash نباید کل برنامه را Crash کند؛ در صورت امکان Isolated Host/Process استفاده شود.
9. API برای Reader، Filter، Segmentation، Measurement، Export، Workflow Node و UI Panel تعریف شود.
10. نمونه Plugin و Developer Documentation ارائه شود.

---

# 10. Job Scheduler، Workflow و Resource Governance

## JOB-001 — Job Manager واقعی، نه فقط Status Registry

**وضعیت:** `IMPLEMENTED_PARTIAL`  
**فایل:** `src-tauri/src/jobs/mod.rs`, `src-tauri/src/commands/jobs.rs`

### یافته

JobInfo و Cancellation Token وجود دارند؛ اما باید ثابت شود Worker Pool، Queue، Resource Allocation و Job Execution واقعی به این State Model متصل شده‌اند. در مسیر فعلی، `cancel_job` Token را فعال می‌کند و وضعیت را فوراً Cancelled می‌گذارد؛ این لزوماً به معنی توقف Worker نیست.

### الزامات

1. `JobScheduler` مستقل از UI باشد.
2. Bounded Queue با Priority داشته باشد.
3. Worker Pool برای CPU و Queue جداگانه GPU در نظر بگیرد.
4. Resource Budget برای RAM، VRAM، Disk و Thread Count.
5. هر Job Cancellation Token واقعی در Loops، Tile Decode، Model Inference و Export بررسی کند.
6. وضعیت `Cancelling` قبل از `Cancelled` نهایی وجود داشته باشد.
7. `Cancelled` فقط بعد از توقف واقعی Worker/Resource Cleanup ثبت شود.
8. `Failed` با Error Category، Recoverability و Error Context.
9. Retry فقط برای Jobهای Idempotent/قابل‌بازیابی.
10. Jobها بعد از Restart قابل Reconcile باشند؛ Job فعال در Crash به `Interrupted` منتقل شود، نه `Completed`.
11. Progress قابل‌اندازه‌گیری باشد؛ Percentage ثابت/ساختگی ممنوع.
12. Eventها با Job ID، Timestamp و Sequence ارسال شوند.
13. امکان Pause/Resume فقط برای Taskهایی که واقعاً Checkpoint دارند.
14. Jobهای طولانی به Project و Analysis Run لینک شوند.
15. Result Artifactها بعد از موفقیت به Storage Project ثبت شوند.
16. Job History قابل جست‌وجو/فیلتر/پاک‌سازی طبق Retention Policy.

### معیار پذیرش

- Cancel هنگام اجرای واقعی Tile Pipeline باید در زمان قابل‌اندازه‌گیری متوقف شود.
- Cancel بعد از Completed خطای معنادار بدهد یا No-op امن باشد.
- Crash وسط Job باعث Resume یا Interrupted Status روشن شود.
- چند Job همزمان از Resource Budget تجاوز نکنند.

## JOB-002 — Resource Manager

1. CPU Thread Budget و جلوگیری از Oversubscription.
2. GPU Provider و VRAM Budget.
3. Backpressure بین Reader، Processing و Writer.
4. Memory Pressure Monitor.
5. Cache Eviction در فشار حافظه.
6. Temporary Storage Budget و Disk Free Space Check.
7. تنظیمات Performance Profile: Balanced، High Performance، Low Memory.
8. Battery/Power Mode در لپ‌تاپ در صورت دسترسی.
9. User-visible Explanation هنگام کندکردن Job به دلیل Resource Limit.
10. Resource Metrics واقعی و نه مقدار ساختگی.

## WF-001 — Workflow DAG Engine

1. Node/Edge Graph با Schema نسخه‌دار.
2. Node Type Registry.
3. Input/Output Type Validation.
4. Dependency Resolution و Cycle Detection.
5. Conditional Branch و Parameter Mapping.
6. Checkpoint/Resume.
7. Node-level Retry و Error Handling.
8. Deterministic Cache Key و Reuse Output.
9. Human Approval Node برای اقدامات حساس.
10. Batch over Dataset/Slides.
11. Workflow Run Manifest.
12. Export/Import Workflow.
13. Visual Editor با Zoom/Pan/Minimap، Node Search و Validation Error.
14. Run Preview و Dry-run برای برآورد منابع.
15. Versioning و Migration برای Workflowها.

---

# 11. Project Management و Data Integrity

## PRJ-001 — Scientific Project Workspace واقعی

**وضعیت:** `NOT_PROVEN_IN_FRONTEND`  
**شدت:** بالا

### یافته

در Frontend، `ProjectPage.tsx` بررسی‌شده از Thread Management، Threads، Assistant و Chat Components استفاده می‌کند. بنابراین این صفحه Project چت است، نه Project علمی `TissueAiProject`. مسیرهای علمی باید از این مفهوم جدا شوند تا واژه Project مبهم نباشد.

### الزامات

1. Entity مستقل `ScientificProject` یا `TissueAiProject` در UI.
2. صفحه Projects شامل Create/Open/Recent/Archive/Import/Export.
3. Project Workspace شامل Datasets، Slides، ROI، Analysis Runs، Models و Reports.
4. وضعیت Missing/Offline Asset مشخص باشد.
5. بازکردن Project باید همه Assetها، Annotationها، Analysis Results و View State ضروری را بازسازی کند.
6. Project Switch بدون نشت State بین دو پروژه.
7. Project Lock یا Concurrency Strategy هنگام بازکردن همزمان یک Project.
8. Project Summary شامل تعداد Slides، Size، Last Opened و وضعیت Storage.
9. UI خطاهای Save/Load را واضح نشان دهد.
10. Chat Projects از Scientific Projects جدا بمانند.

## PRJ-002 — Schema Versioning و Migration

1. `schema_version` در سطح Project و هر Data Artifact مهم.
2. Migrationهای نسخه‌ای از N به N+1.
3. Migration باید Idempotent یا با Migration Log قابل‌بازیابی باشد.
4. قبل از Migration از فایل/DB Backup تهیه شود.
5. فایل نسخه جدیدتر از نرم‌افزار قدیمی به‌صورت Read-only/Unsupported باز شود؛ Downgrade خاموش ممنوع.
6. Corrupt Project Recovery با نمایش فایل Backup.
7. Project Integrity Checker برای Missing Files، Hash Mismatch، Broken References و Invalid ROI.
8. Migration Test Fixture برای هر نسخه.
9. Migration Summary به کاربر نمایش داده شود.

## PRJ-003 — اصلاح خطای نادیده‌گرفتن Save Failure در Add Image

**وضعیت:** `CONFIRMED_BY_SOURCE`  
**شدت:** بالا

در `commands/project.rs` مسیر `project_add_image` پس از تغییر Project، نتیجه `save_to_directory` را با `let _ = ...` نادیده می‌گیرد و سپس `Ok(project.clone())` برمی‌گرداند.

### الزامات

1. Save Error باید Propagate شود.
2. اگر Save شکست خورد، وضعیت In-memory و Persisted به‌صورت مبهم نماند.
3. Operation باید Transaction-like باشد: ابتدا Validation و آماده‌سازی، سپس تغییر/Save، سپس Commit State؛ یا Rollback در شکست.
4. UI باید Save Failed، Retry و Recovery ارائه کند.
5. تست Disk Full، Permission Denied، Read-only Folder و File Lock وجود داشته باشد.

## PRJ-004 — Asset Storage Strategy

1. Original Source را بیرون Project نگه‌داشتن یا Copy داخل Project باید انتخاب صریح کاربر باشد.
2. Relative Path و Absolute Source URI با یکدیگر اشتباه نشوند.
3. Project Portable Mode برای Copy/Package Assetهای لازم.
4. Hash برای تشخیص Source Changed.
5. Relink Workflow برای فایل منتقل‌شده.
6. Missing Asset باید Placeholder/Warning ایجاد کند؛ داده نباید حذف شود.
7. Asset Import باید Copy/Reference و Storage Impact را توضیح دهد.
8. File Watcher برای تشخیص تغییر Source؛ با Debounce و جلوگیری از Reimport بی‌مورد.
9. External Assetها در Project Manifest با Path و Hash/Size/mtime ثبت شوند.
10. فایل‌های محرمانه یا بیمارگونه در Crash Log/Thumbnail Cache ناخواسته باقی نمانند.

## PRJ-005 — Autosave، Journal و Crash Recovery

1. Autosave Debounced و configurable.
2. Dirty State و Last Saved Timestamp.
3. Incremental/Journal Save برای داده‌های پرتغییر.
4. Atomic Write با Temp File، fsync و Rename.
5. Backup Rotation با تعداد و حجم محدود.
6. Startup Recovery و نمایش Recovery Point.
7. Save Conflict Handling.
8. Project Close باید Dirty Changes را تشخیص دهد.
9. تست Crash در مراحل مختلف Write و Restore.
10. Recovery بدون از دست‌دادن آخرین Annotation/Analysis Event.

## PRJ-006 — Storage Backend انتخابی و قابل‌مهاجرت

SQLite برای Project Metadata، Relations، Indexها و Job History گزینه مناسبی است؛ فایل‌های حجیم تصویر/Mask/Chunk می‌توانند بیرون DB بمانند. لازم نیست همه محتوا در SQLite ذخیره شود.

طراحی پیشنهادی:

```text
MyStudy.tissueai/
  project.json
  manifest.json
  database.sqlite
  assets/
    originals/       # optional: only if user selected copy-in
    derived/
    masks/
    thumbnails/
  analysis/
    runs/
    reports/
  workflows/
  models/            # metadata/cache only unless user opts in
  journal/
  backups/
```

ساختار نهایی باید با Archive/Portable Project، Cloud Sync آینده و Relink سازگار باشد.

---

# 12. UI/UX: تبدیل ابزارهای پراکنده به Workstation یکپارچه

## UX-001 — Project-centric Information Architecture

### ساختار اصلی پیشنهادی

- Home / Recent Work.
- Projects / Studies.
- Project Workspace.
- Slide Viewer.
- Processing Studio.
- AI Analysis.
- Workflow Studio.
- Results & Reports.
- Model Manager.
- Preferences / Extensions / Help.

### اصول

1. کاربر ابتدا Project را انتخاب/ایجاد کند.
2. Dataset و Slide داخل Project باز شوند.
3. ابزارهای متناسب با Context در دسترس باشند.
4. Chat/LLM به‌عنوان Assistant Panel ثانویه باشد، نه محور اصلی Scientific Workspace.
5. هر Tool از همان Asset Model، Job Service و Provenance استفاده کند.
6. Toolها نباید هرکدام مسیر مستقل بازکردن/ذخیره تصویر داشته باشند، مگر نوع کاربرد کاملاً متفاوت باشد.

## UX-002 — Scientific Workbench Layout

الگوی پیشنهادی:

- Top Bar: Project, Dataset, Slide, Global Search, Command Palette, Save Status.
- Left Panel: Project Explorer و Layer/ROI Tree.
- Center: Viewer Canvas.
- Right Panel: Inspector/Properties/Metadata/Measurement.
- Bottom Panel: Job Queue, Results, Console, History.

### رفتارها

1. پنل‌ها قابل Collapse/Resize/Restore باشند.
2. Workspace Layout ذخیره‌شدنی باشد.
3. Tabs/Multiple Slides قابل‌مدیریت باشند.
4. Viewer در مرکز فضای بصری بماند.
5. Panelها با Context Selection تغییر محتوا دهند، نه اینکه پنجره‌های متعدد باز شوند.
6. Tool Mode فعلی همیشه واضح باشد.
7. خطا و وضعیت Job در سطح کاربر قابل‌مشاهده باشد.
8. پنل Metadata از پنل Annotation تفکیک شود.
9. Search در Project، Slide، ROI، Result و Model کار کند.
10. Layoutهای Small Screen/Low Resolution نیز قابل‌استفاده باشند.

## UX-003 — Toolbar و Command System

1. Select، Pan، Zoom، Rectangle ROI، Ellipse ROI، Polygon، Freehand، Point، Line، Measure، Brush، Eraser.
2. Shortcutها قابل‌تنظیم باشند.
3. Command Palette همه عملیات را بر اساس نام جست‌وجو کند.
4. Contextual Toolbar بر اساس Layer/Selection/Tool Mode تغییر کند.
5. Undo/Redo در کل Project و هر Editor رفتار تعریف‌شده داشته باشد.
6. Dialogها باید واحدها، حدود مقادیر و اثر عملیات را توضیح دهند.
7. Destructive Action Confirmation با Preview/Undo.
8. Right-click Context Menu فقط برای شیء/پنل مرتبط باشد.
9. Global shortcutهای مرورگرگونه مثل Ctrl+S باید به معنی Save Project در سطح App باشند؛ نباید بی‌صدا Block شوند.
10. F12/DevTools فقط در Debug Build مدیریت شود و به‌عنوان Security Boundary استفاده نشود.

## UX-004 — اصلاح System Telemetry

در Home، فراخوانی `llm_get_system_info` جایگزین داده‌های تصادفی شده است؛ اما برخی مقادیر فعلی Inventory هستند، نه Usage:

- CPU Cores تعداد هسته‌هاست، نه CPU Load.
- GPU Count/Integrated به‌تنهایی GPU Utilization نیست.
- `modelsLoaded` در کد بررسی‌شده مقدار ثابت 0 دارد.

### الزامات

1. کارت‌ها به Hardware Inventory و Live Utilization تفکیک شوند.
2. CPU Usage فقط اگر واقعاً اندازه‌گیری می‌شود با درصد نمایش داده شود.
3. RAM Used/Total و Memory Pressure مشخص باشند.
4. GPU Name، Provider، VRAM Total/Used و Utilization در صورت قابل‌دسترسی بودن نمایش داده شوند.
5. Model Manager منبع واقعی تعداد مدل Loaded باشد.
6. Unknown/Permission Denied/Unavailable از صفر جدا باشند.
7. Timestamp آخرین Sampling نمایش داده شود.
8. Polling با Interval متناسب و قابل‌توقف باشد.
9. UI در صورت نبود حسگر، مقدار جعلی نسازد.
10. Telemetry فقط برای Performance داخلی بماند و بدون رضایت به بیرون ارسال نشود.

## UX-005 — Accessibility و Scientific Readability

1. Contrast برای Text، Cursor، ROI Outline و Mask.
2. Keyboard Navigation.
3. Screen Reader labels برای Controls اصلی.
4. Reduce Motion.
5. Font Scaling و Density modes.
6. Tooltip برای واحدها و Metrics.
7. عدم نمایش Overlayهای تزئینی روی داده‌های علمی.
8. Color palettes ایمن برای Color Blindness.
9. Legend واضح برای Classification/Heatmap.
10. نمایش Confidence و Uncertainty بدون اغراق بصری.

---

# 13. Security، Privacy و Data Governance

## PRIV-001 — Privacy by Design

1. Offline-first رفتار پیش‌فرض باشد.
2. Cloud AI/Remote Provider فقط با انتخاب آگاهانه و نمایش اینکه چه داده‌ای ارسال می‌شود.
3. قبل از ارسال تصویر، Region، Metadata یا Prompt شامل اطلاعات حساس، Preview و Consent.
4. Metadata بیمار/شناسه شخصی در Log، Telemetry و Thumbnail Name حذف/Redact شوند.
5. Crash Reports Opt-in و با Redaction.
6. User بتواند تمام Session History و Cacheهای حساس را حذف کند.
7. Privacy Settings برای نگهداری History، Logs، Temporary Files و Model Cache.
8. Export Dataset با De-identification Option.
9. Default file permissions محدود باشد.
10. Local Web Server فقط با Consent و Authentication.

## PRIV-002 — Path Traversal و File Safety

1. همه Pathهای ورودی در Backend نرمال و Canonicalize شوند.
2. Symlink و Junction در محدوده Storage بررسی شوند.
3. Archive Extraction علیه Zip Slip/Tar Path Traversal محافظت شود.
4. Limit تعداد فایل، حجم کل و Compression Ratio.
5. MIME/Signature بررسی شود؛ Extension تنها معیار نباشد.
6. Temporary file در پوشه امن و با نام تصادفی.
7. Atomic rename و Cleanup پس از Error.
8. عدم اعتماد به Path ارسالی Frontend.
9. File Dialogهای OS برای User-selected paths.
10. تست مسیرهای دارای Unicode، طول زیاد، Drive Mapping و دسترسی غیرمجاز.

## PRIV-003 — Logging و Audit Trail

1. Structured Logs با Level و Correlation ID.
2. Redaction API Keys، Access Tokens، Patient Identifiers و File Contents.
3. Per-Project Audit Trail برای Create/Edit/Delete/Analysis/Export.
4. Retention Policy و Rotation.
5. Export Logs فقط با تأیید کاربر.
6. خطاها باید قابل‌تشخیص باشند ولی جزئیات داخلی حساس را به UI/Network ندهند.
7. Crash Report Opt-in.
8. Log Integrity در کاربردی که Audit مهم است بررسی شود.

---

# 14. Reliability، Testing و Scientific Validation

## QA-001 — Test Pyramid

### Unit Tests

- Pixel Buffer Size/Type/Axis.
- Calibration.
- ROI Geometry.
- Measurement.
- Histogram.
- Filter/Threshold/Morphology.
- Tile Coordinate Mapping.
- Model Tensor Pre/Post-processing.
- Project Migration.

### Integration Tests

- Open Slide → Read Tile → Render.
- Import Image → Add to Project → Save → Close → Reopen.
- ROI Create → Save → Reopen → Measurement.
- Job Create → Execute → Cancel/Fail/Complete.
- Model Load → Inference → Persist Result.
- Export OME/GeoJSON/ROI ZIP → Open in External Reader.

### End-to-end UI Tests

- New Project.
- Import Slide.
- Open Viewer.
- Create ROI.
- Run Filter.
- Run Segmentation.
- Save/Restart/Recover.
- Export Report.

### Performance Tests

- Large WSI.
- Rapid Pan/Zoom.
- 1000+ Annotation objects.
- Large Mask.
- Multiple concurrent Jobs.
- Model inference with limited RAM/VRAM.

## QA-002 — Golden Dataset Strategy

1. Dataset کوچک Synthetic با Ground Truth دقیق.
2. Dataset واقعی با مجوز استفاده.
3. نمونه‌های WSI برای Vendorهای پشتیبانی‌شده.
4. Calibration Known Geometry.
5. Image Processing Reference Outputs.
6. ROI/Annotation Round-trip Fixtures.
7. Model Inference Reference Inputs/Outputs.
8. Dataset Card شامل Source، License، Stain، Scanner، Resolution و محدودیت‌ها.
9. Test Data نباید اطلاعات بیمار شناسایی‌پذیر داشته باشد.
10. هر تغییر الگوریتم با قبل/بعد در CI یا Test Report مقایسه شود.

## QA-003 — Scientific Correctness Gates

هیچ الگوریتم علمی بدون موارد زیر `VERIFIED_COMPLETE` نمی‌شود:

- تعریف ریاضی/رفتاری.
- واحد و Coordinate System.
- Pixel Type و Dynamic Range.
- Reference Implementation یا Test Vector.
- Numerical Tolerance.
- Edge Cases.
- Dataset مناسب.
- Known Limitations.
- Result Provenance.
- Independent Review در قابلیت‌های حساس.

## QA-004 — Build/CI Quality Gates

1. `pnpm build`.
2. TypeScript checks.
3. Lint.
4. Formatting: `cargo fmt --check`.
5. Rust Lint: `cargo clippy`.
6. Rust Unit/Integration Tests.
7. Dependency Audit و License Report.
8. Secret Scan.
9. SAST/Dependency Vulnerability Scan.
10. Build Matrix Windows/macOS/Linux در صورت پشتیبانی.
11. Release artifact smoke test.
12. SBOM برای Release.
13. Dependency Lockfile Review.
14. Test Summary در Pull Request.

`package.json` در زمان بررسی Scripts اصلی `dev`, `build`, `preview`, `tauri` را داشت؛ Agent باید اسکریپت Test/Lint/Typecheck را صریح و قابل اجرا اضافه کند، نه اینکه فرض کند CI آن‌ها را اجرا می‌کند.

---

# 15. Interoperability و اکوسیستم نرم‌افزارها

هدف، پیاده‌سازی قابلیت‌های لازم و Import/Export سازگار است؛ نه کپی‌کردن کامل رابط یا معماری ابزارهای دیگر.

## INT-001 — Fiji / ImageJ

قابلیت‌ها و اتصال‌های پیشنهادی:

- ImageJ ROI `.roi` و ROI ZIP.
- TIFF و OME-TIFF.
- Calibration و Metadata preservation.
- CSV Measurements.
- Batch/Automation API.
- Macro/Script Interop در صورت وجود Runtime اختیاری؛ نه اجباری.
- امکان ارسال Region منتخب به ImageJ/Fiji در سیستم نصب‌شده، با تأیید User.
- Export Results به فرمتی که Fiji بتواند باز کند.

## INT-002 — QuPath

- Import/Export GeoJSON و Annotation.
- حفظ Class Name، Color و Object Hierarchy.
- Project/Slide metadata mapping.
- Export Cell/Detection Tables.
- Ability to open tissue regions/results in QuPath.
- Document differences in semantics and coordinate systems.

## INT-003 — napari

- Layer mapping: Image, Labels, Points, Shapes, Vectors, Surface, Tracks.
- N-dimensional image metadata.
- OME-NGFF compatibility.
- Optional external handoff to napari when installed.

## INT-004 — OMERO

- OMERO Adapter برای Dataset/Image/Metadata/Annotation.
- Authentication از OS Keyring/secure storage.
- User-confirmed upload/download.
- Offline Local Project همچنان مستقل باشد.
- Sync Conflict و Duplicate Handling.
- هیچ Credential یا Dataset خودکار به Server ارسال نشود.

---

# 16. Documentation، Release و Product Readiness

## DOC-001 — اصلاح README فوری

**وضعیت:** `CONFIRMED_BY_SOURCE`  

README فعلی هنوز متن Starter Template «Tauri + Vanilla TS» را نشان می‌دهد؛ این برای معرفی محصول جدی مناسب نیست.

README جدید باید شامل:

1. معرفی دقیق TissueAI و Intended Use.
2. وضعیت فعلی پروژه (Alpha/Beta/Research Prototype؛ واقع‌بینانه انتخاب شود).
3. Screenshots واقعی از نسخه جاری.
4. قابلیت‌هایی که واقعاً کار می‌کنند.
5. قابلیت‌های Experimental/Planned جداگانه.
6. Architecture Diagram.
7. Supported File Formats و محدودیت‌ها.
8. Installation/Development.
9. Build/Test Commands.
10. Data/Privacy Statement.
11. Model Licensing/Attribution.
12. Known Issues.
13. Citation/How to Cite.
14. Contribution Guide.
15. Security Reporting Guidance.

## DOC-002 — وضعیت قابلیت‌ها در UI و Documentation

برای هر Feature یک Status Registry واحد وجود داشته باشد:

- Available.
- Experimental.
- Requires External Dependency.
- Unsupported.
- Planned.

این Status باید از همان Source of Truth برای Home، Help، README و Model/Plugin Manager تغذیه شود.

## REL-001 — Release Readiness

1. SemVer.
2. Changelog.
3. Build Matrix.
4. Installer Signing در صورت امکان.
5. Hash/SHA256 برای Downloadها.
6. SBOM و License Notice.
7. Upgrade/Migration Test.
8. Uninstall Data Preservation Policy.
9. Crash Recovery Smoke Test.
10. Release Notes شامل Known Limitations.

---

# 17. Backlog اجرایی بر اساس اولویت

## Milestone A — Security & Data Safety (باید پیش از Network Mode و انتشار Stable تکمیل شود)

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| SEC-001 | Loopback Default و LAN Opt-in | `llm/web_server.rs`, Settings | — | تست Network Binding موفق |
| SEC-002 | Authentication/Authorization برای APIها | `llm/web_server.rs` | SEC-001 | Auth/IDOR/Admin Tests |
| SEC-003 | CORS محدود و CSP Production | `tauri.conf.json`, `capabilities` | — | Build Release + Negative Tests |
| SEC-004 | Model Encryption Format V2 | `crypto.rs`, Model Loader | — | AEAD tamper tests + migration |
| PRIV-001 | Consent/Redaction/Local-only defaults | LLM, Export, Logs, Settings | SEC-002 | Privacy tests |
| PRIV-002 | Path/Archive safety | File I/O, Import, Export | — | Traversal tests |
| UX-003 | اصلاح Global Shortcuts و Context Menu | App.tsx / keyboard handlers | — | Keyboard UX tests |

## Milestone B — WSI Correctness

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| WSI-001 | Native WSI Decoder | `wsi/reader.rs`, Cargo | — | Real SVS/NDPI/MRXS fixture |
| WSI-002 | Metadata normalization | WSI Metadata, scientific models | WSI-001 | Metadata comparison |
| WSI-003 | Binary Tile transport | WSI commands, Tauri bridge, Viewer | WSI-001 | IPC benchmark |
| WSI-004 | Memory-budgeted Cache | `wsi/cache.rs` | — | Cache tests/metrics |
| WSI-005 | Coordinate-correct Scheduler | `wsi/scheduler.rs`, Viewer | WSI-001 | Tile grid geometry tests |
| WSI-006 | Layer Rendering Pipeline | Viewer components | WSI-003/005 | overlay alignment tests |
| WSI-007 | Viewer UX & navigation | Viewer UI | WSI-005/006 | E2E Pan/Zoom tests |

## Milestone C — Scientific Data & Calibration

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| CAL-001 | Anisotropic calibration fix | `roi/measurement.rs`, `roi/manager.rs` | — | Exact numeric tests |
| DATA-001 | Checked dimension arithmetic | `scientific_image.rs`, import | — | Overflow/Allocation tests |
| DATA-002 | Lossless Bit Depth import | Reader + Scientific Model | WSI/Image I/O | Round-trip tests |
| DATA-003 | N-D Axis/Plane model | scientific models + Viewer | DATA-001 | C/Z/T tests |
| DATA-004 | Multi-axis statistics | Processing/Stats | DATA-002/003 | Golden statistics |
| PROC-001 | Typed filters/threshold | `image_processing` | DATA-002 | U8/U16/F32 test vectors |
| PROC-002 | Tiled Processing + Halo | Processing Engine | WSI-001/004 | Seam tests |
| HISTO-001 | H&E/H-DAB deconvolution | `histology` | DATA-002 | Gold stain fixtures |
| HISTO-002 | Tissue QC Mask | histology + QC UI | WSI/PROC | Validation dataset |
| HISTO-003 | Morphometry correctness | histology/measurements | CAL-001 | Reference measurements |

## Milestone D — Project & Annotation Reliability

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| PRJ-001 | Scientific Project UI | routes/pages/project | Project Backend | E2E Project flow |
| PRJ-002 | Schema migration | Project model/storage | — | Migration fixtures |
| PRJ-003 | Propagate save failures | `commands/project.rs` | — | Disk failure tests |
| PRJ-004 | Asset strategy/Relink/Hash | Project, File I/O | PRJ-002 | Move/relink test |
| PRJ-005 | Autosave/Recovery | Project storage | PRJ-002/003 | Crash simulation |
| PRJ-006 | Project storage packaging | Project storage | PRJ-004 | Portable project test |
| ROI-001 | Persistent Annotation identity | ROI/Project | PRJ-001/002 | Reopen/identity tests |
| ROI-002 | Measurement schema validity | ROI/Calibration | CAL-001 | Physical unit tests |
| ROI-003 | Fiji/QuPath/OME Interop | Export/Import | ROI-001 | External round-trip |
| ROI-004 | Reviewer workflow | Project/ROI UI | ROI-001 | Multi-reviewer tests |

## Milestone E — Runtime, Jobs, AI

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| JOB-001 | Real Job Scheduler | `jobs/`, commands | — | Worker lifecycle tests |
| JOB-002 | Resource Manager | jobs/runtime/hardware | JOB-001 | Budget tests |
| WF-001 | Workflow DAG Engine | `workflow/` | JOB-001 | DAG/resume tests |
| AI-001 | End-to-End Inference API | AI runtime/models | JOB-001, WSI | real model inference |
| AI-002 | WSI Tile Inference/Merge | AI + WSI | AI-001, WSI-001 | seam/edge tests |
| AI-003 | Model Registry | model manager | AI-001 | Install/verify/uninstall |
| AI-004 | Evaluation Workspace | AI evaluation | AI-001 | Metrics on held-out data |
| AI-005 | Human Review/Active Learning | AI + ROI/Project | AI-004/ROI-001 | correction lineage test |

## Milestone F — Differentiating Science & Workbench

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| UX-001 | Project-centric IA | Main routes/layout | PRJ-001 | navigation usability tests |
| UX-002 | Scientific Workbench | Workspace/Viewer/Panels | WSI-006, PRJ-001 | E2E workflow |
| UX-004 | Real Telemetry | Home/hardware command | job/hardware service | telemetry tests |
| UX-005 | Accessibility | UI components | UX-002 | contrast/keyboard checks |
| ADV-001 | Tissue Compartments | Histology/AI | AI + Histology | ground-truth benchmark |
| ADV-002 | Cell/Nuclei/Gland Analysis | segmentation/morphometry | CAL/AI/ROI | benchmark + results |
| ADV-003 | Multiplex IF | Image Model/Processing | DATA-003 | channel/colocalization tests |
| ADV-004 | Spatial Graph Analysis | spatial_analysis | ADV-002 | known-geometry fixtures |
| ADV-005 | Serial Section Registration | registration | WSI + ROI | landmark/error benchmark |
| ADV-006 | Z-stack 3D | Viewer/volume | DATA-003 | volume phantom tests |
| ADV-007 | Research Notebook/Report | Project/export | PRJ-001, AI, ROI | reproducible report |
| ADV-008 | Plugin SDK | extension architecture | Security/Job API | isolated sample plugin |

## Milestone G — Open Interoperability & Release Quality

| Task ID | شرح | مسیرهای اصلی | وابستگی | معیار تکمیل |
|---|---|---|---|---|
| IO-001 | OME-TIFF/OME-Zarr | Reader/Writer | WSI/Data Model | schema + external validator |
| IO-002 | DICOM WSI | Reader + Metadata | WSI-001 | standard conformance fixtures |
| INT-001 | Fiji Integration | import/export/handoff | ROI-003/IO-001 | round-trip |
| INT-002 | QuPath Integration | GeoJSON/Project metadata | ROI-003 | round-trip |
| INT-003 | napari Interop | layer/NGFF | IO-001 | layer mapping tests |
| INT-004 | OMERO Adapter | integration service | Project/Privacy | auth/sync tests |
| DOC-001 | Replace starter README | README | current verified feature registry | accurate docs |
| DOC-002 | Feature Status Registry | Feature metadata | all modules | no mismatched claims |
| QA-004 | Full CI Quality Gates | workflows/scripts | QA-001–003 | CI all required jobs pass |
| REL-001 | Release readiness | CI/release | security/QA | release checklist passes |

---

# 18. Definition of Done (DoD)

یک Task فقط زمانی `VERIFIED_COMPLETE` است که همه موارد زیر صادق باشند:

1. UI واقعی وجود دارد و به Backend واقعی متصل است.
2. Backend مسیر کامل را اجرا می‌کند؛ Stub/Mock/Hard-coded output وجود ندارد.
3. Input Validation سمت Backend انجام می‌شود.
4. Error path و Empty State مشخص هستند.
5. Cancellation در عملیات زمان‌بر کار می‌کند.
6. Data Persistence و Reopen Test موفق است، اگر Task داده‌محور باشد.
7. Unit و Integration Tests وجود دارند.
8. در الگوریتم علمی، Golden Dataset/Reference Comparison وجود دارد.
9. Pixel Type، Unit، Coordinate System و Calibration مشخص‌اند.
10. Provenance/Version/Parameters ثبت می‌شود.
11. Performance و Memory روی Sample واقع‌گرایانه اندازه‌گیری شده‌اند.
12. Security/Privacy اثرات تغییر بررسی شده است.
13. Help/README/Status Registry به‌روز شده‌اند.
14. Buildهای مرتبط موفق‌اند.
15. هیچ Regression شناخته‌شده‌ای باقی نمانده یا صریحاً ثبت شده است.

---

# 19. ترتیب اجرا و محدودیت Parallelism

## 19.1 کارهایی که نباید همزمان بدون قرارداد API اجرا شوند

- WSI Reader و Viewer Tile Scheduler.
- Scientific Data Model و Typed Processing.
- Calibration و ROI Measurements.
- Project Schema و Annotation Persistence.
- Job Scheduler و تمام عملیات AI/Processing.
- Network Security و Web Server Feature Changes.

برای این‌ها ابتدا API Contract و DTOها را تثبیت کن، سپس Frontend/Backend را با همان قرارداد توسعه بده.

## 19.2 کارهایی که می‌توانند موازی شوند

پس از تثبیت قراردادها:

- README و Documentation با QA Scripts.
- Model Registry UI با Backend Interface ثابت.
- Annotation Styling با Geometry Model ثابت.
- Export Formatها با ROI Schema ثابت.
- Accessibility Audit و Theme Audit.

## 19.3 ترتیب پیشنهادی اجرای Antigravity

1. `SEC-001` تا `SEC-004` را بررسی کن و اول Riskهای فوری را اصلاح کن.
2. `WSI-001` را پیاده‌سازی و با Fixture واقعی اثبات کن؛ قبل از آن روی زنجیره‌های بزرگ WSI Feature کار نکن.
3. `CAL-001`, `DATA-001`, `DATA-002` را تکمیل کن.
4. `PRJ-003` و Project Integrity را قبل از زیادشدن داده‌های کاربر اصلاح کن.
5. `JOB-001` را قبل از اتصال همه Modelها/Batchها تکمیل کن.
6. `PROC-001`, `HISTO-001`, `HISTO-002`, `HISTO-003` را مرحله‌ای اضافه کن.
7. Scientific Project UI و Workbench را بر اساس Backend واقعی بساز.
8. سپس Model Registry، Inference و Workflow را گسترش بده.
9. در پایان Interoperability و Advanced Differentiators را اجرا کن.

---

# 20. دستورهای اجرایی برای Antigravity

این بخش را همراه کل سند در Prompt Agent قرار بده:

```text
You are working in the existing TissueAI repository.
Read these documents before changing code:
- TISSUEAI_DEEP_REAUDIT_AND_NEXT_PHASE.md
- TISSUEAI_ENGINEERING_ROADMAP.md (if present locally)
- options.md
- AGENT.md / AGENTS.md (if present locally)

Do not assume any listed capability is complete because a module, command,
UI control, or documentation section exists.

FIRST ACTION:
1. Inspect the current branch and commit SHA.
2. Inspect git status; do not overwrite user changes.
3. Build a Feature Evidence Matrix for all P0 tasks.
4. For each task, classify it as VERIFIED_COMPLETE, IMPLEMENTED_PARTIAL,
   DECLARED_ONLY, BLOCKED, NOT_STARTED, or NEEDS_RUNTIME_VALIDATION.
5. Provide exact source paths and tests as evidence.

IMPLEMENTATION RULES:
- Do not rewrite the application from scratch.
- Do not create mock functionality and call it complete.
- Keep scientific source data immutable.
- Never invent calibration, metadata, model metrics, progress or telemetry.
- Keep processing in the Rust backend where appropriate.
- Use typed data contracts and versioned schemas.
- Every long operation must use the real Job lifecycle.
- Every scientific result must record parameters and provenance.
- Do not send user image data to remote services without explicit consent.
- Do not weaken existing security/privacy controls to make a feature work.

EXECUTION:
- Work one task at a time in dependency order.
- Start with Milestone A (Security & Data Safety).
- Before each task, write a short implementation plan and identify affected files.
- Implement backend, frontend, tests and documentation together.
- Run all relevant tests and build checks after each task.
- Do not silently ignore errors or persistence failures.
- Do not mark a task complete until every Acceptance Criterion passes.
- For scientific algorithms, compare against reference data/software.
- For WSI, use real legally distributable sample slides and record memory/latency.

AFTER EACH TASK, REPORT:
1. Task ID and final status.
2. Files changed.
3. Architecture/API changes.
4. Tests added and exact results.
5. Benchmark numbers and hardware when relevant.
6. Known limitations and remaining risks.
7. Next dependent task.

If a dependency is unavailable, do not fake it. Mark the task BLOCKED,
explain the required dependency and provide a valid alternative plan.
```

---

# 21. معیارهای رقابتی برای سطح ممتاز

«بهترین نرم‌افزار» یک معیار مطلق نیست. TissueAI باید در چند محور قابل‌اندازه‌گیری از ترکیب ابزارهای موجود بهتر شود، نه اینکه فقط تعداد Feature بیشتری داشته باشد.

| محور | معیار رقابتی | مدرک مورد انتظار |
|---|---|---|
| WSI | نمایش روان اسلاید بسیار بزرگ بدون Decode کامل | Benchmark حافظه/Latency و Tile correctness |
| Scientific Integrity | عدم تولید اندازه فیزیکی بدون Calibration معتبر | Unit Tests + Golden Calibration Dataset |
| Image Processing | حفظ Bit Depth و Precision | Round-trip و Reference Tests |
| Histology | Pipeline تخصصی Stain/Tissue/Cell | Benchmark روی Datasetهای معتبر |
| AI | Inference قابل‌تکرار، مدل نسخه‌دار و Tile-aware | Model Evaluation Report |
| UX | Project-centric Workbench بدون پیچیدگی غیرضروری | Task Completion/Usability Study |
| Interoperability | Import/Export موفق با ابزارهای مرجع | Cross-Application Round-trip |
| Reliability | Recovery بعد از Crash و خطا | Crash/Recovery Test Suite |
| Privacy | Offline-first و رضایت صریح | Privacy Tests و Threat Model |
| Extensibility | Plugin API امن و نسخه‌دار | Sample Plugin + Isolation Test |

## 21.1 مزیت رقابتی پیشنهادی TissueAI

مزیت TissueAI نباید صرفاً «ImageJ با ظاهر مدرن» یا «QuPath با AI بیشتر» باشد. پیشنهاد جایگاه محصول:

**An integrated, offline-first computational histology workstation combining high-performance WSI viewing, scientifically correct image processing, reproducible AI analysis, and project-level research workflows.**

چهار وعده اصلی محصول:

1. **Trustworthy Data:** Calibration، Metadata، Pixel Precision و Provenance معتبر.
2. **Fast Exploration:** WSI/Multidimensional Viewer سریع، Tile-based و Layer-oriented.
3. **Integrated Analysis:** Histology، Morphometry، AI، Spatial و Multiplex در یک Project.
4. **Reproducible Research:** Project، Jobs، Workflow، Model Version، Reports و Interoperability.

---

# 22. منابع و پیوندهای بررسی

## سورس TissueAI

- [Repository](https://github.com/amirrezamortazavifard/TissueAI)
- [options.md — ImageJ/Fiji Capability Expansion](https://github.com/amirrezamortazavifard/TissueAI/blob/main/options.md)
- [README.md](https://github.com/amirrezamortazavifard/TissueAI/blob/main/README.md)
- [WSI Reader](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/wsi/reader.rs)
- [WSI Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/wsi.rs)
- [Scientific Image Model](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/scientific_models/scientific_image.rs)
- [Image Processing Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/image_processing.rs)
- [ROI Measurement](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/measurement.rs)
- [ROI Manager](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/roi/manager.rs)
- [Project Commands](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/commands/project.rs)
- [Project Model](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/project/mod.rs)
- [Jobs](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/jobs/mod.rs)
- [Web Server](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/llm/web_server.rs)
- [Model Crypto](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/crypto.rs)
- [Provider Secrets](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/src/llm/provider_secrets.rs)
- [Tauri Configuration](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/tauri.conf.json)
- [Tauri Capability](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/capabilities/default.json)
- [Home UI](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src/components/pages/Home.tsx)
- [Scientific Project Route Page](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src/pages/project/ProjectPage.tsx)
- [package.json](https://github.com/amirrezamortazavifard/TissueAI/blob/main/package.json)
- [Cargo.toml](https://github.com/amirrezamortazavifard/TissueAI/blob/main/src-tauri/Cargo.toml)

## نرم‌افزارها و استانداردهای مرجع

- [Fiji](https://fiji.sc/) — Scientific image analysis distribution.
- [ImageJ2](https://imagej.net/software/imagej2/) — extensible image analysis framework.
- [ImgLib2](https://imagej.net/libs/imglib2/) — multidimensional data structures and algorithms.
- [QuPath Documentation](https://qupath.readthedocs.io/) — digital pathology workflow, annotation, detection, classification and measurement.
- [napari](https://napari.org/) — multidimensional, layer-based image viewer and plugin ecosystem.
- [OpenSlide](https://openslide.org/) — whole-slide image access and supported vendor formats.
- [OME-TIFF](https://ome-model.readthedocs.io/en/stable/ome-tiff/) — OME metadata in TIFF.
- [OME-NGFF / OME-Zarr](https://ngff.openmicroscopy.org/) — chunked, multiscale bioimaging data specification.
- [OMERO](https://www.openmicroscopy.org/omero/) — microscopy data management and collaboration.

---

# 23. جمع‌بندی نهایی و ترتیب اولویت واقعی

اگر هدف این است که TissueAI در سطح بهترین Workstationهای تحلیل تصاویر علمی رقابت کند، ترتیب تصمیم‌ها باید چنین باشد:

1. **امنیت:** Web Server داخلی، Admin API، CSP و Model Key Management را سخت‌سازی کن.
2. **درستی داده:** Calibration، Pixel Precision، Axis Model و Metadata را قابل‌اعتماد کن.
3. **WSI واقعی:** Native Reader، Tile Access، Pyramid واقعی و Memory Budget را کامل کن.
4. **پایداری پروژه:** Project Persistence، Save Error Handling، Schema Migration، Asset Relink و Crash Recovery.
5. **اجرای قابل‌کنترل:** Job Scheduler واقعی و Resource Manager.
6. **پردازش علمی:** Typed Filters، Morphology، Histology و Morphometry با Golden Tests.
7. **تجربه کاربری:** Scientific Project Workspace و Viewer واحد، به‌جای چند ابزار پراکنده.
8. **AI قابل‌تکرار:** Model Registry، Tile-aware Inference، Benchmark و Human Review.
9. **تمایز علمی:** Tissue QC، Multiplex IF، Spatial Graph، Serial Section Registration و 3D Microscopy.
10. **اکوسیستم:** OME/QuPath/Fiji/napari/OMERO Interoperability و Plugin SDK.

**قانون نهایی:** هیچ قابلیت جدیدی نباید صحت علمی، امنیت، پایداری پروژه یا Performance Viewer را تضعیف کند. TissueAI زمانی به یک محصول ممتاز نزدیک می‌شود که کاربر بتواند یک اسلاید بزرگ و واقعی را باز کند، داده را با دقت علمی مشاهده و اندازه‌گیری کند، تحلیل AI را با مدل و پارامتر مشخص اجرا کند، نتیجه را بعداً دقیقاً بازتولید کند و همان داده را بدون از دست‌رفتن Metadata در ابزارهای استاندارد دیگر استفاده کند.
