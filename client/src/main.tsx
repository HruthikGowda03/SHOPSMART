import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ShopProvider } from './shop';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ShopProvider>
      <App />
    </ShopProvider>
  </StrictMode>,
);