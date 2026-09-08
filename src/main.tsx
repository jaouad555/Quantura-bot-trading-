import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { apiStorage } from './utils/apiStorage';

// DEEP WIPE STATE FOR FRESH START
try { 
  if (!window.sessionStorage.getItem('wiped_deep_clean_v2')) {
    window.localStorage.clear(); 
    window.sessionStorage.setItem('wiped_deep_clean_v2', 'true');
  }
} catch(e){}

apiStorage.init().catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
