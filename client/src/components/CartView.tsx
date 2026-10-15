import { useShop } from '../shop';
import { formatINR } from '../money';
import SummaryPanel from './SummaryPanel';

export default function CartView() {
  const { summary, cart, changeQuantity, removeItem, emptyCart, setView, busy, products } = useShop();

  if (!summary || !cart) return null;

  return (
    <section className="section">
      <div className="section__head">
        <h2>Shopping cart</h2>
        <button type="button" className="btn btn--ghost" onClick={() => void emptyCart()} disabled={busy || summary.items.length === 0}>
          Clear cart
        </button>
      </div>

      <div className="cart-layout">
        <div className="panel">
          {summary.items.length === 0 ? (
            <div className="empty-state">
              <h3>Your cart is empty</h3>
              <p>Pick something from the shop and it will appear here.</p>
              <button type="button" className="btn btn--primary" onClick={() => setView('shop')}>
                Browse the shop
              </button>
            </div>
          ) : (
            <ul className="cart-list">
              {summary.items.map((line) => {
                const product = products.find((item) => item.id === line.productId);
                return (
                  <li key={line.productId} className="cart-item">
                    <img className="cart-item__media" src={product?.image} alt={line.name} />
                    <div className="cart-item__info">
                      <h3>{line.name}</h3>
                      <p>
                        {formatINR(line.unitPrice)} × {line.quantity} = <strong>{formatINR(line.lineTotal)}</strong>
                      </p>
                    </div>

                    <div className="cart-item__controls">
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Decrease quantity of ${line.name}`}
                        onClick={() => void changeQuantity(line.productId, Math.max(1, line.quantity - 1))}
                        disabled={busy}
                      >
                        −
                      </button>
                      <span className="qty-btn__value">{line.quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Increase quantity of ${line.name}`}
                        onClick={() => void changeQuantity(line.productId, line.quantity + 1)}
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      onClick={() => void removeItem(line.productId)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="cart-aside">
          <SummaryPanel summary={summary} />
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => setView('checkout')}
            disabled={summary.items.length === 0}
          >
            Continue to checkout
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setView('shop')}>
            Continue shopping
          </button>
        </aside>
      </div>
    </section>
  );
}