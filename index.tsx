import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
// import App from './App'; // Reemplazado por lazy load para diagnostico
import ErrorBoundary from './components/ui/ErrorBoundary';

// Carga diferida para atrapar errores de importación en App.tsx
const App = React.lazy(() => import('./App'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global Error Handler for Debugging
window.onerror = function (message, source, lineno, colno, error) {
  const errorMsg = `
    Global Error: ${message}
    Source: ${source}:${lineno}:${colno}
    Stack: ${error?.stack}
  `;
  console.error(errorMsg);
  if (rootElement) {
    // Simplificado para no romper React
    console.error("Global Error Captured:", message);
    // No tocamos el DOM aquí para evitar 'removeChild' y otros conflictos con React
  };
}


window.onunhandledrejection = function (event) {
  if (rootElement) {
    rootElement.innerHTML = `
          <div style="padding: 20px; background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; margin: 20px; font-family: monospace;">
            <h2 style="font-weight: bold; font-size: 1.5rem; margin-bottom: 1rem;">UNHANDLED PROMISE REJECTION</h2>
            <pre style="white-space: pre-wrap;">${event.reason}</pre>
          </div>
        `;
  }
}

try {
  console.log("Intentando montar React...");
  const root = ReactDOM.createRoot(rootElement);
  console.log("Root creado, renderizando...");
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Suspense fallback={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#475569' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Cargando Aplicación...</h2>
            <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ marginTop: '20px', fontSize: '0.9rem' }}>Si esto persiste, hay un error cargando App.tsx</p>
          </div>
        }>
          <App />
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (e: any) {
  if (rootElement) {
    rootElement.innerHTML = `
          <div style="padding: 20px; background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; margin: 20px; font-family: monospace;">
            <h2 style="font-weight: bold; font-size: 1.5rem; margin-bottom: 1rem;">RENDER ERROR</h2>
            <pre style="white-space: pre-wrap;">${e.message}\n${e.stack}</pre>
          </div>
        `;
  }
}
