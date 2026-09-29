export default function Toasts({ toasts, dismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <p>{t.text}</p>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
