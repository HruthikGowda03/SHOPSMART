import { formatINR } from '../money';
import type { OrderSummary } from '../types';

/**
 * Order summary (subtotal, shipping, total).
 *
 * It renders exactly what the server sent. In the buggy demo the numbers do not
 * add up, which is exactly what a curious shopper is meant to notice - so this
 * component never highlights a discrepancy itself.
 */
export default function SummaryPanel({
  summary,
  title = 'Order summary',
}: {
  summary: OrderSummary;
  title?: string;
}) {
  return (
    <div className="panel summary">
      <h3 className="summary__title">{title}</h3>

      {summary.items.length === 0 ? (
        <p className="summary__empty">Your cart is empty. Add a product to see the totals.</p>
      ) : (
        <ul className="summary__lines">
          {summary.items.map((line) => (
            <li key={line.productId} className="summary__line">
              <span>
                {line.name} <em>x{line.quantity}</em>
              </span>
              <span>{formatINR(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="summary__row">
        <span>Subtotal</span>
        <span>{formatINR(summary.subtotal)}</span>
      </div>
      <div className="summary__row">
        <span>
          Shipping
          {summary.shipping.freeShippingApplied ? (
            <small> (free above {formatINR(summary.shipping.freeAbove)})</small>
          ) : (
            <small> (flat {formatINR(summary.shipping.fee)})</small>
          )}
        </span>
        <span>{summary.shippingFee === 0 ? 'FREE' : formatINR(summary.shippingFee)}</span>
      </div>
      <div className="summary__row summary__row--total">
        <span>Total</span>
        <span data-testid="displayed-total">{formatINR(summary.displayedTotal)}</span>
      </div>
    </div>
  );
}