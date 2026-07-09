import { api } from './api.js';
import { h, esc, toast, openModal, fmtDateBR } from './ui.js';

// Área autenticada: calendário Papernow, fotos por semana e anotações.
export function renderApp(root, user, onLogout) {
  const state = { tab: 'calendar', calendar: null, monthIndex: 0, detailWeek: null, notesFilter: { kind: '', q: '' } };

  const main = h('div', { class: 'content', id: 'main' });
  const topbar = h('div', { class: 'topbar' }, [
    h('div', { class: 'logo' }, [h('span', { class: 'mark' }, '∞'), h('span', { class: 'name' }, 'PAPERNOW')]),
    h('div', { class: 'who' }, [
      (user.name ? user.name.split(' ')[0] + ' · ' : ''),
      h('button', { class: 'chip', style: 'padding:4px 10px', onclick: doLogout }, 'Sair'),
    ]),
  ]);

  const tabbar = h('div', { class: 'tabbar' }, [
    tabBtn('calendar', '🗓️', 'Calendário'),
    tabBtn('notes', '✏️', 'Anotações'),
  ]);

  function tabBtn(id, ic, label) {
    const b = h('button', { class: state.tab === id ? 'active' : '', onclick: () => switchTab(id) },
      [h('span', { class: 'ic' }, ic), label]);
    b.dataset.tab = id;
    return b;
  }

  function switchTab(id) {
    state.tab = id; state.detailWeek = null;
    tabbar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    render();
  }

  async function doLogout() { await api.logout(); onLogout(); }

  // ---------------- Calendar ----------------
  async function loadCalendar() {
    state.calendar = await api.calendar();
    // Abre no mês atual, se estiver dentro do ano do planner; senão, mês 1.
    const now = new Date();
    const idx = state.calendar.months.findIndex((m) => m.month === now.getMonth() + 1);
    state.monthIndex = idx >= 0 ? idx : 0;
  }

  function calendarView() {
    const cal = state.calendar;
    const month = cal.months[state.monthIndex];
    const byWeek = Object.fromEntries(cal.weeks.map((w) => [w.week, w]));

    const grid = h('div', { class: 'weeks-grid' }, month.weeks.map((mw) => {
      const w = byWeek[mw.week];
      const card = h('div', { class: 'week-card', onclick: () => openWeek(w.week) }, [
        h('div', { class: 'wn' }, ['Semana ', h('b', {}, String(w.week))]),
        h('div', { class: 'wr' }, w.label),
        h('div', { class: 'badges' }, [
          h('span', { class: 'badge' + (w.photos ? ' has' : '') }, `📷 ${w.photos}/${cal.maxPhotosPerWeek}`),
          w.notes ? h('span', { class: 'badge has' }, `✏️ ${w.notes}`) : null,
        ]),
      ]);
      return card;
    }));

    return h('div', {}, [
      h('h1', { class: 'page-title' }, `Calendário Papernow ${cal.year}`),
      h('p', { class: 'page-sub' }, 'Suas 52 semanas, espelhando o seu planner físico. Toque numa semana para adicionar fotos e ver as anotações.'),
      h('div', { class: 'month-nav' }, [
        h('button', { onclick: () => moveMonth(-1) }, '‹ Anterior'),
        h('div', { class: 'm-name' }, `${month.monthName} ${cal.year}`),
        h('button', { onclick: () => moveMonth(1) }, 'Próximo ›'),
      ]),
      grid,
    ]);
  }

  function moveMonth(dir) {
    const n = state.calendar.months.length;
    state.monthIndex = (state.monthIndex + dir + n) % n;
    render();
  }

  // ---------------- Week detail (photos) ----------------
  async function openWeek(week) {
    state.detailWeek = week;
    render();
  }

  async function weekDetailView(week) {
    const w = state.calendar.weeks.find((x) => x.week === week);
    const wrap = h('div', {}, [
      h('button', { class: 'back-link', onclick: () => { state.detailWeek = null; render(); } }, '‹ Voltar ao calendário'),
      h('div', { class: 'detail-head' }, [
        h('h1', { class: 'page-title' }, `Semana ${week}`),
      ]),
      h('p', { class: 'page-sub' }, `${w.monthName} · ${w.label}`),
    ]);

    const gallery = h('div', { class: 'photo-grid', id: 'gallery' });

    const fileInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    const uploader = h('div', { class: 'uploader' }, [
      h('div', { style: 'font-size:30px' }, '📷'),
      h('div', {}, 'Toque para fotografar ou escolher da galeria'),
      h('div', { style: 'font-size:12px;margin-top:4px' }, `Até ${state.calendar.maxPhotosPerWeek} fotos nesta semana · a foto entra automaticamente na Semana ${week}`),
    ]);
    uploader.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploader.classList.add('busy');
      uploader.querySelector('div:nth-child(2)').textContent = 'Enviando e otimizando…';
      try {
        const form = new FormData();
        form.append('photo', file);
        form.append('week', String(week));
        await api.upload('/api/photos', form);
        toast('Foto adicionada à semana ' + week + ' ✨');
        await refreshGallery();
        await loadCalendar(); // atualiza contadores
      } catch (e) {
        toast(e.message, true);
      } finally {
        uploader.classList.remove('busy');
        uploader.querySelector('div:nth-child(2)').textContent = 'Toque para fotografar ou escolher da galeria';
        fileInput.value = '';
      }
    };

    async function refreshGallery() {
      const { photos } = await api.photos(week);
      gallery.innerHTML = '';
      if (!photos.length) {
        gallery.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, [
          h('div', { class: 'big' }, '🌿'), h('p', {}, 'Ainda sem fotos desta semana. A primeira registra o começo da sua jornada.'),
        ]));
        uploader.style.display = '';
        return;
      }
      uploader.style.display = photos.length >= state.calendar.maxPhotosPerWeek ? 'none' : '';
      for (const p of photos) {
        const del = h('button', { class: 'del', title: 'Remover' }, '×');
        del.onclick = async (ev) => {
          ev.stopPropagation();
          if (!confirm('Remover esta foto?')) return;
          await api.deletePhoto(p.id);
          await refreshGallery(); await loadCalendar();
          toast('Foto removida.');
        };
        gallery.append(h('div', { class: 'photo-item' }, [
          h('img', { src: p.url, alt: p.caption || `Semana ${week}`, loading: 'lazy' }),
          del,
          p.caption ? h('div', { class: 'cap' }, p.caption) : null,
        ]));
      }
    }

    wrap.append(uploader, fileInput, gallery);
    setTimeout(refreshGallery, 0);
    return wrap;
  }

  // ---------------- Notes ----------------
  async function notesView() {
    const search = h('input', { type: 'search', placeholder: 'Buscar nas anotações…', value: state.notesFilter.q });
    let debounce;
    search.oninput = () => { clearTimeout(debounce); debounce = setTimeout(() => { state.notesFilter.q = search.value; refreshNotes(); }, 250); };

    const kinds = [['', 'Todas'], ['diaria', 'Diárias'], ['semanal', 'Semanais'], ['livre', 'Livres']];
    const chips = h('div', { class: 'toolbar' }, [
      search,
      ...kinds.map(([k, label]) => {
        const c = h('button', { class: 'chip' + (state.notesFilter.kind === k ? ' active' : '') }, label);
        c.onclick = () => { state.notesFilter.kind = k; chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); c.classList.add('active'); refreshNotes(); };
        return c;
      }),
    ]);

    const list = h('div', { class: 'note-list', id: 'noteList' });

    async function refreshNotes() {
      const { notes } = await api.notes({ q: state.notesFilter.q, kind: state.notesFilter.kind });
      list.innerHTML = '';
      if (!notes.length) {
        list.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '✏️'), h('p', {}, 'Nenhuma anotação ainda. Toque no + para criar a primeira.')]));
        return;
      }
      for (const n of notes) {
        const kindLabel = { diaria: 'Diária', semanal: 'Semanal', livre: 'Livre' }[n.kind] || 'Livre';
        const meta = [kindLabel, n.note_date ? fmtDateBR(n.note_date) : null, n.week ? `Semana ${n.week}` : null].filter(Boolean).join(' · ');
        list.append(h('div', { class: 'note-item', onclick: () => openNoteEditor(n, refreshNotes) }, [
          h('h3', {}, n.title || '(sem título)'),
          h('div', { class: 'meta' }, meta),
          n.body ? h('p', {}, n.body) : null,
        ]));
      }
    }

    setTimeout(refreshNotes, 0);
    const fab = h('button', { class: 'fab', title: 'Nova anotação', onclick: () => openNoteEditor(null, refreshNotes) }, '+');
    return h('div', {}, [
      h('h1', { class: 'page-title' }, 'Anotações'),
      h('p', { class: 'page-sub' }, 'Registre pensamentos diários, resumos semanais ou notas livres — tudo pesquisável.'),
      chips, list, fab,
    ]);
  }

  function openNoteEditor(note, onSaved) {
    const isNew = !note;
    const kindSel = h('select', {},
      [['livre', 'Livre'], ['diaria', 'Diária'], ['semanal', 'Semanal']].map(([v, l]) =>
        h('option', { value: v, ...(note && note.kind === v ? { selected: 'selected' } : {}) }, l)));
    const title = h('input', { type: 'text', placeholder: 'Título', value: note?.title || '' });
    const body = h('textarea', { rows: '8', placeholder: 'Escreva aqui…' }, note?.body || '');
    const dateInput = h('input', { type: 'date', value: note?.note_date || '' });
    const weekInput = h('input', { type: 'number', min: '1', max: '52', placeholder: 'nº', value: note?.week || '' });

    const extra = h('div', { class: 'row' });
    function syncExtra() {
      extra.innerHTML = '';
      if (kindSel.value === 'diaria') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Data'), dateInput]));
      if (kindSel.value === 'semanal') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Semana (1–52)'), weekInput]));
    }
    kindSel.onchange = syncExtra; syncExtra();

    const saveBtn = h('button', { class: 'btn sm' }, isNew ? 'Salvar' : 'Salvar alterações');
    const delBtn = !isNew ? h('button', { class: 'btn sm danger', style: 'width:auto' }, 'Excluir') : null;

    const modal = openModal(h('div', {}, [
      h('h2', {}, isNew ? 'Nova anotação' : 'Editar anotação'),
      h('div', { class: 'row' }, [
        h('div', { class: 'field' }, [h('label', {}, 'Tipo'), kindSel]),
      ]),
      extra,
      h('div', { class: 'field' }, [h('label', {}, 'Título'), title]),
      h('div', { class: 'field' }, [h('label', {}, 'Texto'), body]),
      h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px' }, [delBtn, saveBtn].filter(Boolean)),
    ]));

    saveBtn.onclick = async () => {
      const payload = { kind: kindSel.value, title: title.value, body: body.value,
        note_date: kindSel.value === 'diaria' ? dateInput.value : null,
        week: kindSel.value === 'semanal' ? Number(weekInput.value) : null };
      try {
        if (isNew) await api.createNote(payload);
        else await api.updateNote(note.id, payload);
        modal.close(); toast('Anotação salva ✨'); onSaved();
      } catch (e) { toast(e.message, true); }
    };
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm('Excluir esta anotação?')) return;
      await api.deleteNote(note.id); modal.close(); toast('Anotação excluída.'); onSaved();
    };
  }

  // ---------------- Render ----------------
  async function render() {
    main.innerHTML = '';
    try {
      if (state.tab === 'calendar') {
        if (!state.calendar) await loadCalendar();
        main.append(state.detailWeek ? await weekDetailView(state.detailWeek) : calendarView());
      } else if (state.tab === 'notes') {
        main.append(await notesView());
      }
    } catch (e) {
      main.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '⚠️'), h('p', {}, e.message || 'Erro ao carregar.')]));
    }
  }

  root.innerHTML = '';
  root.append(topbar, main, tabbar);
  render();
}
