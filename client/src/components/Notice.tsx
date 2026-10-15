import { useShop } from '../shop';

export default function Notice() {
  const { notice, dismissNotice } = useShop();
  if (!notice) return null;

  return (
    <div className="toast-layer" role="status" aria-live="polite">
      <div className={`toast toast--${notice.kind}`}>
        <span>{notice.text}</span>
        <button type="button" className="toast__close" onClick={dismissNotice} aria-label="Dismiss message">
          ×
        </button>
      </div>
    </div>
  );
}