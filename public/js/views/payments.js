import { api } from '../api.js';
import { h, toast, openModal } from '../ui.js';
import { icon } from '../icons.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad = (n) => String(n).padStart(2, '0');

export async function paymentsView() {
  const cal = await api.calendar().catch(() => ({ year: new Date().getFullYear() }));
  const now = new Date();
  let y = cal.year, m = now.getMonth(); // padronizado no ano do produto (2027)
  const wrap = h('div', {});
  wrap.append(h('div', { class: 'page-h' }, [
    h('h1', { class: 'display' }, 'Pagamentos do mês'),
    h('div', { class: 'sub' }, 'Sua lista de pagamentos recorrentes, com valor. Marque o que já pagou neste mês.'),
  ]));

  const monthNav = h('div', { class: 'month-nav' });
  const list = h('div', { class: 'pay-list' });
  wrap.append(monthNav, list);

  const addTitle = h('input', { type: 'text', placeholder: 'Ex.: Aluguel, Internet…', maxlength: '80' });
  const addAmount = h('input', { type: 'text', placeholder: 'Valor (ex.: R$ 1.200)', maxlength: '30', style: 'max-width:170px' });
  const addBtn = h('button', { class: 'btn sm' }); addBtn.innerHTML = icon('plus', 16) + ' Adicionar';
  addBtn.onclick = async () => {
    const t = addTitle.value.trim(); if (!t) return;
    try { await api.addPayment(t, addAmount.value.trim()); addTitle.value = ''; addAmount.value = ''; refresh(); } catch (e) { toast(e.message, true); }
  };
  addTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.onclick(); });
  addAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.onclick(); });
  wrap.append(h('div', { class: 'pay-add' }, [addTitle, addAmount, addBtn]));

  function ym() { return `${y}-${pad(m + 1)}`; }
  function paintNav() {
    monthNav.innerHTML = '';
    const prev = h('button', { class: 'btn ghost sm' }); prev.innerHTML = icon('chevronL', 18) + ' Anterior';
    prev.onclick = () => { m--; if (m < 0) { m = 11; y--; } refresh(); };
    const next = h('button', { class: 'btn ghost sm' }); next.innerHTML = 'Próximo ' + icon('chevronR', 18);
    next.onclick = () => { m++; if (m > 11) { m = 0; y++; } refresh(); };
    monthNav.append(prev, h('div', { class: 'm-name' }, `${MESES[m]} de ${y}`), next);
  }

  function editItem(it) {
    const t = h('input', { type: 'text', value: it.title, maxlength: '80' });
    const a = h('input', { type: 'text', value: it.amount || '', placeholder: 'Valor', maxlength: '30' });
    const save = h('button', { class: 'btn sm' }, 'Salvar');
    const modal = openModal(h('div', {}, [
      h('h2', { class: 'display' }, 'Editar pagamento'),
      h('div', { class: 'field' }, [h('label', {}, 'Nome'), t]),
      h('div', { class: 'field' }, [h('label', {}, 'Valor'), a]),
      h('div', { style: 'display:flex;justify-content:flex-end' }, save),
    ]));
    save.onclick = async () => { try { await api.updatePayment(it.id, { title: t.value, amount: a.value }); modal.close(); refresh(); } catch (e) { toast(e.message, true); } };
  }

  async function refresh() {
    paintNav();
    const { items } = await api.payments(ym());
    list.innerHTML = '';
    if (!items.length) { list.append(h('div', { class: 'empty-soft' }, 'Nenhum pagamento na lista ainda. Adicione o primeiro abaixo. 🌿')); return; }
    for (const it of items) {
      const check = h('button', { class: 'pay-check' + (it.paid ? ' on' : ''), 'aria-label': 'marcar como pago' });
      check.innerHTML = it.paid ? icon('check', 16) : '';
      check.onclick = async () => { try { await api.checkPayment(it.id, ym(), !it.paid); refresh(); } catch (e) { toast(e.message, true); } };
      const del = h('button', { class: 'pay-del', 'aria-label': 'remover' }); del.innerHTML = '×';
      del.onclick = async () => { if (!confirm(`Remover "${it.title}" da lista?`)) return; await api.deletePayment(it.id); refresh(); };
      const info = h('div', { class: 'pay-info' }, [
        h('span', { class: 't' }, it.title),
        it.amount ? h('span', { class: 'pay-amount' }, it.amount) : null,
      ]);
      info.onclick = () => editItem(it);
      list.append(h('div', { class: 'pay-item' + (it.paid ? ' paid' : '') }, [check, info, del]));
    }
  }

  refresh();
  return wrap;
}
