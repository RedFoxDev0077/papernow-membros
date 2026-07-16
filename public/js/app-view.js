import { api } from './api.js';
import { h } from './ui.js';
import { icon } from './icons.js';
import { dashboardView } from './views/dashboard.js';
import { calendarView, weekDetailView } from './views/calendar.js';
import { notesView } from './views/notes.js';
import { profileView } from './views/profile.js';
import { contentView } from './views/content.js';
import { retrospectivaView } from './views/retrospectiva.js';
import { paymentsView } from './views/payments.js';

const NAV = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'calendario', label: 'Calendário', icon: 'calendar' },
  { id: 'foto', label: 'Enviar foto da semana', icon: 'camera' },
  { id: 'anotacoes', label: 'Anotações', icon: 'note' },
  { id: 'pagamentos', label: 'Pagamentos', icon: 'wallet' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book' },
  { id: 'marilia', label: 'Marília Cordeiro', icon: 'heartcontent' },
  { id: 'retrospectiva', label: 'Retrospectiva', icon: 'spark' },
  { id: 'perfil', label: 'Meu perfil', icon: 'user' },
];

export function renderApp(root, user, onLogout) {
  let currentWeekCache = null;
  const content = h('div', { class: 'content', id: 'content' });

  const navButtons = {};
  const sidebar = h('nav', { class: 'sidebar', id: 'sidebar' });
  sidebar.append(h('div', { class: 'brand' }, h('img', { class: 'brand-logo', src: '/img/papernow-logo.png', alt: 'Papernow' })));
  for (const item of NAV) {
    const b = h('button', { class: 'nav-item' }, [iconSpan(item.icon), item.label]);
    b.onclick = () => { go(item.id); closeDrawer(); };
    navButtons[item.id] = b;
    sidebar.append(b);
  }
  sidebar.append(h('div', { class: 'nav-sep' }));
  const logoutBtn = h('button', { class: 'nav-item logout' }, [iconSpan('logout'), 'Sair']);
  logoutBtn.onclick = doLogout;
  sidebar.append(logoutBtn);

  const scrim = h('div', { class: 'scrim', onclick: closeDrawer });
  const menuBtn = h('button', { class: 'icon-btn', 'aria-label': 'menu' });
  menuBtn.innerHTML = icon('menu', 24);
  menuBtn.onclick = openDrawer;
  const bell = h('button', { class: 'icon-btn', 'aria-label': 'notificações' });
  bell.innerHTML = icon('bell', 22);
  const topbar = h('div', { class: 'topbar' }, [
    menuBtn,
    h('div', { class: 'brand' }, h('img', { class: 'brand-logo', src: '/img/papernow-logo.png', alt: 'Papernow' })),
    bell,
  ]);

  const main = h('div', { class: 'main' }, [topbar, content]);
  root.innerHTML = '';
  root.append(h('div', { class: 'shell' }, [sidebar, main, scrim]));

  function iconSpan(name) { const s = h('span', { class: 'ic' }); s.innerHTML = icon(name, 20); return s; }
  function openDrawer() { sidebar.classList.add('open'); scrim.classList.add('show'); }
  function closeDrawer() { sidebar.classList.remove('open'); scrim.classList.remove('show'); }
  async function doLogout() { await api.logout(); onLogout(); }

  const nav = {
    user,
    go,
    openWeek: (week) => renderPage(async () => weekDetailView(nav, week)),
    async currentWeek() {
      if (currentWeekCache) return currentWeekCache;
      const d = await api.dashboard();
      currentWeekCache = d.week.week;
      return currentWeekCache;
    },
  };

  function setActive(id) {
    Object.entries(navButtons).forEach(([k, b]) => b.classList.toggle('active', k === id));
  }

  async function renderPage(fn) {
    content.innerHTML = '';
    const loading = h('div', { class: 'empty' }, 'Carregando…');
    content.append(loading);
    try {
      const node = await fn();
      content.innerHTML = ''; content.append(node);
      content.scrollTo?.(0, 0); window.scrollTo(0, 0);
    } catch (e) {
      content.innerHTML = '';
      content.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '⚠️'), h('p', {}, e.message || 'Erro ao carregar.')]));
    }
  }

  async function go(page, params) {
    switch (page) {
      case 'inicio': setActive('inicio'); return renderPage(() => dashboardView(nav));
      case 'calendario': setActive('calendario'); return renderPage(() => calendarView(nav));
      case 'anotacoes': setActive('anotacoes'); return renderPage(() => notesView(nav));
      case 'pagamentos': setActive('pagamentos'); return renderPage(() => paymentsView());
      case 'perfil': setActive('perfil'); return renderPage(() => profileView(nav, onLogout));
      case 'semana':
      case 'foto': {
        setActive(page);
        const w = await nav.currentWeek();
        return renderPage(() => weekDetailView(nav, w, page === 'foto'));
      }
      case 'biblioteca': setActive('biblioteca'); return renderPage(() => contentView('papernow'));
      case 'marilia': setActive('marilia'); return renderPage(() => contentView('marilia'));
      case 'retrospectiva': setActive('retrospectiva'); return renderPage(() => retrospectivaView(nav));
      default: setActive('inicio'); return renderPage(() => dashboardView(nav));
    }
  }

  go('inicio');
}
