// Entre Nós · Papernow — interações da página pública.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    node.append(...[].concat(children));
    return node;
  };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  // ---- Menu: marca a seção visível ----
  const links = [...document.querySelectorAll('.menu a')];
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window && links.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.remove('on'));
        const a = byId[e.target.id];
        if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      }
    }, { rootMargin: '-25% 0px -65% 0px' });
    document.querySelectorAll('main .sec').forEach((s) => spy.observe(s));
  }

  // ---- Janela genérica ----
  function openModal(content, { wide = false, label = '' } = {}) {
    const box = el('div', { class: 'modal-box' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    const close = el('button', { class: 'modal-x', type: 'button', 'aria-label': 'Fechar', text: '×' });
    box.append(close, content);
    const back = el('div', { class: 'modal' }, box);
    const prevFocus = document.activeElement;
    function shut() {
      back.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') shut(); }
    close.onclick = shut;
    back.addEventListener('click', (e) => { if (e.target === back) shut(); });
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.append(back);
    close.focus();
    return shut;
  }

  // ---- Vídeos tocam na própria página ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-embed], a[data-video]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const player = el('div', { class: 'player' });
    if (a.dataset.embed) {
      player.append(el('iframe', {
        src: a.dataset.embed, title: a.dataset.title || 'Vídeo', allowfullscreen: '',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        referrerpolicy: 'strict-origin-when-cross-origin',
      }));
    } else {
      player.append(el('video', { src: a.dataset.video, controls: '', autoplay: '', playsinline: '' }));
    }
    openModal(player, { wide: true, label: a.dataset.title || 'Vídeo' });
  });

  // ---- Cupom: toque para copiar ----
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const code = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(code);
      toast(`Cupom ${code} copiado ✓`);
    } catch {
      toast(`Cupom: ${code}`);
    }
  });

  // ---- Salvar na tela de início (instruções certas para cada aparelho) ----
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
  window.addEventListener('appinstalled', () => { installEvent = null; toast('Pronto! O Entre Nós está na sua tela de início ✓'); });

  const STEPS = {
    ios: [
      'Abra esta página no <b>Safari</b>.',
      'Toque em <b>Compartilhar</b> (o quadradinho com a seta para cima, na barra do navegador).',
      'Role e toque em <b>Adicionar à Tela de Início</b>.',
      'Confirme em <b>Adicionar</b>. Pronto: o ícone do Entre Nós aparece junto com seus apps.',
    ],
    android: [
      'Abra esta página no <b>Chrome</b>.',
      'Toque nos <b>três pontinhos</b> (⋮) no canto de cima.',
      'Toque em <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>).',
      'Confirme em <b>Adicionar</b>. Pronto: o ícone do Entre Nós aparece junto com seus apps.',
    ],
  };

  function showInstallHelp() {
    const wrap = el('div');
    wrap.append(el('h3', { text: 'Salvar na tela de início' }));
    const list = el('ol', { class: 'steps' });
    const tabs = el('div', { class: 'tabs' });
    const paint = (which) => {
      list.innerHTML = STEPS[which].map((s) => `<li><span>${s}</span></li>`).join('');
      [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === which));
    };
    for (const [k, label] of [['ios', 'iPhone'], ['android', 'Android']]) {
      const b = el('button', { type: 'button', 'data-k': k, text: label });
      b.onclick = () => paint(k);
      tabs.append(b);
    }
    // No celular mostramos direto o passo a passo do aparelho; no computador, as duas abas.
    if (!isIOS && !isAndroid) wrap.append(el('p', { class: 'micro', text: 'Abra esta página no seu celular e siga os passos do seu aparelho:' }), tabs);
    wrap.append(list, el('p', { class: 'micro', text: 'Não precisa baixar nada da loja de aplicativos.' }));
    paint(isAndroid ? 'android' : 'ios');
    openModal(wrap, { label: 'Salvar na tela de início' });
  }

  const installBtn = $('#btn-instalar');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (isStandalone) return toast('O Entre Nós já está salvo neste aparelho ✓');
      if (installEvent) {
        installEvent.prompt();
        try { await installEvent.userChoice; } catch { /* fechou o aviso */ }
        installEvent = null;
        return;
      }
      showInstallHelp();
    });
  }

  // Funciona offline depois de salvo (só no endereço próprio do Entre Nós,
  // para não interferir no app da Área de Membros).
  if ('serviceWorker' in navigator && /^(www\.)?entrenos\./i.test(location.hostname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/entrenos-sw.js').catch(() => {}));
  }
})();
