import { api } from '../api.js';
import { h, toast } from '../ui.js';
import { icon } from '../icons.js';

function spanIcon(name, size = 20) { const s = h('span', {}); s.style.display = 'inline-flex'; s.innerHTML = icon(name, size); return s; }

export async function calendarView(nav) {
  const cal = await api.calendar();
  const currentWeek = await nav.currentWeek();
  const byWeek = Object.fromEntries(cal.weeks.map((w) => [w.week, w]));
  let monthIndex = Math.max(0, cal.months.findIndex((m) => m.weeks.some((w) => w.week === currentWeek)));

  const wrap = h('div', {});
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, `Calendário Papernow ${cal.year}`),
    h('div', { class: 'sub' }, 'Suas 52 semanas, espelhando o seu planner físico. Toque numa semana para adicionar fotos e ver as anotações.'),
  ]));

  const nameEl = h('div', { class: 'm-name' });
  const grid = h('div', { class: 'weeks-grid' });
  const prev = h('button', { class: 'btn ghost sm' }); prev.innerHTML = icon('chevronL', 18) + ' Anterior';
  const next = h('button', { class: 'btn ghost sm' }); next.innerHTML = 'Próximo ' + icon('chevronR', 18);
  prev.onclick = () => { monthIndex = (monthIndex - 1 + cal.months.length) % cal.months.length; paint(); };
  next.onclick = () => { monthIndex = (monthIndex + 1) % cal.months.length; paint(); };

  function paint() {
    const month = cal.months[monthIndex];
    nameEl.textContent = `${month.monthName} ${cal.year}`;
    grid.innerHTML = '';
    for (const mw of month.weeks) {
      const w = byWeek[mw.week];
      const card = h('button', { class: 'week-card' + (w.week === currentWeek ? ' now' : '') }, [
        h('div', { class: 'wn' }, ['Semana ', h('b', {}, String(w.week))]),
        h('div', { class: 'wr' }, w.label),
        h('div', { class: 'badges' }, [
          h('span', { class: 'chip-mini' + (w.photos ? ' on' : '') }, `${w.photos}/${cal.maxPhotosPerWeek} fotos`),
          w.notes ? h('span', { class: 'chip-mini on' }, `${w.notes} nota${w.notes > 1 ? 's' : ''}`) : null,
        ]),
      ]);
      card.onclick = () => nav.openWeek(w.week);
      grid.append(card);
    }
  }
  paint();
  wrap.append(h('div', { class: 'month-nav' }, [prev, nameEl, next]), grid);
  return wrap;
}

export async function weekDetailView(nav, week, focusUpload = false) {
  const cal = await api.calendar();
  const w = cal.weeks.find((x) => x.week === week) || { week, monthName: '', label: '' };
  const wrap = h('div', {});

  const back = h('button', { class: 'back-link' }); back.innerHTML = icon('chevronL', 16) + ' Voltar ao calendário';
  back.onclick = () => nav.go('calendario');
  wrap.append(back);
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, `Semana ${week}`),
    h('div', { class: 'sub' }, `${w.monthName} · ${w.label}`),
  ]));

  const fileInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
  const uploader = h('div', { class: 'uploader' });
  const upText = h('div', {}, 'Toque para fotografar ou escolher da galeria');
  uploader.append(spanIcon('camera', 30), upText,
    h('div', { style: 'font-size:12px;margin-top:4px' }, `Até ${cal.maxPhotosPerWeek} fotos · a foto entra automaticamente na Semana ${week}`));
  uploader.onclick = () => fileInput.click();

  const gallery = h('div', { class: 'photo-grid' });

  fileInput.onchange = async () => {
    const file = fileInput.files[0]; if (!file) return;
    uploader.classList.add('busy'); upText.textContent = 'Enviando e otimizando…';
    try {
      const form = new FormData(); form.append('photo', file); form.append('week', String(week));
      await api.upload('/api/photos', form);
      toast(`Foto adicionada à semana ${week} ✨`);
      await refresh();
    } catch (e) { toast(e.message, true); }
    finally { uploader.classList.remove('busy'); upText.textContent = 'Toque para fotografar ou escolher da galeria'; fileInput.value = ''; }
  };

  async function refresh() {
    const { photos } = await api.photos(week);
    gallery.innerHTML = '';
    uploader.style.display = photos.length >= cal.maxPhotosPerWeek ? 'none' : '';
    if (!photos.length) {
      gallery.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, [
        h('div', { class: 'big' }, '🌿'), h('p', {}, 'Ainda sem fotos desta semana. A primeira registra o começo da sua jornada.'),
      ]));
      return;
    }
    for (const p of photos) {
      const del = h('button', { class: 'del', 'aria-label': 'remover' }); del.innerHTML = '×';
      del.onclick = async (ev) => { ev.stopPropagation(); if (!confirm('Remover esta foto?')) return; await api.deletePhoto(p.id); await refresh(); toast('Foto removida.'); };
      gallery.append(h('div', { class: 'photo-item' }, [
        h('img', { src: p.url, alt: p.caption || `Semana ${week}`, loading: 'lazy' }), del,
        p.caption ? h('div', { class: 'cap' }, p.caption) : null,
      ]));
    }
  }

  wrap.append(uploader, fileInput, gallery);
  setTimeout(refresh, 0);
  if (focusUpload) setTimeout(() => uploader.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  return wrap;
}
