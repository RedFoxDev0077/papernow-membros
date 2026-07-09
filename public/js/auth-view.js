import { api } from './api.js';
import { h } from './ui.js';

// Telas de autenticação: login, cadastro (com validação de compra),
// recuperação de senha e redefinição.
export function renderAuth(root, onAuthed) {
  let mode = 'login'; // login | register | forgot | reset
  const resetToken = new URLSearchParams(location.search).get('token');
  if (resetToken) mode = 'reset';

  function brand() {
    return h('div', { class: 'auth-brand' }, [
      h('div', { class: 'mark' }, '∞'),
      h('div', { class: 'name' }, 'PAPERNOW'),
    ]);
  }

  function msgBox() { return h('div', { class: 'form-msg', id: 'authMsg' }); }
  function setMsg(text, ok = false) {
    const m = document.getElementById('authMsg');
    if (m) { m.textContent = text; m.className = 'form-msg ' + (ok ? 'ok' : 'error'); }
  }

  async function submitBtn(btn, fn) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';
    try { await fn(); }
    catch (e) { setMsg(e.message || 'Algo deu errado.'); }
    finally { btn.disabled = false; btn.textContent = label; }
  }

  function view() {
    if (mode === 'login') return loginView();
    if (mode === 'register') return registerView();
    if (mode === 'forgot') return forgotView();
    return resetView();
  }

  function loginView() {
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'seu@email.com' });
    const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: '••••••••' });
    const btn = h('button', { class: 'btn' }, 'Entrar');
    btn.onclick = () => submitBtn(btn, async () => {
      await api.login({ email: email.value, password: pass.value });
      onAuthed();
    });
    return h('div', {}, [
      brand(),
      h('h1', {}, 'Bem-vinda de volta'),
      h('p', { class: 'sub' }, 'Acesse a sua área exclusiva do Master Planner 2027.'),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      h('div', { class: 'field' }, [h('label', {}, 'Senha'), pass]),
      msgBox(), btn,
      h('div', { class: 'switch-row' }, [
        h('button', { onclick: () => go('forgot') }, 'Esqueci minha senha'),
      ]),
      h('div', { class: 'switch-row' }, [
        'Primeira vez aqui? ', h('button', { onclick: () => go('register') }, 'Criar conta'),
      ]),
    ]);
  }

  function registerView() {
    const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Seu nome' });
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'o e-mail da sua compra' });
    const cpf = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'CPF da compra (só números)' });
    const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'mínimo 8 caracteres' });
    const btn = h('button', { class: 'btn' }, 'Criar minha conta');
    btn.onclick = () => submitBtn(btn, async () => {
      await api.register({ name: name.value, email: email.value, cpf: cpf.value, password: pass.value });
      onAuthed();
    });
    return h('div', {}, [
      brand(),
      h('h1', {}, 'Criar conta'),
      h('p', { class: 'sub' }, 'Exclusivo para quem adquiriu o Master Planner 2027.'),
      h('div', { class: 'hint' }, 'Use o mesmo e-mail ou CPF da sua compra. É assim que confirmamos o seu acesso.'),
      h('div', { class: 'field' }, [h('label', {}, 'Nome'), name]),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      h('div', { class: 'field' }, [h('label', {}, 'CPF (opcional se usar o e-mail da compra)'), cpf]),
      h('div', { class: 'field' }, [h('label', {}, 'Senha'), pass]),
      msgBox(), btn,
      h('div', { class: 'switch-row' }, [
        'Já tem conta? ', h('button', { onclick: () => go('login') }, 'Entrar'),
      ]),
    ]);
  }

  function forgotView() {
    const email = h('input', { type: 'email', placeholder: 'seu@email.com' });
    const btn = h('button', { class: 'btn' }, 'Enviar instruções');
    btn.onclick = () => submitBtn(btn, async () => {
      const r = await api.forgot(email.value);
      setMsg(r.message || 'Verifique seu e-mail.', true);
    });
    return h('div', {}, [
      brand(),
      h('h1', {}, 'Recuperar senha'),
      h('p', { class: 'sub' }, 'Enviaremos um link de redefinição para o seu e-mail.'),
      h('div', { class: 'field' }, [h('label', {}, 'E-mail'), email]),
      msgBox(), btn,
      h('div', { class: 'switch-row' }, [h('button', { onclick: () => go('login') }, 'Voltar ao login')]),
    ]);
  }

  function resetView() {
    const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'nova senha (mín. 8)' });
    const btn = h('button', { class: 'btn' }, 'Redefinir senha');
    btn.onclick = () => submitBtn(btn, async () => {
      await api.reset(resetToken, pass.value);
      setMsg('Senha redefinida! Você já pode entrar.', true);
      setTimeout(() => { location.href = '/'; }, 1200);
    });
    return h('div', {}, [
      brand(),
      h('h1', {}, 'Nova senha'),
      h('p', { class: 'sub' }, 'Defina a sua nova senha de acesso.'),
      h('div', { class: 'field' }, [h('label', {}, 'Nova senha'), pass]),
      msgBox(), btn,
    ]);
  }

  function go(m) { mode = m; paint(); }
  function paint() {
    root.innerHTML = '';
    root.append(h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' }, view())));
  }
  paint();
}
