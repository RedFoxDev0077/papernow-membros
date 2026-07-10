import { api } from '../api.js';
import { h } from '../ui.js';
import { icon } from '../icons.js';

const PAGES = {
  papernow: {
    title: 'Biblioteca Papernow',
    subtitle: 'Materiais exclusivos para você: PDFs para download, conteúdos do mês e vídeos.',
    empty: 'Os materiais Papernow vão aparecer aqui. Estamos preparando tudo com carinho. 🌿',
  },
  marilia: {
    title: 'Marília Cordeiro',
    subtitle: 'A metodologia da nossa parceira: workshop e ebook, só para clientes Papernow.',
    empty: 'O workshop e o ebook da Marília ficam disponíveis aqui em breve. 🌿',
  },
};

// Converte URLs de YouTube/Vimeo em URL de incorporação.
function embedUrl(url) {
  try {
    const u = new URL(url);
    if (/youtube\.com$/.test(u.hostname) && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (/vimeo\.com$/.test(u.hostname)) return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`;
  } catch { /* ignore */ }
  return null;
}

export async function contentView(section) {
  const meta = PAGES[section] || PAGES.papernow;
  const { items } = await api.content(section);
  const wrap = h('div', {});
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, meta.title),
    h('div', { class: 'sub' }, meta.subtitle),
  ]));

  if (!items.length) {
    wrap.append(h('div', { class: 'soon' }, [
      h('img', { class: 'bloom', src: '/img/botanical-branch.svg', alt: '' }),
      h('h2', {}, 'Em preparação'),
      h('p', {}, meta.empty),
    ]));
    return wrap;
  }

  const grid = h('div', { class: 'content-grid' });
  for (const it of items) {
    const badge = it.badge ? h('span', { class: 'content-badge' }, it.badge) : null;
    let media;
    if (it.kind === 'video') {
      const emb = embedUrl(it.url);
      media = emb
        ? h('div', { class: 'video-embed' }, h('iframe', { src: emb, allow: 'fullscreen', loading: 'lazy', title: it.title }))
        : linkBtn(it.url, 'Assistir', 'video');
    }
    const actions = [];
    if (it.kind === 'pdf') actions.push(linkBtn(it.url, 'Abrir / Baixar', 'note'));
    if (it.kind === 'link') actions.push(linkBtn(it.url, 'Acessar', 'book'));

    grid.append(h('div', { class: 'content-card' }, [
      media || null,
      h('div', { class: 'content-info' }, [
        h('div', { class: 'content-head' }, [h('h3', { class: 'display' }, it.title), badge]),
        it.description ? h('p', {}, it.description) : null,
        actions.length ? h('div', { class: 'content-actions' }, actions) : null,
      ]),
    ]));
  }
  wrap.append(grid);
  return wrap;

  function linkBtn(url, label, ic) {
    const a = h('a', { class: 'btn sm', href: url, target: '_blank', rel: 'noopener' });
    a.innerHTML = icon(ic, 16) + ' ' + label;
    return a;
  }
}
