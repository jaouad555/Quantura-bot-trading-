import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { apiStorage } from './utils/apiStorage';
import { ErrorBoundary } from './components/ErrorBoundary';

apiStorage.init().catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary fallbackTitle="حدث تعارض مؤقت في تشغيل المنصة">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
