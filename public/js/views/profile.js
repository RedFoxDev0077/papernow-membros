import { api } from '../api.js';
import { h, toast, openModal } from '../ui.js';
import { icon } from '../icons.js';

export async function profileView(nav, onLogout) {
  const { user } = await api.me();
  const twofa = await api.twofaStatus().catch(() => ({ enabled: false }));
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

  // ---- Segurança / 2FA ----
  const secCard = h('div', { class: 'card pad', style: 'max-width:520px;margin-top:16px' });
  secCard.append(h('div', { class: 'section-title', style: 'margin-top:0' }, 'Segurança'));
  const statusLine = h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px' });
  secCard.append(
    h('p', { style: 'color:var(--ink-soft);font-size:13.5px;margin:0 0 12px' },
      'Suas fotos e anotações são guardadas criptografadas. Você pode reforçar o acesso com a verificação em 2 fatores.'),
    statusLine,
  );
  function paintStatus() {
    statusLine.innerHTML = '';
    const label = h('span', { style: 'font-size:14px' }, [
      'Verificação em 2 fatores: ',
      h('b', { style: `color:${twofa.enabled ? 'var(--ok)' : 'var(--ink-soft)'}` }, twofa.enabled ? 'Ativada' : 'Desativada'),
    ]);
    const btn = h('button', { class: 'btn sm' + (twofa.enabled ? ' ghost' : '') }, twofa.enabled ? 'Desativar' : 'Ativar');
    btn.onclick = () => twofa.enabled ? disable2fa() : enable2fa();
    statusLine.append(label, btn);
  }
  paintStatus();
  wrap.append(secCard);

  const logoutBtn = h('button', { class: 'btn ghost', style: 'margin-top:20px' }, 'Sair da conta');
  logoutBtn.onclick = async () => { await api.logout(); onLogout(); toast('Você saiu da sua conta.'); };
  wrap.append(logoutBtn);
  return wrap;

  async function enable2fa() {
    let setup;
    try { setup = await api.twofaSetup(); } catch (e) { return toast(e.message, true); }
    const code = h('input', { type: 'text', inputmode: 'numeric', maxlength: '6', placeholder: '000000', style: 'text-align:center;letter-spacing:6px;font-size:18px' });
    const confirm = h('button', { class: 'btn sm' }, 'Ativar');
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, 'Verificação em 2 fatores'),
      h('p', { style: 'color:var(--ink-soft);font-size:13.5px;margin:0 0 12px' }, '1) Abra o Google Authenticator (ou Authy) e escaneie o QR. 2) Digite o código de 6 dígitos que aparecer.'),
      h('img', { src: setup.qr, alt: 'QR code', style: 'display:block;margin:0 auto 10px;width:180px;height:180px;border:1px solid var(--line);border-radius:12px' }),
      h('p', { style: 'text-align:center;font-size:12px;color:var(--ink-faint);margin:0 0 14px' }, ['Ou digite manualmente: ', h('code', {}, setup.secret)]),
      h('div', { class: 'field' }, [h('label', {}, 'Código do app'), code]),
      h('div', { style: 'display:flex;justify-content:flex-end' }, confirm),
    ]));
    confirm.onclick = async () => {
      try { await api.twofaEnable(code.value); twofa.enabled = true; modal.close(); paintStatus(); toast('Verificação em 2 fatores ativada 🔒'); }
      catch (e) { toast(e.message, true); }
    };
  }

  async function disable2fa() {
    const code = h('input', { type: 'text', inputmode: 'numeric', maxlength: '6', placeholder: '000000', style: 'text-align:center;letter-spacing:6px;font-size:18px' });
    const confirm = h('button', { class: 'btn sm danger' }, 'Desativar');
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, 'Desativar 2 fatores'),
      h('p', { style: 'color:var(--ink-soft);font-size:13.5px;margin:0 0 12px' }, 'Digite um código atual do app autenticador para confirmar.'),
      h('div', { class: 'field' }, [h('label', {}, 'Código'), code]),
      h('div', { style: 'display:flex;justify-content:flex-end' }, confirm),
    ]));
    confirm.onclick = async () => {
      try { await api.twofaDisable(code.value); twofa.enabled = false; modal.close(); paintStatus(); toast('Verificação em 2 fatores desativada.'); }
      catch (e) { toast(e.message, true); }
    };
  }

  function row(k, v) {
    return h('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line-soft)' }, [
      h('span', { style: 'color:var(--ink-soft);font-size:14px' }, k),
      h('span', { style: 'font-weight:600;font-size:14px;text-align:right' }, v),
    ]);
  }
}
