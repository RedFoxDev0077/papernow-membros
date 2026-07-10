import { h } from '../ui.js';

// Páginas mapeadas para etapas seguintes (Fase 2 / conteúdo em preparação).
const PAGES = {
  habitos: {
    title: 'Hábitos',
    text: 'Em breve você vai acompanhar seus hábitos ao longo do ano, do jeitinho do Master Planner — autocuidado, finanças, sono e o que mais fizer sentido pra você.',
  },
  biblioteca: {
    title: 'Biblioteca',
    text: 'Aqui ficarão os materiais Papernow para download — os conteúdos do "Entre Nós", PDFs e novidades mensais. Estamos preparando tudo com carinho.',
  },
  conteudo: {
    title: 'Conteúdo exclusivo',
    text: 'Um espaço só para clientes Papernow, com conteúdos especiais e a metodologia da nossa parceira. Chega em breve.',
  },
};

export async function soonView(id) {
  const p = PAGES[id] || { title: 'Em breve', text: 'Esta seção está a caminho.' };
  return h('div', {}, [
    h('div', { class: 'page-h' }, [h('h1', { class: 'display' }, p.title)]),
    h('div', { class: 'soon' }, [
      h('img', { class: 'bloom', src: '/img/botanical-branch.svg', alt: '' }),
      h('h2', {}, 'Em preparação 🌿'),
      h('p', {}, p.text),
      h('span', { class: 'tag' }, 'Chega nas próximas etapas'),
    ]),
  ]);
}
