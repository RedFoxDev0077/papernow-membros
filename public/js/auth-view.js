import { api } from './api.js';
import { h } from './ui.js';
import { icon } from './icons.js';

// Telas de autenticação com a identidade Papernow (foto + frases da marca).
export function renderAuth(root, onAuthed) {
  let mode = 'login';
  let twofaStep = null; // { ticket } quando o login pede o código 2FA
  const resetToken = new URLSearchParams(location.search).get('token');
  if (resetToken) mode = 'reset';

  function brand() {
    return h('img', { class: 'auth-logo', src: '/img/papernow-logo.png', alt: 'Papernow', width: '190' });
  }
  function msg() { return h('div', { class: 'form-msg', id: 'authMsg' }); }
  function setMsg(t, ok = false) {
    const m = document.getElementById('authMsg');
    if (m) { m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'error'); }
  }
  async function run(btn, fn) {
    btn.disabled = true; const label = btn.textContent; btn.innerHTML = '<span class="spinner"></span>';
    try { await fn(); } catch (e) { setMsg(e.message || 'Algo deu errado.'); }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  function pw(placeholder, autocomplete) {
    const input = h('input', { type: 'password', autocomplete, placeholder });
    const eye = h('button', { class: 'eye', type: 'button', 'aria-label': 'mostrar senha' });
    eye.innerHTML = icon('eye', 20);
    eye.onclick = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.innerHTML = icon(show ? 'eyeoff' : 'eye', 20);
    };
    return { wrap: h('div', { class: 'pw-wrap' }, [input, eye]), input };
  }

  function loginView() {
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'seu@email.com' });
    const p = pw('••••••••', 'current-password');
    const btn = h('button', { class: 'btn block' }, 'Entrar');
    btn.onclick = () => run(btn, async () => {
      const r = await api.login({ email: email.value, password: p.input.value });
      if (r && r.twofa) { twofaStep = { ticket: r.ticket }; paint(); return; }
      onAuthed();
    });
    return [
      brand(),
      h('h1', { class: 'display' }, ['Bem-vinda de volta ', h('span', { class: 'heart' }, '♡')]),
      h('p', { class: 'auth-sub' }, 'Seu Master Planner vai muito além do papel.'),
      h('div', { class: 'badge-lock' }, [span(icon('lock', 16)), 'Exclusivo para clientes do Master Planner 2027']),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      h('div', { class: 'field' }, [h('label', {}, 'Senha'), p.wrap]),
      h('div', { style: 'text-align:right;margin:-4px 0 10px' }, h('button', { class: 'linkbtn', onclick: () => go('forgot') }, 'Esqueci minha senha')),
      msg(), btn,
      h('div', { class: 'switch-row' }, ['Primeira vez aqui? ', h('button', { class: 'linkbtn', onclick: () => go('register') }, 'Criar conta')]),
      privacyNote(),
      h('div', { class: 'auth-tag' }, 'Planeje menos para sobreviver. Planeje mais para viver.'),
    ];
  }

  function registerView() {
    const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Seu nome' });
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'o e-mail da sua compra' });
    const cpf = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'CPF da compra (só números)' });
    const p = pw('mínimo 8 caracteres', 'new-password');
    const btn = h('button', { class: 'btn block' }, 'Criar minha conta');
    btn.onclick = () => run(btn, async () => {
      await api.register({ name: name.value, email: email.value, cpf: cpf.value, password: p.input.value }); onAuthed();
    });
    return [
      brand(),
      h('h1', { class: 'display' }, ['Criar conta ', h('span', { class: 'heart' }, '♡')]),
      h('p', { class: 'auth-sub' }, 'Exclusivo para quem adquiriu o Master Planner 2027.'),
      h('div', { class: 'info-box' }, [
        span(icon('mail', 18), 'ic'),
        h('div', {}, 'Use o mesmo e-mail da compra. Se preferir, informe o CPF utilizado no pedido. Assim conseguimos liberar seu acesso automaticamente.'),
      ]),
      h('div', { class: 'field' }, [h('label', {}, 'Nome'), name]),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      h('div', { class: 'field' }, [h('label', {}, 'CPF (opcional se usar o e-mail da compra)'), cpf]),
      h('div', { class: 'field' }, [h('label', {}, 'Senha'), p.wrap]),
      msg(), btn,
      h('div', { class: 'switch-row' }, ['Já tem conta? ', h('button', { class: 'linkbtn', onclick: () => go('login') }, 'Entrar')]),
    ];
  }

  function forgotView() {
    const email = h('input', { type: 'email', placeholder: 'seu@email.com' });
    const btn = h('button', { class: 'btn block' }, 'Enviar instruções');
    btn.onclick = () => run(btn, async () => { const r = await api.forgot(email.value); setMsg(r.message || 'Verifique seu e-mail.', true); });
    return [
      brand(),
      h('h1', { class: 'display' }, 'Recuperar senha'),
      h('p', { class: 'auth-sub' }, 'Enviaremos um link de redefinição para o seu e-mail.'),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      msg(), btn,
      h('div', { class: 'switch-row' }, h('button', { class: 'linkbtn', onclick: () => go('login') }, 'Voltar ao login')),
    ];
  }

  function resetView() {
    const p = pw('nova senha (mín. 8)', 'new-password');
    const btn = h('button', { class: 'btn block' }, 'Redefinir senha');
    btn.onclick = () => run(btn, async () => {
      await api.reset(resetToken, p.input.value); setMsg('Senha redefinida! Você já pode entrar.', true);
      setTimeout(() => { location.href = '/'; }, 1200);
    });
    return [brand(), h('h1', { class: 'display' }, 'Nova senha'), h('p', { class: 'auth-sub' }, 'Defina a sua nova senha de acesso.'),
      h('div', { class: 'field' }, [h('label', {}, 'Nova senha'), p.wrap]), msg(), btn];
  }

  function privacyNote() {
    const box = h('div', { class: 'privacy-note' });
    box.innerHTML = icon('lock', 15) + '<span>Este espaço é só seu. Suas fotos e anotações são privadas e ninguém mais tem acesso a elas.</span>';
    return box;
  }
  function twofaView() {
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '000000', maxlength: '6', style: 'letter-spacing:6px;text-align:center;font-size:20px' });
    const btn = h('button', { class: 'btn block' }, 'Verificar');
    btn.onclick = () => run(btn, async () => { await api.login2fa(twofaStep.ticket, code.value); onAuthed(); });
    return [
      brand(),
      h('h1', { class: 'display' }, 'Verificação em 2 fatores'),
      h('p', { class: 'auth-sub' }, 'Digite o código de 6 dígitos do seu app autenticador (Google Authenticator, Authy…).'),
      h('div', { class: 'field' }, [h('label', {}, 'Código'), code]),
      msg(), btn,
      h('div', { class: 'switch-row' }, h('button', { class: 'linkbtn', onclick: () => { twofaStep = null; paint(); } }, 'Voltar')),
    ];
  }
  function span(html, cls) { const s = h('span', cls ? { class: cls } : {}); s.innerHTML = html; return s; }
  function view() {
    if (twofaStep) return twofaView();
    return ({ login: loginView, register: registerView, forgot: forgotView, reset: resetView }[mode])();
  }
  function go(m) { mode = m; paint(); }
  function paint() {
    root.innerHTML = '';
    root.append(h('div', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' }, [
        h('div', { class: 'auth-form' }, view()),
        h('div', { class: 'auth-media', 'aria-hidden': 'true' }),
      ])));
  }
  paint();
}
