import { api } from '../api.js';
import { h, openLightbox, fmtDateBR } from '../ui.js';
import { icon } from '../icons.js';

export async function retrospectivaView(nav) {
  const d = await api.retrospectiva();
  const first = (d.user.name || '').trim().split(' ')[0];
  const wrap = h('div', {});

  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, `Sua retrospectiva ${d.year}`),
    h('div', { class: 'sub' }, first ? `${first}, esta é a sua jornada com o Master Planner até aqui.` : 'A sua jornada com o Master Planner até aqui.'),
  ]));

  // Números da jornada
  const stats = [
    { n: d.totals.photos, l: 'fotos guardadas', ic: 'camera' },
    { n: d.totals.notes, l: 'anotações', ic: 'note' },
    { n: `${d.totals.weeksRegistered}/${d.totals.totalWeeks}`, l: 'semanas registradas', ic: 'week' },
  ];
  wrap.append(h('div', { class: 'retro-stats' }, stats.map((s) => {
    const box = h('div', { class: 'retro-stat' }, [h('div', { class: 'n display' }, String(s.n)), h('div', { class: 'l' }, s.l)]);
    const ib = h('span', { class: 'ic' }); ib.innerHTML = icon(s.ic, 20); box.prepend(ib);
    return box;
  })));

  if (!d.totals.photos && !d.totals.notes) {
    wrap.append(h('div', { class: 'soon' }, [
      h('img', { class: 'bloom', src: '/img/botanical-sprig.svg', alt: '' }),
      h('h2', {}, 'Sua história começa agora'),
      h('p', {}, 'Conforme você adicionar fotos e anotações ao longo do ano, esta retrospectiva vai se formar — um álbum bonito da sua jornada, pronto pra reviver e compartilhar.'),
    ]));
    return wrap;
  }

  // Mosaico de fotos por mês
  for (const m of d.months) {
    wrap.append(h('div', { class: 'section-title' }, m.monthName));
    const grid = h('div', { class: 'retro-mosaic' }, m.photos.map((p) => {
      const img = h('img', { src: p.url, alt: `Semana ${p.week}`, loading: 'lazy' });
      img.style.cursor = 'zoom-in';
      img.onclick = () => openLightbox(p.url, `Semana ${p.week}${p.caption ? ' · ' + p.caption : ''}`);
      return img;
    }));
    wrap.append(grid);
  }

  // Destaques das anotações
  if (d.highlights.length) {
    wrap.append(h('div', { class: 'section-title' }, 'Momentos que você registrou'));
    const list = h('div', { class: 'retro-notes' }, d.highlights.map((n) => {
      const card = h('div', { class: 'retro-note' }, [
        h('h4', { class: 'display' }, n.title || '(sem título)'),
        n.body ? h('p', {}, n.body) : null,
        h('div', { class: 'm' }, [n.note_date ? fmtDateBR(n.note_date) : null, n.week ? `Semana ${n.week}` : null].filter(Boolean).join(' · ')),
      ]);
      if (n.color) card.style.borderLeft = `4px solid ${n.color}`;
      return card;
    }));
    wrap.append(list);
  }

  wrap.append(h('div', { class: 'retro-foot' }, [
    h('img', { src: '/img/papernow-logo.png', alt: 'Papernow', style: 'height:22px;opacity:.8' }),
    h('p', {}, 'Uma jornada de cada vez. 💛'),
  ]));
  return wrap;
}
