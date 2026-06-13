import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AgHero from './AgHero'
import ErrorBoundary from './components/ErrorBoundary'

// Listener Global para erros assíncronos não tratados (ex: Promises rejeitadas do Firebase)
window.addEventListener('unhandledrejection', (event) => {
  console.error("Erro assíncrono não tratado:", event.reason);
});

// Listener Global para erros na window (fora do ciclo do React)
window.addEventListener('error', (event) => {
  console.error("Erro global capturado:", event.error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AgHero />
    </ErrorBoundary>
  </StrictMode>,
)

