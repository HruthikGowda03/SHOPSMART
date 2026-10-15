import { useState } from 'react';
import CartView from './components/CartView';
import CheckoutView from './components/CheckoutView';
import ConfirmationView from './components/ConfirmationView';
import Footer from './components/Footer';
import Header from './components/Header';
import Notice from './components/Notice';
import PresenterPanel from './components/PresenterPanel';
import ProductCard from './components/ProductCard';
import { useShop } from './shop';

function ShopView() {
  const { products } = useShop();
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))];
  const [category, setCategory] = useState('All');

  const visible = category === 'All' ? products : products.filter((product) => product.category === category);

  return (
    <section className="section">
      <div className="section__head">
        <h2>Featured products</h2>
        <span className="section__note">{visible.length} products</span>
      </div>

      <div className="filters" role="group" aria-label="Filter by category">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={item === category ? 'chip-btn is-active' : 'chip-btn'}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const { view, loading, backendOnline } = useShop();
  const [presenterOpen, setPresenterOpen] = useState(() => window.location.hash === '#presenter');

  // Opening the panel also marks the URL, so http://localhost:5173/#presenter
  // is a third (bookmarkable) way in without adding any visible control.
  const openPresenter = () => {
    window.history.replaceState(null, '', '#presenter');
    setPresenterOpen(true);
  };
  const closePresenter = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setPresenterOpen(false);
  };

  return (
    <div className="app">
      <Header />
      <Notice />

      <main className="container app__main">
        <section className="hero">
          <div>
            <p className="hero__eyebrow">ShopSmart</p>
            <h1>Desk essentials for a sharper workday</h1>
            <p className="hero__text">
              Headphones, keyboards, lamps and everything in between. Free delivery on orders above ₹1,500, 7-day
              returns, and checkout in under a minute.
            </p>
          </div>
          <dl className="hero__facts">
            <div>
              <dt>Delivery</dt>
              <dd>Free above ₹1,500</dd>
            </div>
            <div>
              <dt>Returns</dt>
              <dd>7 days</dd>
            </div>
            <div>
              <dt>Support</dt>
              <dd>{backendOnline ? 'Online now' : 'Back shortly'}</dd>
            </div>
          </dl>
        </section>

        {loading ? (
          <div className="panel loading">Loading the catalogue…</div>
        ) : (
          <>
            {view === 'shop' && <ShopView />}
            {view === 'cart' && <CartView />}
            {view === 'checkout' && <CheckoutView />}
            {view === 'confirmation' && <ConfirmationView />}
          </>
        )}
      </main>

      <Footer onOpenPresenter={openPresenter} />

      <PresenterPanel open={presenterOpen} onOpen={openPresenter} onClose={closePresenter} />
    </div>
  );
}