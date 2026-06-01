import React from 'react';
import ReactDOM from 'react-dom/client';

// ==================================================================
// ⚠️ หมายเหตุสำหรับผู้ใช้ Termux:
// ระบบ Preview ของเว็บนี้ไม่สามารถดึงไฟล์ App.jsx หรือไลบรารีภายนอกมาแสดงได้
// ผมจึงทำการคอมเมนต์ (//) โค้ดส่วนนี้ไว้ชั่วคราวเพื่อให้ระบบไม่แจ้งเตือน Error
//
// 📌 เมื่อคุณคัดลอกโค้ดนี้ไปวางในไฟล์ src/main.jsx ในเครื่องของคุณ:
// ให้ลบเครื่องหมาย // ใน 3 บรรทัดด้านล่างนี้ออก เพื่อให้ระบบทำงานได้จริงครับ
// ==================================================================

import App from './App.jsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

// --- (ส่วนนี้คือ Mock ชั่วคราวสำหรับหน้า Preview ให้ลบทิ้งเมื่อนำไปใช้จริง) ---
// const GoogleOAuthProvider = ({ children }) => <>{children}</>;
// const App = () => <div style={{ padding: 20, color: 'white', textAlign: 'center' }}>ระบบ Preview ไม่สามารถแสดงผลได้<br/>กรุณาคัดลอกโค้ดไปใช้ใน Termux ตามคำแนะนำครับ</div>;
// ----------------------------------------------------------------------

// 🌟 ใส่ Client ID ของคุณที่ได้จาก Google Cloud Console ที่นี่ 🌟
const CLIENT_ID = "185026694768-s4ale64c88rvslq2qahmndev45b7csnr.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
