import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
  timestamp: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: NotificationType, duration?: number) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

let notifCounter = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (message: string, type: NotificationType, duration: number = 4000) => {
      const id = `notif-${++notifCounter}`;
      const notif: Notification = { id, message, type, duration, timestamp: Date.now() };
      setNotifications((prev) => [...prev, notif]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  const clearAll = useCallback(() => setNotifications([]), []);

  const success = useCallback((msg: string, dur?: number) => addNotification(msg, "success", dur), [addNotification]);
  const error = useCallback((msg: string, dur?: number) => addNotification(msg, "error", dur ?? 6000), [addNotification]);
  const info = useCallback((msg: string, dur?: number) => addNotification(msg, "info", dur), [addNotification]);
  const warning = useCallback((msg: string, dur?: number) => addNotification(msg, "warning", dur), [addNotification]);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll, success, error, info, warning }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
