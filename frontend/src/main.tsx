/**
 * Application Entry Point
 * 
 * Initializes the React app and mounts the root component
 * Sets up the application context and providers
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
