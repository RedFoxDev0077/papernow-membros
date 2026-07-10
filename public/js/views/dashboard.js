import { api } from '../api.js';
import { h, fmtDateBR } from '../ui.js';
import { icon } from '../icons.js';

const QA = [
  { id: 'semana', t: 'Semana atual', d: 'Ver sua semana', ic: 'week' },
  { id: 'foto', t: 'Enviar foto da semana', d: 'Registre sua jornada', ic: 'camera' },
  { id: 'anotacoes', t: 'Anotações', d: 'Diárias, semanais e livres', ic: 'note' },
  { id: 'habitos', t: 'Hábitos', d: 'Acompanhe seus hábitos', ic: 'habits' },
  { id: 'biblioteca', t: 'Biblioteca', d: 'Materiais e conteúdos', ic: 'book' },
  { id: 'conteudo', t: 'Conteúdo exclusivo', d: 'Para clientes Papernow', ic: 'heartcontent' },
];

function greeting(name) {
  const hymn = new Date().getHours();
  const g = hymn < 12 ? 'Bom dia' : hymn < 18 ? 'Boa tarde' : 'Boa noite';
  const first = (name || '').trim().split(' ')[0];
  return first ? `${g}, ${first}!` : `${g}!`;
}

function iconBox(name, cls = 'ic') { const s = h('span', { class: cls }); s.innerHTML = icon(name, 20); return s; }

export async function dashboardView(nav) {
  const d = await api.dashboard();
  const wrap = h('div', {});

  // Greeting
  wrap.append(h('div', { class: 'page-h' }, [
    h('div', { class: 'greet' }, [h('h1', { class: 'display' }, greeting(d.user.name)), h('span', { class: 'spark' }, '✨')]),
    h('div', { class: 'sub' }, 'Que bom ter você aqui.'),
  ]));

  const dash = h('div', { class: 'dash' });

  // Hero — registre a semana
  const heroBtn = h('button', { class: 'btn' }, [spanIcon('camera', 18), `Enviar foto da semana`]);
  heroBtn.onclick = () => nav.go('foto');
  const hero = h('div', { class: 'hero' }, [
    h('div', {}, [
      h('h2', { class: 'display' }, [spanIcon('camera', 22), `Registre a Semana ${d.week.week}`]),
      h('p', {}, 'Tire uma foto do seu planner e ela vai pro lugar certo, sozinha.'),
      heroBtn,
    ]),
    h('div', { class: 'scene', 'aria-hidden': 'true' }),
  ]);
  dash.append(hero);

  // Row: progress + quote
  const progress = h('div', { class: 'card progress-card' }, [
    h('img', { class: 'bloom', src: '/img/botanical-sprig.svg', alt: '' }),
    h('div', { style: 'flex:1' }, [
      h('div', { class: 'wk' }, `Semana ${d.week.week}`),
      h('div', { class: 'rng' }, d.week.label),
      h('div', { style: 'margin-top:12px;font-size:13.5px;color:var(--ink-soft)' }, 'Sua semana até agora'),
      h('div', { class: 'bar' }, h('span', { style: `width:${d.progress}%` })),
    ]),
    h('div', { class: 'pct' }, `${d.progress}%`),
  ]);
  const quote = h('div', { class: 'card quote' }, [
    h('div', { class: 'mark' }, '“'),
    h('p', {}, d.quote),
  ]);
  dash.append(h('div', { class: 'dash-row two' }, [progress, quote]));

  // Quick access
  const qaGrid = h('div', { class: 'qa-grid' }, QA.map((q) => {
    const card = h('button', { class: 'qa' }, [iconBox(q.ic), h('div', { class: 't' }, q.t), h('div', { class: 'd' }, q.d)]);
    card.onclick = () => nav.go(q.id);
    return card;
  }));
  dash.append(h('div', {}, [h('div', { class: 'section-title' }, 'Acesso rápido'), qaGrid]));

  // Row: próximos compromissos + anotações recentes
  const compromissos = h('div', { class: 'card pad' }, [
    h('div', { class: 'section-title', style: 'margin-top:0' }, 'Próximos compromissos'),
    h('div', { class: 'empty-soft' }, 'Em breve você poderá marcar seus compromissos e vê-los aqui. 🌿'),
  ]);

  const notesCard = h('div', { class: 'card pad' });
  notesCard.append(h('div', { class: 'section-title', style: 'margin-top:0' }, 'Anotações recentes'));
  if (!d.recentNotes.length) {
    notesCard.append(h('div', { class: 'empty-soft' }, 'Suas anotações vão aparecer aqui.'));
  } else {
    const list = h('div', { class: 'mini-list' });
    for (const n of d.recentNotes) {
      const kind = { diaria: 'Diária', semanal: 'Semanal', livre: 'Livre' }[n.kind] || 'Livre';
      const meta = [kind, n.note_date ? fmtDateBR(n.note_date) : null, n.week ? `Semana ${n.week}` : null].filter(Boolean).join(' · ');
      const item = h('div', { class: 'mini-item' }, [
        spanIcon('note', 18, 'ic'),
        h('div', { style: 'min-width:0' }, [h('div', { class: 't' }, n.title || '(sem título)'), h('div', { class: 'm' }, meta)]),
      ]);
      item.style.cursor = 'pointer';
      item.onclick = () => nav.go('anotacoes');
      list.append(item);
    }
    notesCard.append(list);
  }
  dash.append(h('div', { class: 'dash-row two' }, [compromissos, notesCard]));

  wrap.append(dash);
  return wrap;
}

function spanIcon(name, size = 20, cls) { const s = h('span', cls ? { class: cls } : {}); s.style.display = 'inline-flex'; s.innerHTML = icon(name, size); return s; }
