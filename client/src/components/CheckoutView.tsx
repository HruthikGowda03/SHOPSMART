import { useEffect, useState } from 'react';
import { useShop } from '../shop';
import { formatINR } from '../money';
import SummaryPanel from './SummaryPanel';

/**
 * Checkout with a SIMULATED payment.
 * The amount box is deliberately editable: it is what an attacker (or a
 * curious student) would change to try Bug 1.
 */
export default function CheckoutView() {
  const { summary, placeOrder, setView, busy } = useShop();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Keep the box pre-filled with whatever the server currently asks for.
  useEffect(() => {
    if (summary) setAmount(String(summary.displayedTotal));
  }, [summary]);

  if (!summary) return null;

  if (summary.items.length === 0) {
    return (
      <section className="section">
        <div className="section__head">
          <h2>Checkout</h2>
        </div>
        <div className="panel empty-state">
          <h3>There is nothing to check out</h3>
          <p>Add a product to your cart first.</p>
          <button type="button" className="btn btn--primary" onClick={() => setView('shop')}>
            Browse the shop
          </button>
        </div>
      </section>
    );
  }

  const parsed = Number(amount);
  const amountInvalid = amount.trim() === '' || !Number.isFinite(parsed) || parsed <= 0;

  const pay = async () => {
    setError(null);
    const result = await placeOrder(parsed);
    if (!result.ok) setError(result.message);
  };

  return (
    <section className="section">
      <div className="section__head">
        <h2>Checkout</h2>
        <span className="section__note">Simulated payment &middot; no real money, no payment gateway</span>
      </div>

      <div className="cart-layout">
        <div className="panel">
          <h3 className="panel__title">1. Items in this order</h3>
          <ul className="review-list">
            {summary.items.map((line) => (
              <li key={line.productId}>
                <span>
                  {line.name} <em>× {line.quantity}</em>
                </span>
                <span>{formatINR(line.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <h3 className="panel__title">2. Payment</h3>
          <p className="panel__hint">
            You are paying <strong>{formatINR(summary.displayedTotal)}</strong> for this order.
          </p>

          <div className="payment-row">
            <label className="field">
              <span>Amount to pay (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
              />
            </label>
            <button type="button" className="btn btn--primary btn--lg" onClick={() => void pay()} disabled={busy || amountInvalid}>
              {busy ? 'Processing…' : `Pay ${amountInvalid ? '' : formatINR(parsed)}`}
            </button>
          </div>
          <p className="panel__hint panel__hint--muted">Demo store — this payment is simulated and no real money moves.</p>

          {amountInvalid && <div className="alert alert--warn">Enter a positive amount to continue.</div>}
          {error && <div className="alert alert--danger">{error}</div>}

          <button type="button" className="btn btn--ghost" onClick={() => setView('cart')}>
            ← Back to cart
          </button>
        </div>

        <aside className="cart-aside">
          <SummaryPanel summary={summary} title="Order total" />
        </aside>
      </div>
    </section>
  );
}