interface FooterProps {
  /** Double-click the wordmark to open the hidden presenter panel. */
  onOpenPresenter: () => void;
}

export default function Footer({ onOpenPresenter }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__brand">
            <strong>ShopSmart</strong> &middot; everyday essentials for your desk, your bag and your commute.
          </p>
          <p className="site-footer__meta">
            Free delivery on orders above ₹1,500 &middot; 7-day returns &middot; This is a demo store: products are
            fictional and payments are simulated.
          </p>
        </div>

        <div className="site-footer__links">
          <button type="button" className="site-footer__link" onDoubleClick={onOpenPresenter} title="ShopSmart">
            Store information
          </button>
          <span className="site-footer__meta">© 2026 ShopSmart</span>
        </div>
      </div>
    </footer>
  );
}