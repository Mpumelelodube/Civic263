import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@civic263/web-ui/styles.css';
import { App } from './app';
import { getPublicFirebaseApp } from './lib/firebase';
import { PublicRegisterProvider } from './lib/public-register';
getPublicFirebaseApp();
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <PublicRegisterProvider>
      <App />
    </PublicRegisterProvider>
  </StrictMode>,
);
