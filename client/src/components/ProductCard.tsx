import { useState } from 'react';
import { formatINR, stockLabel } from '../money';
import { useShop } from '../shop';
import type { Product } from '../types';

/** Shown if a photograph cannot be loaded, so a card is never empty. */
const FALLBACK_IMAGE = '/products/placeholder.svg';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, busy } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [imageSrc, setImageSrc] = useState(product.image);
  const stock = stockLabel(product.stock);

  return (
    <article className="product-card">
      <div className="product-card__media">
        <img
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          width={1200}
          height={900}
          onError={() => setImageSrc(FALLBACK_IMAGE)}
        />
        <span className="product-card__category">{product.category}</span>
      </div>

      <div className="product-card__body">
        <p className="product-card__brand">{product.brand}</p>
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>

        <div className="product-card__meta">
          <span className="price">
            {formatINR(product.price)} <small>{product.unit}</small>
          </span>
          <span className={`stock stock--${stock.kind}`}>{stock.label}</span>
        </div>

        <div className="product-card__actions">
          <label className="qty">
            <span className="sr-only">Quantity for {product.name}</span>
            <select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => void addItem(product.id, quantity)}
            disabled={busy}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}