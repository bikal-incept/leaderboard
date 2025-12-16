import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { CurriculumProvider } from './contexts/CurriculumContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CurriculumProvider>
      <App />
    </CurriculumProvider>
  </React.StrictMode>
);
