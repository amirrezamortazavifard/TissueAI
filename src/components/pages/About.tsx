import { Send, Mail, ExternalLink, Heart } from "lucide-react";
import Logo from "../ui/Logo";

export default function About() {
  return (
    <div className="flex-1 overflow-y-auto relative page-enter">
      <div className="max-w-[700px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <div className="mb-4">
            <Logo size={72} variant="icon" animated />
          </div>
          <h1 style={{ color: "var(--text-1)" }} className="text-[28px] font-bold leading-none tracking-tight">
            About TissueAI
          </h1>
          <p style={{ color: "var(--text-3)" }} className="text-[13px] mt-2">
            Histopathology & Cellular Intelligence Platform
          </p>
        </div>

        {/* Project Description Card */}
        <div className="glass-card-static p-6">
          <div className="flex items-center gap-2 mb-4">
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
              About the Project
            </span>
            <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
          </div>

          <div className="space-y-4">
            <p style={{ color: "var(--text-2)" }} className="text-[13px] leading-[1.8] text-justify">
              TissueAI is a specialized software for <strong style={{ color: "var(--text-1)" }}>cellular identification and diagnosis</strong> in
              the human body. Built on artificial intelligence using <strong style={{ color: "#5BA8F5" }}>PyTorch</strong> and{" "}
              <strong style={{ color: "#5BA8F5" }}>YOLO (You Only Look Once)</strong> architecture with Convolutional Neural Networks
              (CNNs) for image recognition.
            </p>
            <p style={{ color: "var(--text-2)" }} className="text-[13px] leading-[1.8] text-justify">
              The system is designed for educational and research purposes in histology and pathology.
              It uses advanced AI algorithms and deep learning models to enable fast, accurate, objective,
              and reproducible microscopic image analysis.
            </p>
            <p style={{ color: "var(--text-2)" }} className="text-[13px] leading-[1.8] text-justify" dir="rtl">
              نرم‌افزار TissueAI یک ابزار تخصصی برای <strong style={{ color: "var(--text-1)" }}>شناسایی و تشخیص سلول‌ها</strong> در
              بدن انسان است. این سیستم بر پایه هوش مصنوعی با استفاده از{" "}
              <strong style={{ color: "#5BA8F5" }}>PyTorch</strong> و معماری{" "}
              <strong style={{ color: "#5BA8F5" }}>YOLO</strong> با شبکه‌های عصبی کانولوشنی (CNN)
              برای بازشناسی تصویر ساخته شده است. هدف آن تحلیل سریع، دقیق، عینی و تکرارپذیر تصاویر
              میکروسکوپی برای اهداف آموزشی و پژوهشی در بافت‌شناسی و آسیب‌شناسی است.
            </p>
          </div>
        </div>

        {/* Developer Card */}
        <div className="glass-card-static p-6">
          <div className="flex items-center gap-2 mb-5">
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
              Development Team
            </span>
            <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
          </div>

          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0" style={{
              background: "linear-gradient(135deg, rgba(91,168,245,0.2), rgba(139,92,246,0.15))",
              border: "1px solid rgba(91,168,245,0.15)",
            }}>
              <span style={{ color: "#5BA8F5", fontSize: "28px", fontWeight: 700 }}>AF</span>
            </div>
            <div className="flex-1">
              <h3 style={{ color: "var(--text-1)" }} className="text-[16px] font-semibold">
                Amirreza Mortazavi Fard
              </h3>
              <p style={{ color: "var(--text-3)" }} className="text-[12px] mt-0.5">
                (Amir Fard)
              </p>
              <p style={{ color: "var(--text-2)" }} className="text-[13px] mt-1">
                Full Stack Software Engineer (AI and Neural Networks)
              </p>

              <div className="flex items-center gap-3 mt-4">
                <a
                  href="https://t.me/reallyFard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2"
                  style={{ color: "#5BA8F5" }}
                >
                  <Send size={12} />
                  Telegram
                  <ExternalLink size={10} style={{ opacity: 0.5 }} />
                </a>
                <a
                  href="mailto:mortazavi.a.stu@gmu.ac.ir"
                  className="btn-glass text-[12px] py-2 px-3 flex items-center gap-2"
                  style={{ color: "#5BA8F5" }}
                >
                  <Mail size={12} />
                  Email
                  <ExternalLink size={10} style={{ opacity: 0.5 }} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="glass-card-static p-5">
          <div className="flex items-center gap-2 mb-4">
            <span style={{ color: "var(--text-4)" }} className="text-[10px] font-semibold tracking-widest uppercase">
              Built With
            </span>
            <div className="flex-1 h-[1px]" style={{ background: "var(--border-2)" }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Rust", color: "#f97316" },
              { label: "Tauri 2", color: "#f59e0b" },
              { label: "React 19", color: "#5BA8F5" },
              { label: "TypeScript", color: "#3b82f6" },
              { label: "TailwindCSS", color: "#06b6d4" },
              { label: "PyTorch", color: "#ef4444" },
              { label: "YOLOv8", color: "#22c55e" },
              { label: "ONNX Runtime", color: "#8b5cf6" },
            ].map((t) => (
              <span key={t.label} className="badge" style={{
                background: `${t.color}18`,
                color: t.color,
              }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
          <p style={{ color: "var(--text-5)" }} className="text-[11px] flex items-center justify-center gap-1.5">
            Made with <Heart size={10} style={{ color: "#ef4444" }} /> by Amir Fard
          </p>
          <p style={{ color: "var(--text-5)" }} className="text-[11px] mt-1">
            TissueAI v0.1.0 &mdash; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
