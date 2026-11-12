import { useState } from "react";
import { BookOpen, Languages, Keyboard, Search, Microscope, Palette, Box, FileText, ChevronDown, ChevronRight } from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  titleFa: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  contentFa: React.ReactNode;
}

const sections: HelpSection[] = [
  {
    id: "introduction",
    title: "Introduction: What is TissueAI?",
    titleFa: "مقدمه: TissueAI چیست؟",
    icon: <BookOpen size={15} />,
    content: (
      <div className="space-y-3 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <p>
          <strong style={{ color: "var(--text-1)" }}>TissueAI</strong> is an advanced platform for educational and research purposes
          in histology and pathology. It uses AI algorithms and deep learning models to enable{" "}
          <strong style={{ color: "var(--text-1)" }}>fast, accurate, objective, and reproducible</strong> microscopic image analysis.
        </p>
        <p>
          The platform supports multiple analysis tools including Object Detection (YOLO),
          Color Analysis with stain separation, a General Image Editor, and a 3D Viewer for
          biological cell visualization.
        </p>
      </div>
    ),
    contentFa: (
      <div className="space-y-3 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <p>
          <strong style={{ color: "var(--text-1)" }}>TissueAI</strong> یک پیشرفته پلتفرم برای اهداف آموزشی و پژوهشی در
          بافت‌شناسی و آسیب‌شناسی است. این سیستم از الگوریتم‌های هوش مصنوعی و مدل‌های یادگیری عمیق
          برای تحلیل <strong style={{ color: "var(--text-1)" }}>سریع، دقیق، عینی و تکرارپذیر</strong> تصاویر میکروسکوپی استفاده می‌کند.
        </p>
        <p>
          این پلتفرم ابزارهای متعددی از جمله شیایی اشیا (YOLO)، تحلیل رنگ با جداسازی رنگ‌ها،
          ویرایشگر تصویر عمومی و نمایشگر سه‌بعدی برای تجسم سلول‌های زیستی ارائه می‌دهد.
        </p>
      </div>
    ),
  },
  {
    id: "detection",
    title: "Step-by-Step: Object Detection",
    titleFa: "راهنمای گام به گام: شیایی اشیا",
    icon: <Microscope size={15} />,
    content: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>Step 1: Navigate to Detection</h4>
          <p>Click <strong>"Detection"</strong> in the bottom dock navigation bar to open the detection tool.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>Step 2: Select a Model</h4>
          <p>Choose an AI model from the dropdown. Models are loaded from the configured models directory.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>Step 3: Select an Image</h4>
          <p>Click <strong>"Select Image"</strong> to pick a single image file (.jpg, .png, .bmp), or{" "}
            <strong>"Select Folder"</strong> for batch processing of multiple images.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>Step 4: Start Analysis</h4>
          <p>Click <strong>"START"</strong> to run detection. Results appear as colored bounding boxes on the
            image with a results table showing class names and confidence scores.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>Step 5: Export Results</h4>
          <p>Click <strong>"Export CSV"</strong> to save detection results including image name, detection count,
            processing time, and bounding box coordinates.</p>
        </div>
      </div>
    ),
    contentFa: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>مرحله ۱: رفتن به بخش شیایی</h4>
          <p>روی <strong>"Detection"</strong> در نوار پایین کلیک کنید تا ابزار شیایی باز شود.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>مرحله ۲: انتخاب مدل</h4>
          <p>یک مدل هوش مصنوعی از لیست کشویی انتخاب کنید. مدل‌ها از پوشه تنظیم‌شده بارگذاری می‌شوند.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>مرحله ۳: انتخاب تصویر</h4>
          <p>روی <strong>"Select Image"</strong> کلیک کنید تا یک تصویر انتخاب شود (.jpg, .png, .bmp)، یا{" "}
            <strong>"Select Folder"</strong> برای پردازش دسته‌ای چند تصویر.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>مرحله ۴: شروع تحلیل</h4>
          <p>روی <strong>"START"</strong> کلیک کنید. نتایج به صورت جعبه‌های رنگی روی تصویر نمایش داده می‌شوند
            با جدول نتایج شامل نام کلاس و امتیاز اطمینان.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-1" style={{ color: "var(--text-1)" }}>مرحله ۵: خروجی CSV</h4>
          <p>روی <strong>"Export CSV"</strong> کلیک کنید تا نتایج شامل نام تصویر، تعداد شیایی‌ها،
            زمان پردازش و مختصات جعبه‌ها ذخیره شوند.</p>
        </div>
      </div>
    ),
  },
  {
    id: "color-analysis",
    title: "Color Analysis Tool",
    titleFa: "ابزار تحلیل رنگ",
    icon: <Palette size={15} />,
    content: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <p>The Color Analysis tool provides powerful features for histological stain analysis:</p>
        <ul className="space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="badge badge-blue shrink-0 mt-0.5">K-Means</span>
            <span>Dominant color clustering and palette extraction</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-purple shrink-0 mt-0.5">Deconvolution</span>
            <span>Stain separation for H&E, Masson's Trichrome, PAS, Giemsa, and more</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-green shrink-0 mt-0.5">Region</span>
            <span>ROI-based elliptical region analysis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-yellow shrink-0 mt-0.5">Replace</span>
            <span>Color replacement and isolation modes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-cyan shrink-0 mt-0.5">Heatmap</span>
            <span>Centroid density heatmap generation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-red shrink-0 mt-0.5">Inpaint</span>
            <span>Artifact removal with mean-value inpainting</span>
          </li>
        </ul>
      </div>
    ),
    contentFa: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <p>ابزار تحلیل رنگ ویژگی‌های قدرتمندی برای تحلیل رنگ‌های بافت‌شناسی ارائه می‌دهد:</p>
        <ul className="space-y-2 mr-4">
          <li className="flex items-start gap-2">
            <span className="badge badge-blue shrink-0 mt-0.5">K-Means</span>
            <span>خوشه‌بندی رنگ‌های غالب و استخراج پالت</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-purple shrink-0 mt-0.5">تجزیه رنگ</span>
            <span>جداسازی رنگ‌ها برای H&E، تریکروم ماسون، PAS، ژیمز و بیشتر</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-green shrink-0 mt-0.5">ناحیه</span>
            <span>تحلیل ناحیه بیضی‌شکل</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-yellow shrink-0 mt-0.5">جایگزینی</span>
            <span>جایگزینی و ایزوله کردن رنگ‌ها</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-cyan shrink-0 mt-0.5">نقشه حرارتی</span>
            <span>تولید نقشه حرارتی تراکم مرکز ثقل</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="badge badge-red shrink-0 mt-0.5">حذف نقص</span>
            <span>حذف ناهنجاری‌ها با رنگ‌آمیزی مقدار میانگین</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "editor",
    title: "Image Editor",
    titleFa: "ویرایشگر تصویر",
    icon: <FileText size={15} />,
    content: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <p>The General Image Editor provides 15 tools for image manipulation:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Select / Pan", "Brush / Eraser", "Line / Arrow",
            "Rectangle / Ellipse", "Flood Fill", "Text",
            "Crop / Rotate", "Eyedropper", "Scale Bar", "Magnifier",
          ].map((tool) => (
            <div key={tool} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8F5" }} />
              <span className="text-[12px]">{tool}</span>
            </div>
          ))}
        </div>
        <p>Supports 2-level undo/redo, pan with Ctrl+drag, zoom with Ctrl+Scroll, and keyboard shortcuts.</p>
      </div>
    ),
    contentFa: (
      <div className="space-y-4 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <p>ویرایشگر تصویر عمومی ۱۵ ابزار برای ویرایش تصویر ارائه می‌دهد:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "انتخاب / حرکت", "قلممو / پاک‌کن", "خط / فلش",
            "مستطیل / بیضی", "پرکردن", "متن",
            "برش / چرخش", "قلم‌رنگی", "مقیاس", "ذره‌بین",
          ].map((tool) => (
            <div key={tool} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8F5" }} />
              <span className="text-[12px]">{tool}</span>
            </div>
          ))}
        </div>
        <p>پشتیبانی از ۲ سطح بازگشت/بازانجام، حرکت با Ctrl+drag، زوم با Ctrl+Scroll و میانبرهای صفحه‌کلید.</p>
      </div>
    ),
  },
  {
    id: "3d-viewer",
    title: "3D Viewer Guide",
    titleFa: "راهنمای نمایشگر سه‌بعدی",
    icon: <Box size={15} />,
    content: (
      <div className="space-y-5 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>Mouse Controls</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: "Rotate", key: "Right-click + Drag" },
              { action: "Pan", key: "Shift + Left-click + Drag" },
              { action: "Zoom", key: "Scroll Wheel" },
              { action: "Select Object", key: "Left-click" },
            ].map((c) => (
              <div key={c.action} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <span className="text-[12px]">{c.action}</span>
                <kbd className="badge badge-gray text-[10px]">{c.key}</kbd>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>Keyboard Controls</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: "Move Object", key: "WASD" },
              { action: "Move Up/Down", key: "Q / E" },
              { action: "Speed Boost", key: "Hold Shift" },
              { action: "Camera Presets", key: "1-6 (views)" },
            ].map((c) => (
              <div key={c.action} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <span className="text-[12px]">{c.action}</span>
                <kbd className="badge badge-gray text-[10px]">{c.key}</kbd>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>Camera Preset Keys</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "1", view: "Front" },
              { key: "2", view: "Back" },
              { key: "3", view: "Right" },
              { key: "4", view: "Left" },
              { key: "5", view: "Top" },
              { key: "6", view: "Bottom" },
            ].map((c) => (
              <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <kbd className="badge badge-blue text-[10px]">{c.key}</kbd>
                <span className="text-[12px]">{c.view}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>Sidebar Panels</h4>
          <ul className="space-y-1 ml-4">
            <li><strong>Model Library:</strong> Add predefined biological models (Erythrocyte, Neuron, Myocyte, etc.)</li>
            <li><strong>Tools:</strong> Object scale, color, position, lighting, background, wireframe</li>
            <li><strong>File:</strong> Save/Load scene (.tissue3d), import OBJ/STL/glTF, screenshot</li>
            <li><strong>Scene:</strong> Object list with visibility toggles</li>
          </ul>
        </div>
      </div>
    ),
    contentFa: (
      <div className="space-y-5 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>کنترل‌های ماوس</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: "چرخش", key: "کلیک راست + درگ" },
              { action: "حرکت", key: "Shift + کلیک چپ + درگ" },
              { action: "زوم", key: "چرخاندن اسکرول" },
              { action: "انتخاب", key: "کلیک چپ" },
            ].map((c) => (
              <div key={c.action} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <span className="text-[12px]">{c.action}</span>
                <kbd className="badge badge-gray text-[10px]">{c.key}</kbd>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>کنترل‌های صفحه‌کلید</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: "حرکت شیء", key: "WASD" },
              { action: "بالا/پایین", key: "Q / E" },
              { action: "سرعت بیشتر", key: "نگه‌داشتن Shift" },
              { action: "پیش‌تنظیم دوربین", key: "۱-۶ (نمایش‌ها)" },
            ].map((c) => (
              <div key={c.action} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <span className="text-[12px]">{c.action}</span>
                <kbd className="badge badge-gray text-[10px]">{c.key}</kbd>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>کلیدهای پیش‌تنظیم دوربین</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "۱", view: "جلو" },
              { key: "۲", view: "عقب" },
              { key: "۳", view: "راست" },
              { key: "۴", view: "چپ" },
              { key: "۵", view: "بالا" },
              { key: "۶", view: "پایین" },
            ].map((c) => (
              <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <kbd className="badge badge-blue text-[10px]">{c.key}</kbd>
                <span className="text-[12px]">{c.view}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text-1)" }}>پنل‌های جانبی</h4>
          <ul className="space-y-1 mr-4">
            <li><strong>کتابخانه مدل‌ها:</strong> افزودن مدل‌های زیستی پیش‌فرض (گلبول قرمز، نورون و غیره)</li>
            <li><strong>ابزارها:</strong> مقیاس، رنگ، موقعیت شیء، نورپردازی، پس‌زمینه</li>
            <li><strong>فایل:</strong> ذخیره/بارگذاری صحنه (.tissue3d)، واردات OBJ/STL/glTF، اسکرین‌شات</li>
            <li><strong>صحنه:</strong> لیست اشیا با کنترل‌های نمایش</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "support",
    title: "Support",
    titleFa: "پشتیبانی",
    icon: <Search size={15} />,
    content: (
      <div className="space-y-3 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }}>
        <p>For community inquiries and technical support:</p>
        <div className="flex items-center gap-3">
          <a href="mailto:mortazavi.a.stu@gmu.ac.ir" className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2" style={{ color: "#5BA8F5" }}>
            mortazavi.a.stu@gmu.ac.ir
          </a>
          <a href="https://t.me/reallyFard" target="_blank" rel="noopener noreferrer" className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2" style={{ color: "#5BA8F5" }}>
            Telegram: @reallyFard
          </a>
        </div>
      </div>
    ),
    contentFa: (
      <div className="space-y-3 text-[13px] leading-[1.8]" style={{ color: "var(--text-2)" }} dir="rtl">
        <p>برای سوالات، مشارکت در پروژه و پشتیبانی فنی:</p>
        <div className="flex items-center gap-3">
          <a href="mailto:mortazavi.a.stu@gmu.ac.ir" className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2" style={{ color: "#5BA8F5" }}>
            mortazavi.a.stu@gmu.ac.ir
          </a>
          <a href="https://t.me/reallyFard" target="_blank" rel="noopener noreferrer" className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2" style={{ color: "#5BA8F5" }}>
            تلگرام: @reallyFard
          </a>
        </div>
      </div>
    ),
  },
];

function CollapsibleSection({
  section,
  lang,
  defaultOpen,
}: {
  section: HelpSection;
  lang: "en" | "fa";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="glass-card-static overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left transition-colors"
        style={{ background: open ? "var(--bg-2)" : "transparent" }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
          background: "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(91,168,245,0.05))",
          color: "#5BA8F5",
        }}>
          {section.icon}
        </div>
        <span style={{ color: "var(--text-1)" }} className="text-[14px] font-medium flex-1">
          {lang === "en" ? section.title : section.titleFa}
        </span>
        {open ? <ChevronDown size={14} style={{ color: "var(--text-4)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-4)" }} />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 animate-fade-in">
          <div className="h-[1px] mb-4" style={{ background: "var(--border-2)" }} />
          {lang === "en" ? section.content : section.contentFa}
        </div>
      )}
    </div>
  );
}

