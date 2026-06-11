import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AgHero from './AgHero'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AgHero />
  </StrictMode>,
)

// Registrar Service Worker para PWA (Offline-First)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registrado com sucesso:', registration.scope);
    }).catch((error) => {
      console.error('Falha ao registrar SW:', error);
    });
  });
}
