import { api } from './api.js';
import { h, toast, openModal } from './ui.js';

// Legenda de cores personalizada (a cliente nomeia cada cor).
let cache = null;

export async function loadLegend(force = false) {
  if (cache && !force) return cache;
  try { cache = await api.getLegend(); } catch { cache = { palette: ['#c98a8a', '#7d94b0', '#8aa17d', '#a58ab0', '#c9a15f'], legend: {} }; }
  return cache;
}

export function labelFor(color) {
  return (cache && cache.legend && cache.legend[color]) || '';
}

export function palette() { return (cache && cache.palette) || []; }

// Editor da legenda: a cliente dá nome a cada cor.
export async function openLegendEditor(onSaved) {
  const data = await loadLegend(true);
  const inputs = {};
  const rows = data.palette.map((c) => {
    const inp = h('input', { type: 'text', maxlength: '24', value: data.legend[c] || '', placeholder: 'Significado desta cor' });
    inputs[c] = inp;
    const dot = h('span', { class: 'legend-dot' }); dot.style.background = c;
    return h('div', { class: 'legend-row' }, [dot, inp]);
  });
  const save = h('button', { class: 'btn sm' }, 'Salvar legenda');
  const modal = openModal(h('div', {}, [
    h('h2', { class: 'display' }, 'Legenda de cores'),
    h('p', { style: 'color:var(--ink-soft);font-size:13.5px;margin:0 0 12px' }, 'Dê um significado para cada cor (ex.: vermelho = urgente, lilás = família). Você usa essas cores nas anotações e no calendário.'),
    h('div', { class: 'legend-list' }, rows),
    h('div', { style: 'display:flex;justify-content:flex-end;margin-top:12px' }, save),
  ]));
  save.onclick = async () => {
    const legend = {};
    for (const c of data.palette) legend[c] = inputs[c].value.trim();
    try { const r = await api.setLegend(legend); cache = { palette: data.palette, legend: r.legend }; modal.close(); toast('Legenda salva ✨'); onSaved && onSaved(); }
    catch (e) { toast(e.message, true); }
  };
}