export default function Help() {
  const [lang, setLang] = useState<"en" | "fa">("en");

  return (
    <div className="flex-1 overflow-y-auto relative page-enter">
      <div className="max-w-[750px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 style={{ color: "var(--text-1)" }} className="text-[28px] font-bold leading-none tracking-tight">
              Help & Documentation
            </h1>
            <p style={{ color: "var(--text-3)" }} className="text-[13px] mt-2">
              {lang === "en" ? "Complete guide to using TissueAI" : "راهنمای جامع استفاده از TissueAI"}
            </p>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "fa" : "en")}
            className="btn-glass flex items-center gap-2 text-[13px]"
          >
            <Languages size={14} />
            {lang === "en" ? "Fa" : "En"}
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3" dir={lang === "fa" ? "rtl" : "ltr"}>
          {sections.map((section, i) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              lang={lang}
              defaultOpen={i === 0}
            />
          ))}
        </div>

        {/* Keyboard Shortcuts Quick Reference */}
        <div className="glass-card-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard size={14} style={{ color: "#5BA8F5" }} />
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
              {lang === "en" ? "Quick Keyboard Reference" : "مرجع سریع صفحه‌کلید"}
            </span>
            <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "Ctrl+Z", action: "Undo", actionFa: "بازگشت" },
              { key: "Ctrl+Y", action: "Redo", actionFa: "بازانجام" },
              { key: "Ctrl+S", action: "Save/Export", actionFa: "ذخیره" },
              { key: "Ctrl+Scroll", action: "Zoom", actionFa: "زوم" },
              { key: "Space+Drag", action: "Pan (Editor)", actionFa: "حرکت (ویرایشگر)" },
              { key: "Escape", action: "Cancel/Deselect", actionFa: "لغو" },
            ].map((s) => (
              <div key={s.key} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  {lang === "en" ? s.action : s.actionFa}
                </span>
                <kbd className="badge badge-gray text-[10px]">{s.key}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
