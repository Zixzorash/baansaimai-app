import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

// 🌟 ใส่ Client ID ของคุณที่ได้จาก Google Cloud Console ที่นี่ 🌟
const CLIENT_ID = "185026694768-s4ale64c88rvslq2qahmndev45b7csnr.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
