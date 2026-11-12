import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Notification } from "../contexts/NotificationContext";

const iconMap = {
  success: <CheckCircle2 size={15} />,
  error: <AlertCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info: <Info size={15} />,
};

const colorMap = {
  success: {
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
    text: "rgba(34,197,94,0.95)",
    icon: "#22c55e",
    glow: "rgba(34,197,94,0.15)",
  },
  error: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
    text: "rgba(239,68,68,0.95)",
    icon: "#ef4444",
    glow: "rgba(239,68,68,0.15)",
  },
  warning: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    text: "rgba(245,158,11,0.95)",
    icon: "#f59e0b",
    glow: "rgba(245,158,11,0.15)",
  },
  info: {
    bg: "rgba(91,168,245,0.08)",
    border: "rgba(91,168,245,0.2)",
    text: "rgba(91,168,245,0.95)",
    icon: "#5BA8F5",
    glow: "rgba(91,168,245,0.15)",
  },
};

interface ToastProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

export default function Toast({ notification, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const colors = colorMap[notification.type];

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(notification.id), 300);
  };

  return (
    <div
      className={`toast-notification ${isVisible && !isExiting ? "toast-enter" : ""} ${isExiting ? "toast-exit" : ""}`}
      style={{
        width: 340,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${colors.glow}`,
        backdropFilter: "blur(20px) saturate(1.3)",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: colors.icon,
          borderRadius: "14px 0 0 14px",
        }}
      />

      {/* Icon */}
      <div style={{ color: colors.icon, marginTop: 1, flexShrink: 0 }}>
        {iconMap[notification.type]}
      </div>

      {/* Message */}
      <p
        style={{
          color: colors.text,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.5,
          flex: 1,
          margin: 0,
          wordBreak: "break-word",
        }}
      >
        {notification.message}
      </p>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          color: "var(--text-4)",
          background: "none",
          border: "none",
          padding: 2,
          cursor: "pointer",
          flexShrink: 0,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-4)")}
      >
        <X size={13} />
      </button>

      {/* Progress bar for auto-dismiss */}
      {notification.duration && notification.duration > 0 && (
        <div
          className="toast-progress"
          style={{
            position: "absolute",
            bottom: 0,
            left: 3,
            right: 0,
            height: 2,
            background: `${colors.icon}40`,
            borderRadius: "0 0 0 14px",
            overflow: "hidden",
          }}
        >
          <div
            className="toast-progress-fill"
            style={{
              height: "100%",
              background: colors.icon,
              borderRadius: "0 0 0 14px",
              animation: `toast-progress-shrink ${notification.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
