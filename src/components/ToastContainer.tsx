import { useNotification } from "../contexts/NotificationContext";
import Toast from "./Toast";

export default function ToastContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div
      className="toast-container"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {notifications.map((notif) => (
        <div key={notif.id} style={{ pointerEvents: "auto" }}>
          <Toast notification={notif} onRemove={removeNotification} />
        </div>
      ))}
    </div>
  );
}
