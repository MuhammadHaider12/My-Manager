import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// register the firebase messaging service worker so background notifications work
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistration("/firebase-messaging-sw.js")
    .then((existing) => {
      if (existing) {
        return existing;
      }
      return navigator.serviceWorker.register("/firebase-messaging-sw.js");
    })
    .then((registration) => {
      console.log("Service worker ready:", registration);
    })
    .catch((err) => {
      console.error("Service worker setup failed:", err);
    });
}
