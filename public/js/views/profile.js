import { api } from '../api.js';
import { h, toast } from '../ui.js';

export async function profileView(nav, onLogout) {
  const { user } = await api.me();
  const initial = (user.name || user.email || '?').trim()[0].toUpperCase();
  const wrap = h('div', {});

  wrap.append(h('div', { class: 'page-h' }, [h('h1', { class: 'display' }, 'Meu perfil')]));
  wrap.append(h('div', { class: 'profile-head' }, [
    h('div', { class: 'av' }, initial),
    h('div', {}, [
      h('div', { class: 'display', style: 'font-size:22px' }, user.name || 'Cliente Papernow'),
      h('div', { style: 'color:var(--ink-soft);font-size:14px' }, user.email),
    ]),
  ]));

  const card = h('div', { class: 'card pad', style: 'max-width:520px' });
  card.append(h('div', { class: 'section-title', style: 'margin-top:0' }, 'Conta'));
  card.append(
    row('Nome', user.name || '—'),
    row('E-mail', user.email),
    row('Acesso', 'Master Planner 2027'),
  );
  wrap.append(card);

  const logoutBtn = h('button', { class: 'btn ghost', style: 'margin-top:20px' }, 'Sair da conta');
  logoutBtn.onclick = async () => { await api.logout(); onLogout(); toast('Você saiu da sua conta.'); };
  wrap.append(logoutBtn);
  return wrap;

  function row(k, v) {
    return h('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line-soft)' }, [
      h('span', { style: 'color:var(--ink-soft);font-size:14px' }, k),
      h('span', { style: 'font-weight:600;font-size:14px;text-align:right' }, v),
    ]);
  }
}
