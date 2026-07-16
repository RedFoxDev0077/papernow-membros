import { api } from '../api.js';
import { h, toast, openModal, fmtDateBR } from '../ui.js';
import { icon } from '../icons.js';
import { isValidWeek } from '../util.js';
import { loadLegend, labelFor, palette, openLegendEditor, legendBar } from '../legend.js';

export async function notesView(nav) {
  const filter = { kind: '', q: '' };
  await loadLegend();
  const wrap = h('div', {});
  const newBtn = h('button', { class: 'btn sm' });
  newBtn.innerHTML = icon('plus', 18) + ' Nova anotação';
  newBtn.onclick = () => editor(null);
  const legendBtn = h('button', { class: 'btn ghost sm' }, 'Legenda de cores');
  legendBtn.onclick = () => openLegendEditor(() => refresh());
  wrap.append(h('div', { class: 'page-h', style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap' }, [
    h('div', {}, [
      h('h1', { class: 'display' }, 'Anotações'),
      h('div', { class: 'sub' }, 'Registre pensamentos diários, semanais ou livres. Organize por cor e marque o que já resolveu.'),
    ]),
    h('div', { style: 'display:flex;gap:8px' }, [legendBtn, newBtn]),
  ]));
  const legend = legendBar(() => openLegendEditor(() => { legend._repaint(); refresh(); }));
  wrap.append(legend);

  const search = h('input', { type: 'search', placeholder: 'Buscar nas anotações…' });
  let dbnc; search.oninput = () => { clearTimeout(dbnc); dbnc = setTimeout(() => { filter.q = search.value; refresh(); }, 250); };
  const kinds = [['', 'Todas'], ['diaria', 'Diárias'], ['semanal', 'Semanais'], ['livre', 'Livres']];
  const chips = h('div', { class: 'toolbar' }, [search, ...kinds.map(([k, l]) => {
    const c = h('button', { class: 'chip' + (k === '' ? ' active' : '') }, l);
    c.onclick = () => { filter.kind = k; chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); c.classList.add('active'); refresh(); };
    return c;
  })]);

  const list = h('div', { class: 'note-list' });
  async function refresh() {
    const { notes } = await api.notes({ q: filter.q, kind: filter.kind });
    list.innerHTML = '';
    if (!notes.length) { list.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '✏️'), h('p', {}, 'Nenhuma anotação ainda. Toque em "Nova anotação" para criar a primeira.')])); return; }
    for (const n of notes) {
      const kind = { diaria: 'Diária', semanal: 'Semanal', livre: 'Livre' }[n.kind] || 'Livre';
      const cat = n.color ? labelFor(n.color) : '';
      const meta = [kind, cat || null, n.note_date ? fmtDateBR(n.note_date) : null, n.week ? `Semana ${n.week}` : null].filter(Boolean).join(' · ');

      const check = h('button', { class: 'note-check' + (n.done ? ' on' : ''), 'aria-label': 'marcar como resolvida' });
      check.innerHTML = n.done ? icon('check', 15) : '';
      check.onclick = async (ev) => {
        ev.stopPropagation();
        try { await api.toggleNoteDone(n.id, !n.done); refresh(); } catch (e) { toast(e.message, true); }
      };

      const card = h('div', { class: 'note-item' + (n.done ? ' done' : ''), onclick: () => editor(n) }, [
        h('div', { class: 'note-body' }, [
          h('h3', { class: 'display' }, n.title || '(sem título)'),
          h('div', { class: 'meta' }, meta),
          n.body ? h('p', {}, n.body) : null,
        ]),
        check,
      ]);
      if (n.color) card.style.borderLeft = `5px solid ${n.color}`;
      list.append(card);
    }
  }

  function editor(note) {
    const isNew = !note;
    let color = note?.color || null;

    const kindSel = h('select', {}, [['livre', 'Livre'], ['diaria', 'Diária'], ['semanal', 'Semanal']].map(([v, l]) =>
      h('option', { value: v, ...(note && note.kind === v ? { selected: 'selected' } : {}) }, l)));
    const title = h('input', { type: 'text', placeholder: 'Título', value: note?.title || '' });
    const body = h('textarea', { rows: '7', placeholder: 'Escreva aqui…' }, note?.body || '');
    const dateInput = h('input', { type: 'date', value: note?.note_date || '' });
    const weekInput = h('input', { type: 'number', min: '1', max: '53', placeholder: 'nº', value: note?.week || '' });
    const extra = h('div', { class: 'row' });
    function sync() { extra.innerHTML = '';
      if (kindSel.value === 'diaria') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Data'), dateInput]));
      if (kindSel.value === 'semanal') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Semana'), weekInput])); }
    kindSel.onchange = sync; sync();

    // Seletor de cor/categoria
    const swatches = h('div', { class: 'swatches' });
    function paintSwatches() {
      swatches.innerHTML = '';
      const none = h('button', { class: 'swatch none' + (color === null ? ' sel' : ''), title: 'Sem cor' }, '∅');
      none.onclick = () => { color = null; paintSwatches(); };
      swatches.append(none);
      for (const c of palette()) {
        const s = h('button', { class: 'swatch' + (color === c ? ' sel' : ''), title: labelFor(c) || 'Cor' });
        s.style.background = c;
        s.onclick = () => { color = c; paintSwatches(); };
        swatches.append(s);
      }
    }
    paintSwatches();

    const saveBtn = h('button', { class: 'btn sm' }, isNew ? 'Salvar' : 'Salvar alterações');
    const delBtn = !isNew ? h('button', { class: 'btn sm danger' }, 'Excluir') : null;
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, isNew ? 'Nova anotação' : 'Editar anotação'),
      h('div', { class: 'row' }, h('div', { class: 'field', style: 'flex:1' }, [h('label', {}, 'Tipo'), kindSel])),
      extra,
      h('div', { class: 'field' }, [h('label', {}, 'Título'), title]),
      h('div', { class: 'field' }, [h('label', {}, 'Texto'), body]),
      h('div', { class: 'field' }, [h('label', {}, 'Cor (categoria)'), swatches]),
      h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px' }, [delBtn, saveBtn].filter(Boolean)),
    ]));
    saveBtn.onclick = async () => {
      const payload = { kind: kindSel.value, title: title.value, body: body.value, color,
        note_date: kindSel.value === 'diaria' ? dateInput.value : null,
        week: kindSel.value === 'semanal' && isValidWeek(Number(weekInput.value)) ? Number(weekInput.value) : null };
      try { if (isNew) await api.createNote(payload); else await api.updateNote(note.id, payload); modal.close(); toast('Anotação salva ✨'); refresh(); }
      catch (e) { toast(e.message, true); }
    };
    if (delBtn) delBtn.onclick = async () => { if (!confirm('Excluir esta anotação?')) return; await api.deleteNote(note.id); modal.close(); toast('Anotação excluída.'); refresh(); };
  }

  const fab = h('button', { class: 'fab', 'aria-label': 'nova anotação' }); fab.innerHTML = icon('plus', 26);
  fab.onclick = () => editor(null);
  wrap.append(chips, list, fab);
  setTimeout(refresh, 0);
  return wrap;
}
