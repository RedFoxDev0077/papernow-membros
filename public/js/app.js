import { api } from './api.js';
import { renderAuth } from './auth-view.js';
import { renderApp } from './app-view.js';

const root = document.getElementById('app');

async function boot() {
  try {
    const { user } = await api.me();
    showApp(user);
  } catch {
    showAuth();
  }
}

function showAuth() {
  renderAuth(root, () => boot());
}

function showApp(user) {
  renderApp(root, user, () => showAuth());
  requestNotificationSoon();
}

// Pede permissão de notificação de forma não intrusiva (após o primeiro uso).
function requestNotificationSoon() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  setTimeout(() => { Notification.requestPermission().catch(() => {}); }, 8000);
}

// Registra o service worker (PWA: instalável + offline básico + base para push).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

boot();
