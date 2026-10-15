import { useEffect, useState } from 'react';
import { useShop } from '../shop';
import BugLab from './BugLab';
import EpistemologyPanel from './EpistemologyPanel';
import type { TestResult } from '../tests/bugTests';

/**
 * Presenter-only drawer.
 *
 * Nothing in the storefront links here. The audience sees an ordinary shop;
 * the presenter opens this with one of three discreet gestures:
 *
 *   1. Ctrl + Shift + P           (keyboard shortcut, toggles)
 *   2. double-click "Store information" in the footer
 *   3. open  http://localhost:5173/#presenter
 *
 * Esc or the Close button closes it.
 */
export default function PresenterPanel({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { mode, setMode, resetDemo } = useShop();
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'P' || event.key === 'p')) {
        event.preventDefault();
        if (open) onClose();
        else onOpen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onOpen]);

  // #presenter can also be typed or bookmarked while the page is already open.
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#presenter') onOpen();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [onOpen]);

  if (!open) return null;

  const switchTo = (next: 'buggy' | 'fixed') => {
    setResults([]); // results belong to the mode that produced them
    void setMode(next);
  };

  return (
    <div className="presenter" role="dialog" aria-modal="true" aria-label="Presenter controls">
      <div className="presenter__backdrop" onClick={onClose} />

      <aside className="presenter__drawer">
        <header className="presenter__head">
          <div>
            <h3>Presenter controls</h3>
            <p>Hidden from the storefront. Esc or Ctrl+Shift+P to close.</p>
          </div>
          <button type="button" className="presenter__close" onClick={onClose} aria-label="Close presenter controls">
            ×
          </button>
        </header>

        <section className="presenter__section">
          <h4>Demonstration mode</h4>
          <div className="presenter__modes">
            <button
              type="button"
              className={mode === 'buggy' ? 'presenter__mode is-active is-buggy' : 'presenter__mode'}
              onClick={() => switchTo('buggy')}
            >
              <strong>Buggy mode</strong>
              <span>Four deliberate defects are active. Use this before the audience arrives.</span>
            </button>
            <button
              type="button"
              className={mode === 'fixed' ? 'presenter__mode is-active is-fixed' : 'presenter__mode'}
              onClick={() => switchTo('fixed')}
            >
              <strong>Fixed mode</strong>
              <span>All four defects are corrected by the backend. Use this to close the demo.</span>
            </button>
          </div>

          <button type="button" className="btn btn--ghost btn--block" onClick={() => void resetDemo()}>
            Reset demo data (stock, orders, cart)
          </button>
        </section>

        <details className="presenter__disclosure">
          <summary>Self-check: run the four tests before you present</summary>
          <BugLab results={results} onResults={setResults} />
        </details>

        <details className="presenter__disclosure">
          <summary>Presenter notes: claim, question, evidence</summary>
          <EpistemologyPanel results={results} />
        </details>
      </aside>
    </div>
  );
}