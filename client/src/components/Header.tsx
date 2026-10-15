import { useShop } from '../shop';
import type { View } from '../types';

const VIEWS: { id: View; label: string }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'cart', label: 'Cart' },
  { id: 'checkout', label: 'Checkout' },
];

export default function Header() {
  const { view, setView, cartCount } = useShop();

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button className="brand" onClick={() => setView('shop')} type="button">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span className="brand__text">
            <span className="brand__name">ShopSmart</span>
            <span className="brand__tag">Everyday essentials, fairly priced</span>
          </span>
        </button>

        <nav className="site-nav" aria-label="Main">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'site-nav__link is-active' : 'site-nav__link'}
              onClick={() => setView(item.id)}
            >
              {item.label}
              {item.id === 'cart' && cartCount > 0 ? <span className="pill pill--cart">{cartCount}</span> : null}
            </button>
          ))}
        </nav>

        <div className="site-header__status">{cartCount === 0 ? 'Cart is empty' : `${cartCount} item${cartCount > 1 ? 's' : ''}`}</div>
      </div>
    </header>
  );
}