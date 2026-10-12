import { db } from './db.js';

// Seções com lista de itens (a "parceira em destaque" e o bloco do app são configurações).
export const SECTIONS = ['conteudo', 'downloads', 'beneficios', 'videos', 'loja'];

// Textos padrão da página — tudo aqui pode ser trocado pelo painel (/admin).
export const DEFAULTS = {
  sections: {
    conteudo: {
      title: 'Conteúdo exclusivo',
      subtitle: 'Conteúdos preparados com parceiros e especialistas que inspiram e transformam. Sempre que tem novidade, ela aparece aqui.',
    },
    parceira: {
      title: 'Organização Sincera',
      subtitle: 'A parceira que a gente escolheu para você, com uma condição que só quem tem o Master Planner recebe.',
    },
    downloads: {
      title: 'Downloads exclusivos',
      subtitle: 'Materiais extras para você baixar e imprimir em casa. Pensados para facilitar a rotina e deixar sua organização ainda mais prática.',
    },
    beneficios: {
      title: 'Clube de benefícios',
      subtitle: 'Marcas que acreditam no mesmo propósito do Master Planner: cuidar de você e do seu bem-estar. Descontos e vantagens especiais para a nossa comunidade.',
    },
    videos: {
      title: 'Aprenda em vídeo',
      subtitle: 'Dicas práticas e tutoriais para você organizar a rotina do seu jeito.',
    },
    loja: {
      title: 'Selecionados para você',
      subtitle: 'Uma curadoria da nossa loja com o que mais combina com você. Clique em cada produto para ver os detalhes.',
    },
    app: {
      title: 'Leve o Entre Nós com você',
      subtitle: 'Salve na tela do seu celular e acesse com um toque, sem precisar lembrar do endereço.',
    },
  },
  partner: {
    active: true,
    image: null,
    menuLabel: 'Organização Sincera',
    cardTitle: 'Seu acesso ao Organização Sincera',
    cardText: 'Cliente Master Planner tem uma parte do Organização Sincera liberada. É só entrar com o mesmo CPF da sua compra.',
    primaryLabel: 'Liberar meu acesso',
    primaryUrl: '',
    storeText: 'Ainda não tem o Master Planner? Garanta o seu e libere esse acesso.',
    storeUrl: 'https://www.papernow.com.br',
    // {cupom} marca onde o cupom aparece em destaque dentro da frase.
    fullText: 'Quer o Organização Sincera completo? Use o cupom {cupom} e garanta seu acesso com desconto.',
    coupon: 'PAPERNOW',
    fullUrl: '',
    microtext: 'Pedimos o CPF só para confirmar que você é cliente.',
  },
  general: {
    logo: null,
    storeUrl: 'https://www.papernow.com.br',
    whatsappUrl: 'https://api.whatsapp.com/send/?phone=5531992700016&text=Ol%C3%A1%2C+vi+a+p%C3%A1gina+Entre+N%C3%B3s+e+gostaria+de+mais+informa%C3%A7%C3%B5es.',
    email: 'atendimento@papernow.com.br',
  },
};

// Links externos: aceitamos só http(s) e guardamos a string EXATAMENTE como veio
// (sem reescrever nem reordenar parâmetros — links de afiliada dependem disso).
export function cleanUrl(v) {
  const s = String(v ?? '').trim();
  if (!s || s.length > 2000) return null;
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

export function getSettings() {
  let saved = {};
  try {
    const row = db.prepare("SELECT value FROM entrenos_settings WHERE key = 'main'").get();
    if (row) saved = JSON.parse(row.value) || {};
  } catch { /* usa os padrões */ }
  const out = {};
  for (const [group, def] of Object.entries(DEFAULTS)) {
    if (group === 'sections') {
      out.sections = {};
      for (const [k, d] of Object.entries(def)) out.sections[k] = { ...d, ...(saved.sections?.[k] || {}) };
    } else {
      out[group] = { ...def, ...(saved[group] || {}) };
    }
  }
  return out;
}

export function saveSettings(settings) {
  db.prepare("INSERT INTO entrenos_settings (key, value) VALUES ('main', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(settings));
}

// Vídeos do YouTube/Vimeo tocam dentro da própria página (player incorporado).
export function youtubeId(url) {
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i.exec(String(url || ''));
  return m ? m[1] : null;
}
export function embedUrl(url) {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(String(url || ''));
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

export function publicItem(row) {
  const isVideoFile = !!row.file && /^video\//.test(row.file_type || '');
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    subtitle: row.subtitle || '',
    image: row.image ? `/entrenos-media/${row.image}` : null,
    fileUrl: row.file ? `/api/entrenos/file/${row.id}` : null,
    fileKind: row.file ? (isVideoFile ? 'video' : (row.file_type === 'application/pdf' ? 'pdf' : 'file')) : null,
    url: row.url || null,
    embed: row.url ? embedUrl(row.url) : null,
    coupon: row.coupon || '',
    active: !!row.active,
    position: row.position,
    hits: row.hits || 0,
    created_at: row.created_at,
  };
}

export function listItems({ onlyActive = false } = {}) {
  const rows = db
    .prepare(`SELECT * FROM entrenos_items ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY position ASC, id ASC`)
    .all();
  const grouped = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  for (const r of rows) if (grouped[r.section]) grouped[r.section].push(publicItem(r));
  return grouped;
}
