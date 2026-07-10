// Helpers de UI compartilhados.

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

let toastTimer;
export function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
}

export function openModal(node) {
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
  const modal = h('div', { class: 'modal' }, node);
  back.append(modal);
  document.body.append(back);
  function close() { back.remove(); }
  return { close, el: modal };
}

// Visualizador de foto em tela cheia (tap para ampliar).
export function openLightbox(url, caption) {
  const back = h('div', { class: 'lightbox', onclick: () => close() });
  const img = h('img', { src: url, alt: caption || '' });
  const cap = caption ? h('div', { class: 'lb-cap' }, caption) : null;
  const closeBtn = h('button', { class: 'lb-close', 'aria-label': 'fechar' }, '×');
  closeBtn.onclick = () => close();
  back.append(closeBtn, img, cap);
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() { back.remove(); document.removeEventListener('keydown', onKey); }
  document.addEventListener('keydown', onKey);
  document.body.append(back);
}

export function fmtDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
