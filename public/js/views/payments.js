import { api } from '../api.js';
import { h, toast } from '../ui.js';
import { icon } from '../icons.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad = (n) => String(n).padStart(2, '0');

export async function paymentsView() {
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  const wrap = h('div', {});
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, 'Pagamentos do mês'),
    h('div', { class: 'sub' }, 'Sua lista de pagamentos recorrentes. Marque o que já pagou neste mês.'),
  ]));

  const monthNav = h('div', { class: 'month-nav' });
  const list = h('div', { class: 'pay-list' });
  wrap.append(monthNav, list);

  // Adicionar novo item
  const addInput = h('input', { type: 'text', placeholder: 'Ex.: Aluguel, Internet, Cartão…', maxlength: '80' });
  const addBtn = h('button', { class: 'btn sm' }); addBtn.innerHTML = icon('plus', 16) + ' Adicionar';
  addBtn.onclick = async () => {
    const t = addInput.value.trim(); if (!t) return;
    try { await api.addPayment(t); addInput.value = ''; refresh(); } catch (e) { toast(e.message, true); }
  };
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.onclick(); });
  wrap.append(h('div', { class: 'pay-add' }, [addInput, addBtn]));

  function ym() { return `${y}-${pad(m + 1)}`; }
  function paintNav() {
    monthNav.innerHTML = '';
    const prev = h('button', { class: 'btn ghost sm' }); prev.innerHTML = icon('chevronL', 18) + ' Anterior';
    prev.onclick = () => { m--; if (m < 0) { m = 11; y--; } refresh(); };
    const next = h('button', { class: 'btn ghost sm' }); next.innerHTML = 'Próximo ' + icon('chevronR', 18);
    next.onclick = () => { m++; if (m > 11) { m = 0; y++; } refresh(); };
    monthNav.append(prev, h('div', { class: 'm-name' }, `${MESES[m]} de ${y}`), next);
  }

  async function refresh() {
    paintNav();
    const { items } = await api.payments(ym());
    list.innerHTML = '';
    if (!items.length) {
      list.append(h('div', { class: 'empty-soft' }, 'Nenhum pagamento na lista ainda. Adicione o primeiro abaixo. 🌿'));
      return;
    }
    for (const it of items) {
      const check = h('button', { class: 'pay-check' + (it.paid ? ' on' : ''), 'aria-label': 'marcar como pago' });
      check.innerHTML = it.paid ? icon('check', 16) : '';
      check.onclick = async () => { try { await api.checkPayment(it.id, ym(), !it.paid); refresh(); } catch (e) { toast(e.message, true); } };
      const del = h('button', { class: 'pay-del', 'aria-label': 'remover' }); del.innerHTML = '×';
      del.onclick = async () => { if (!confirm(`Remover "${it.title}" da lista?`)) return; await api.deletePayment(it.id); refresh(); };
      list.append(h('div', { class: 'pay-item' + (it.paid ? ' paid' : '') }, [check, h('span', { class: 't' }, it.title), del]));
    }
  }

  refresh();
  return wrap;
}
