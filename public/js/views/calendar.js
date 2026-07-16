import { api } from '../api.js';
import { h, toast, openLightbox, openModal } from '../ui.js';
import { icon } from '../icons.js';

function spanIcon(name, size = 20) { const s = h('span', {}); s.style.display = 'inline-flex'; s.innerHTML = icon(name, size); return s; }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export async function calendarView(nav) {
  const cal = await api.calendar();
  const currentWeek = await nav.currentWeek();
  const byWeek = Object.fromEntries(cal.weeks.map((w) => [w.week, w]));
  let monthIndex = Math.max(0, cal.months.findIndex((m) => m.weeks.some((w) => w.week === currentWeek)));
  let mode = 'mes'; // 'mes' | 'grid' (semanas) | 'gallery'
  const now = new Date();
  let gY = now.getFullYear(), gM = now.getMonth();

  const wrap = h('div', {});
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, 'Calendário'),
    h('div', { class: 'sub' }, 'Escreva no dia como no seu planner. Toque num dia para abrir e anotar.'),
  ]));

  // Alternância Mês / Semanas
  const toggle = h('div', { class: 'cal-toggle' });
  function paintToggle() {
    toggle.innerHTML = '';
    [['mes', 'Mês'], ['grid', 'Semanas']].forEach(([m, label]) => {
      const b = h('button', { class: 'chip' + (mode === m ? ' active' : '') }, label);
      b.onclick = () => { mode = m; render(); };
      toggle.append(b);
    });
  }
  wrap.append(toggle);

  const body = h('div', {});
  wrap.append(body);

  function render() {
    paintToggle();
    body.innerHTML = '';
    body.append(mode === 'mes' ? monthView() : mode === 'gallery' ? galleryView() : gridView());
  }

  // ---- Visão do MÊS (calendário para escrever) ----
  function monthView() {
    const container = h('div', {});
    const prev = h('button', { class: 'btn ghost sm' }); prev.innerHTML = icon('chevronL', 18) + ' Anterior';
    prev.onclick = () => { gM--; if (gM < 0) { gM = 11; gY--; } render(); };
    const next = h('button', { class: 'btn ghost sm' }); next.innerHTML = 'Próximo ' + icon('chevronR', 18);
    next.onclick = () => { gM++; if (gM > 11) { gM = 0; gY++; } render(); };
    container.append(h('div', { class: 'month-nav' }, [prev, h('div', { class: 'm-name' }, `${MESES[gM]} de ${gY}`), next]));

    const weekdays = h('div', { class: 'month-weekdays' }, DIAS.map((d) => h('div', {}, d)));
    const cells = h('div', { class: 'month-cells' });
    const firstDow = (new Date(gY, gM, 1).getDay() + 6) % 7; // segunda = 0
    const daysInMonth = new Date(gY, gM + 1, 0).getDate();
    for (let i = 0; i < firstDow; i++) cells.append(h('div', { class: 'day-cell blank' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${gY}-${pad(gM + 1)}-${pad(d)}`;
      const cell = h('button', { class: 'day-cell' + (iso === todayISO() ? ' today' : '') }, [
        h('div', { class: 'dn' }, String(d)),
        h('div', { class: 'dtext' }),
      ]);
      cell.dataset.date = iso;
      cell.onclick = () => openDayEditor(iso);
      cells.append(cell);
    }
    container.append(h('div', { class: 'month-cal' }, [weekdays, cells]));

    // Carrega as anotações diárias do mês e preenche os dias
    (async () => {
      const first = `${gY}-${pad(gM + 1)}-01`;
      const last = `${gY}-${pad(gM + 1)}-${pad(daysInMonth)}`;
      const { notes } = await api.notes({ kind: 'diaria', from: first, to: last });
      dayNotes = {};
      for (const n of notes) { if (n.note_date && !dayNotes[n.note_date]) dayNotes[n.note_date] = n; }
      cells.querySelectorAll('.day-cell:not(.blank)').forEach((cell) => {
        const n = dayNotes[cell.dataset.date];
        if (n) {
          cell.classList.add('has');
          cell.querySelector('.dtext').textContent = n.title || n.body || '';
          if (n.color) cell.style.setProperty('--dc', n.color);
        }
      });
    })();
    return container;
  }

  let dayNotes = {};
  function openDayEditor(iso) {
    const existing = dayNotes[iso] || null;
    const [y, m, d] = iso.split('-');
    const title = h('input', { type: 'text', placeholder: 'Título (opcional)', value: existing?.title || '' });
    const text = h('textarea', { rows: '7', placeholder: 'Escreva o seu dia…' }, existing?.body || '');
    let color = existing?.color || null;
    const swatches = h('div', { class: 'swatches' });
    const CATS = [['#c98a8a', 'Pessoal'], ['#7d94b0', 'Profissional'], ['#8aa17d', 'Família'], ['#a58ab0', 'Particular'], ['#c9a15f', 'Ideias']];
    function paintSw() {
      swatches.innerHTML = '';
      const none = h('button', { class: 'swatch none' + (color === null ? ' sel' : '') }, '∅');
      none.onclick = () => { color = null; paintSw(); };
      swatches.append(none);
      for (const [c, label] of CATS) { const s = h('button', { class: 'swatch' + (color === c ? ' sel' : ''), title: label }); s.style.background = c; s.onclick = () => { color = c; paintSw(); }; swatches.append(s); }
    }
    paintSw();
    const save = h('button', { class: 'btn sm' }, 'Salvar');
    const del = existing ? h('button', { class: 'btn sm danger' }, 'Apagar') : null;
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, `${d}/${m}/${y}`),
      h('div', { class: 'field' }, [h('label', {}, 'Título'), title]),
      h('div', { class: 'field' }, [h('label', {}, 'Anotação do dia'), text]),
      h('div', { class: 'field' }, [h('label', {}, 'Cor'), swatches]),
      h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:4px' }, [del, save].filter(Boolean)),
    ]));
    save.onclick = async () => {
      const payload = { kind: 'diaria', note_date: iso, title: title.value, body: text.value, color };
      try {
        if (existing) await api.updateNote(existing.id, payload); else await api.createNote(payload);
        modal.close(); toast('Dia salvo ✨'); render();
      } catch (e) { toast(e.message, true); }
    };
    if (del) del.onclick = async () => { if (!confirm('Apagar a anotação deste dia?')) return; await api.deleteNote(existing.id); modal.close(); toast('Apagado.'); render(); };
  }

  function gridView() {
    const month = cal.months[monthIndex];
    const prev = h('button', { class: 'btn ghost sm', disabled: monthIndex === 0 ? '' : false });
    prev.innerHTML = icon('chevronL', 18) + ' Anterior';
    prev.onclick = () => { if (monthIndex > 0) { monthIndex--; render(); } };
    const next = h('button', { class: 'btn ghost sm', disabled: monthIndex === cal.months.length - 1 ? '' : false });
    next.innerHTML = 'Próximo ' + icon('chevronR', 18);
    next.onclick = () => { if (monthIndex < cal.months.length - 1) { monthIndex++; render(); } };

    const grid = h('div', { class: 'weeks-grid' }, month.weeks.map((mw) => {
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
      return card;
    }));

    const galleryBtn = h('button', { class: 'btn ghost sm' });
    galleryBtn.innerHTML = icon('camera', 16) + ' Ver fotos do mês';
    galleryBtn.onclick = () => { mode = 'gallery'; render(); };

    return h('div', {}, [
      h('div', { class: 'month-nav' }, [prev, h('div', { class: 'm-name' }, `${month.monthName} ${cal.year}`), next]),
      h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:12px' }, galleryBtn),
      grid,
    ]);
  }

  function galleryView() {
    const month = cal.months[monthIndex];
    const weekNums = new Set(month.weeks.map((w) => w.week));
    const container = h('div', {});
    const back = h('button', { class: 'back-link' }); back.innerHTML = icon('chevronL', 16) + ' Voltar ao mês';
    back.onclick = () => { mode = 'grid'; render(); };
    container.append(back, h('div', { class: 'page-h' }, [
      h('h1', { class: 'display' }, `Fotos de ${month.monthName}`),
      h('div', { class: 'sub' }, 'Todas as fotos do mês, agrupadas por semana — um álbum da sua jornada.'),
    ]));

    const holder = h('div', {});
    container.append(holder);
    (async () => {
      const { photos } = await api.photos();
      const mine = photos.filter((p) => weekNums.has(p.week));
      if (!mine.length) {
        holder.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '🌿'), h('p', {}, 'Ainda não há fotos neste mês. Elas vão aparecer aqui conforme você registrar suas semanas.')]));
        return;
      }
      for (const w of month.weeks) {
        const wp = mine.filter((p) => p.week === w.week);
        if (!wp.length) continue;
        holder.append(h('div', { class: 'section-title' }, `Semana ${w.week} · ${w.label}`));
        const g = h('div', { class: 'photo-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(110px,1fr))' },
          wp.map((p) => {
            const img = h('img', { src: p.url, alt: `Semana ${p.week}`, loading: 'lazy' });
            img.style.cursor = 'zoom-in';
            img.onclick = () => openLightbox(p.url, `Semana ${p.week}${p.caption ? ' · ' + p.caption : ''}`);
            return h('div', { class: 'photo-item' }, [img, p.caption ? h('div', { class: 'cap' }, p.caption) : null]);
          }));
        holder.append(g);
      }
    })();
    return container;
  }

  render();
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

  // Sem "capture": no celular abre a escolha entre CÂMERA e GALERIA.
  const fileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const uploader = h('div', { class: 'uploader' });
  const upText = h('div', {}, 'Toque para escolher da galeria ou tirar uma foto');
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
    finally { uploader.classList.remove('busy'); upText.textContent = 'Toque para escolher da galeria ou tirar uma foto'; fileInput.value = ''; }
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
      const img = h('img', { src: p.url, alt: p.caption || `Semana ${week}`, loading: 'lazy' });
      img.style.cursor = 'zoom-in';
      img.onclick = () => openLightbox(p.url, p.caption || `Semana ${week}`);
      gallery.append(h('div', { class: 'photo-item' }, [img, del, p.caption ? h('div', { class: 'cap' }, p.caption) : null]));
    }
  }

  wrap.append(uploader, fileInput, gallery);
  setTimeout(refresh, 0);
  if (focusUpload) setTimeout(() => uploader.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  return wrap;
}
