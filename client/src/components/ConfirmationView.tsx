import { useShop } from '../shop';
import { formatINR } from '../money';

/** A normal-looking receipt. The numbers are simply what the backend charged. */
export default function ConfirmationView() {
  const { lastOrder, setView } = useShop();

  if (!lastOrder) {
    return (
      <section className="section">
        <div className="panel empty-state">
          <h3>No order yet</h3>
          <p>Complete a checkout and your receipt will appear here.</p>
          <button type="button" className="btn btn--primary" onClick={() => setView('shop')}>
            Browse the shop
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section__head">
        <h2>Thank you for your order</h2>
        <span className="section__note">A confirmation email is on its way (simulated)</span>
      </div>

      <div className="panel receipt">
        <div className="receipt__head">
          <div>
            <p className="receipt__label">Order reference</p>
            <h3 className="receipt__id">{lastOrder.id}</h3>
            <p className="receipt__date">{new Date(lastOrder.placedAt).toLocaleString('en-IN')}</p>
          </div>
          <span className="receipt__status">{lastOrder.status}</span>
        </div>

        <ul className="receipt__items">
          {lastOrder.items.map((line) => (
            <li key={line.productId}>
              <span>
                {line.name} <em>× {line.quantity}</em>
              </span>
              <span>{formatINR(line.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="receipt__rows">
          <div className="receipt__row">
            <span>Subtotal</span>
            <span>{formatINR(lastOrder.subtotal)}</span>
          </div>
          <div className="receipt__row">
            <span>Shipping</span>
            <span>{lastOrder.shippingFee === 0 ? 'FREE' : formatINR(lastOrder.shippingFee)}</span>
          </div>
          <div className="receipt__row receipt__row--total">
            <span>Total</span>
            <span>{formatINR(lastOrder.chargedTotal)}</span>
          </div>
          <div className="receipt__row receipt__row--muted">
            <span>Paid by card</span>
            <span>{formatINR(lastOrder.paymentAmount)}</span>
          </div>
        </div>

        <div className="receipt__actions">
          <button type="button" className="btn btn--primary" onClick={() => setView('shop')}>
            Continue shopping
          </button>
        </div>
      </div>
    </section>
  );
}