import { api } from '../api.js';
import { h, toast, openModal, fmtDateBR } from '../ui.js';
import { icon } from '../icons.js';
import { isValidWeek } from '../util.js';

export async function notesView(nav) {
  const filter = { kind: '', q: '' };
  const wrap = h('div', {});
  const newBtn = h('button', { class: 'btn sm' });
  newBtn.innerHTML = icon('plus', 18) + ' Nova anotação';
  newBtn.onclick = () => editor(null);
  wrap.append(h('div', { class: 'page-h', style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap' }, [
    h('div', {}, [
      h('h1', { class: 'display' }, 'Anotações'),
      h('div', { class: 'sub' }, 'Registre pensamentos diários, resumos semanais ou notas livres — tudo pesquisável.'),
    ]),
    newBtn,
  ]));

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
    if (!notes.length) { list.append(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '✏️'), h('p', {}, 'Nenhuma anotação ainda. Toque no + para criar a primeira.')])); return; }
    for (const n of notes) {
      const kind = { diaria: 'Diária', semanal: 'Semanal', livre: 'Livre' }[n.kind] || 'Livre';
      const meta = [kind, n.note_date ? fmtDateBR(n.note_date) : null, n.week ? `Semana ${n.week}` : null].filter(Boolean).join(' · ');
      list.append(h('div', { class: 'note-item', onclick: () => editor(n) }, [
        h('h3', { class: 'display' }, n.title || '(sem título)'),
        h('div', { class: 'meta' }, meta),
        n.body ? h('p', {}, n.body) : null,
      ]));
    }
  }

  function editor(note) {
    const isNew = !note;
    const kindSel = h('select', {}, [['livre', 'Livre'], ['diaria', 'Diária'], ['semanal', 'Semanal']].map(([v, l]) =>
      h('option', { value: v, ...(note && note.kind === v ? { selected: 'selected' } : {}) }, l)));
    const title = h('input', { type: 'text', placeholder: 'Título', value: note?.title || '' });
    const body = h('textarea', { rows: '8', placeholder: 'Escreva aqui…' }, note?.body || '');
    const dateInput = h('input', { type: 'date', value: note?.note_date || '' });
    const weekInput = h('input', { type: 'number', min: '1', max: '52', placeholder: 'nº', value: note?.week || '' });
    const extra = h('div', { class: 'row' });
    function sync() { extra.innerHTML = '';
      if (kindSel.value === 'diaria') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Data'), dateInput]));
      if (kindSel.value === 'semanal') extra.append(h('div', { class: 'field' }, [h('label', {}, 'Semana (1–52)'), weekInput])); }
    kindSel.onchange = sync; sync();
    const saveBtn = h('button', { class: 'btn sm' }, isNew ? 'Salvar' : 'Salvar alterações');
    const delBtn = !isNew ? h('button', { class: 'btn sm danger' }, 'Excluir') : null;
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, isNew ? 'Nova anotação' : 'Editar anotação'),
      h('div', { class: 'row' }, h('div', { class: 'field', style: 'flex:1' }, [h('label', {}, 'Tipo'), kindSel])),
      extra,
      h('div', { class: 'field' }, [h('label', {}, 'Título'), title]),
      h('div', { class: 'field' }, [h('label', {}, 'Texto'), body]),
      h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px' }, [delBtn, saveBtn].filter(Boolean)),
    ]));
    saveBtn.onclick = async () => {
      const payload = { kind: kindSel.value, title: title.value, body: body.value,
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
