import { getSettings, listItems } from './entrenos-data.js';

// Página pública "Entre Nós" — montada no servidor para abrir já com o conteúdo.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
));

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  img: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="10" r="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 17l5-4 3 2.5 3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M5.5 8h13l-1 12h-11zM9 8V7a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 4h7l9 9-7 7-9-9zM8 8h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.4 8.3l-1.2 1c.4 3 2.5 5.1 5.5 5.5l1-1.2-1.8-1.1-.8.6c-.9-.4-1.5-1-1.9-1.9l.6-.8z" fill="currentColor"/></svg>',
};

const placeholder = (cls = '') => `<div class="ph ${cls}" aria-hidden="true">${ICON.img}</div>`;
const cover = (item, cls = '') => (item.image
  ? `<img class="${cls}" src="${esc(item.image)}" alt="" loading="lazy" decoding="async">`
  : placeholder(cls));

// Links externos: nova aba e a URL exatamente como foi cadastrada (parâmetros de afiliada intactos).
// rel="noopener" (sem "noreferrer") mantém o Referer para o rastreio da parceira.
const extAttrs = (url) => `href="${esc(url)}" target="_blank" rel="noopener"`;

function sectionHead(n, s, id, metaHtml = '') {
  return `<header class="sec-h">
      <div class="sec-n"><span>${String(n).padStart(2, '0')}</span><i></i></div>
      <div class="sec-t"><h2 id="${id}-t">${esc(s.title)}</h2>${metaHtml}</div>
      ${s.subtitle ? `<p class="sec-s">${esc(s.subtitle)}</p>` : ''}
    </header>`;
}

// O que acontece ao tocar num conteúdo/vídeo: player na página ou abrir o material.
function openAttrs(item) {
  if (item.embed) return `href="${esc(item.url)}" target="_blank" rel="noopener" data-embed="${esc(item.embed)}" data-title="${esc(item.title)}"`;
  if (item.fileKind === 'video') return `href="${esc(item.fileUrl)}" target="_blank" rel="noopener" data-video="${esc(item.fileUrl)}" data-title="${esc(item.title)}"`;
  if (item.fileUrl) return `href="${esc(item.fileUrl)}" target="_blank" rel="noopener"`;
  return extAttrs(item.url);
}

function publishedLabel(item) {
  if (item.subtitle) return esc(item.subtitle);
  const d = new Date(String(item.created_at).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : `Publicado em ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function secConteudo(n, s, items) {
  const [first, ...rest] = items;
  return `<section class="sec" id="conteudo" aria-labelledby="conteudo-t">
    ${sectionHead(n, s, 'conteudo')}
    <article class="feature">
      <a class="feature-img" ${openAttrs(first)} tabindex="-1" aria-hidden="true">${cover(first)}${first.embed || first.fileKind === 'video' ? `<span class="play">${ICON.play}</span>` : ''}</a>
      <div class="feature-b">
        <h3>${esc(first.title)}</h3>
        <p class="muted">${publishedLabel(first)}</p>
        <a class="btn" ${openAttrs(first)}>Ver conteúdo ${ICON.arrow}</a>
      </div>
    </article>
    ${rest.length ? `<h3 class="sub-h">Conteúdos anteriores</h3>
    <div class="grid g3">${rest.map((it) => `
      <article class="card">
        <a class="card-img r43" ${openAttrs(it)} tabindex="-1" aria-hidden="true">${cover(it)}${it.embed || it.fileKind === 'video' ? `<span class="play">${ICON.play}</span>` : ''}</a>
        <div class="card-b">
          <h4>${esc(it.title)}</h4>
          <p class="muted">${publishedLabel(it)}</p>
          <a class="link" ${openAttrs(it)}>Ver conteúdo ${ICON.arrow}</a>
        </div>
      </article>`).join('')}
    </div>` : ''}
  </section>`;
}

function secParceira(n, s, p) {
  const action = (url, cls, inner) => (url
    ? `<a class="act ${cls}" ${extAttrs(url)}>${inner}</a>`
    : `<span class="act ${cls} soon" aria-disabled="true" title="Link em breve">${inner}</span>`);
  const fullText = esc(p.fullText).replace('{cupom}', p.coupon ? `<b class="cupom">${esc(p.coupon)}</b>` : '');
  return `<section class="sec" id="parceira" aria-labelledby="parceira-t">
    ${sectionHead(n, s, 'parceira')}
    <article class="partner">
      <div class="partner-img">${p.image ? `<img src="/entrenos-media/${esc(p.image)}" alt="${esc(s.title)}" loading="lazy" decoding="async">` : placeholder()}</div>
      <div class="partner-b">
        <h3>${esc(p.cardTitle)}</h3>
        <p>${esc(p.cardText)}</p>
        <div class="acts">
          ${action(p.primaryUrl, 'act-1', `${ICON.lock}<span>${esc(p.primaryLabel)}</span>${ICON.arrow}`)}
          ${action(p.storeUrl, 'act-2', `${ICON.bag}<span>${esc(p.storeText)}</span>${ICON.arrow}`)}
          ${action(p.fullUrl, 'act-3', `${ICON.tag}<span>${fullText}</span>${ICON.ext}`)}
        </div>
        ${p.microtext ? `<p class="micro">${esc(p.microtext)}</p>` : ''}
      </div>
    </article>
  </section>`;
}

function secDownloads(n, s, items) {
  const meta = `<span class="sec-m">${items.length} ${items.length === 1 ? 'material' : 'materiais'}</span>`;
  return `<section class="sec" id="downloads" aria-labelledby="downloads-t">
    ${sectionHead(n, s, 'downloads', meta)}
    <div class="grid g3">${items.map((it) => `
      <a class="card card-a" href="${esc(it.fileUrl)}" download>
        <div class="card-img r43">${cover(it)}</div>
        <div class="card-b">
          <h4>${esc(it.title)}</h4>
          ${it.subtitle ? `<p class="muted">${esc(it.subtitle)}</p>` : ''}
          <span class="link">${ICON.down} Baixar</span>
        </div>
      </a>`).join('')}
    </div>
  </section>`;
}

function secBeneficios(n, s, items) {
  return `<section class="sec" id="beneficios" aria-labelledby="beneficios-t">
    ${sectionHead(n, s, 'beneficios')}
    <div class="grid g3">${items.map((it) => `
      <article class="card">
        <div class="card-img r43">${cover(it)}</div>
        <div class="card-b">
          <h4>${esc(it.title)}</h4>
          <p class="muted">${esc(it.subtitle)}</p>
          <div class="card-acts">
            ${it.coupon ? `<button type="button" class="cupom cupom-btn" data-copy="${esc(it.coupon)}" title="Copiar cupom"><span>${esc(it.coupon)}</span>${ICON.copy}</button>` : ''}
            ${it.url ? `<a class="link" ${extAttrs(it.url)}>Ir para o site ${ICON.ext}</a>` : ''}
          </div>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

function secVideos(n, s, items) {
  return `<section class="sec" id="videos" aria-labelledby="videos-t">
    ${sectionHead(n, s, 'videos')}
    <div class="grid g3">${items.map((it) => `
      <a class="video" ${openAttrs(it)}>
        <div class="card-img r169">${cover(it)}<span class="play">${ICON.play}</span></div>
        <h4>${esc(it.title)}</h4>
      </a>`).join('')}
    </div>
  </section>`;
}

function secLoja(n, s, items, storeUrl) {
  const meta = storeUrl ? `<a class="sec-m" ${extAttrs(storeUrl)}>Ver a loja ${ICON.arrow}</a>` : '';
  return `<section class="sec" id="loja" aria-labelledby="loja-t">
    ${sectionHead(n, s, 'loja', meta)}
    <div class="grid g6">${items.map((it) => `
      <a class="prod" ${extAttrs(it.url)}>
        <div class="card-img r11">${cover(it)}</div>
        <span>${esc(it.title)}</span>
      </a>`).join('')}
    </div>
  </section>`;
}

function secApp(n, s) {
  return `<section class="sec" id="app" aria-labelledby="app-t">
    ${sectionHead(n, s, 'app')}
    <article class="appcard">
      <div class="appcard-b">
        <h3>Tudo no mesmo lugar</h3>
        <p>Salve o Entre Nós no seu celular e tenha à mão o que a gente preparou para você, onde estiver.</p>
        <button type="button" class="btn" id="btn-instalar">${ICON.phone} Salvar na tela de início</button>
        <p class="micro">Funciona no iPhone e no Android, sem baixar nada da loja de aplicativos.</p>
      </div>
      <div class="phone" aria-hidden="true">
        <div class="phone-app"><img src="/entrenos/icon-192.png" alt="" width="46" height="46" loading="lazy"><small>Entre Nós</small></div>
        <div class="phone-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </article>
  </section>`;
}

export function renderEntreNos() {
  const st = getSettings();
  const items = listItems({ onlyActive: true });
  const g = st.general;

  // Seções sem nenhum item publicado ficam ocultas (e saem do menu) até serem preenchidas.
  const blocks = [];
  if (items.conteudo.length) blocks.push({ id: 'conteudo', menu: 'Conteúdo', html: (n) => secConteudo(n, st.sections.conteudo, items.conteudo) });
  if (st.partner.active) blocks.push({ id: 'parceira', menu: st.partner.menuLabel || st.sections.parceira.title, html: (n) => secParceira(n, st.sections.parceira, st.partner) });
  if (items.downloads.length) blocks.push({ id: 'downloads', menu: 'Downloads', html: (n) => secDownloads(n, st.sections.downloads, items.downloads) });
  if (items.beneficios.length) blocks.push({ id: 'beneficios', menu: 'Benefícios', html: (n) => secBeneficios(n, st.sections.beneficios, items.beneficios) });
  if (items.videos.length) blocks.push({ id: 'videos', menu: 'Vídeos', html: (n) => secVideos(n, st.sections.videos, items.videos) });
  if (items.loja.length) blocks.push({ id: 'loja', menu: 'Loja', html: (n) => secLoja(n, st.sections.loja, items.loja, g.storeUrl) });
  blocks.push({ id: 'app', menu: null, html: (n) => secApp(n, st.sections.app) });

  const logo = g.logo
    ? `<img class="logo-art" src="/entrenos-media/${esc(g.logo)}" alt="Entre Nós — Papernow">`
    : `<span class="logo-txt"><b>ENTRE NÓS</b><em>Conteúdo único, pensado só para você.</em><img src="/entrenos/papernow-white.png" alt="Papernow" width="472" height="54"></span>`;

  const description = 'O espaço exclusivo de quem tem o Master Planner Papernow: conteúdos, downloads, benefícios e vídeos em um só lugar.';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Entre Nós · Papernow</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#B29B8B">
<meta property="og:title" content="Entre Nós · Papernow">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/entrenos/icon-512.png">
<link rel="manifest" href="/entrenos.webmanifest">
<link rel="icon" href="/entrenos/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/entrenos/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Entre Nós">
<link rel="preload" href="/fonts/lora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/montserrat-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/entrenos/entrenos.css?v=1">
</head>
<body>
<a class="skip" href="#inicio">Pular para o conteúdo</a>
<header class="top" id="topo">
  <a class="logo" href="#topo" aria-label="Entre Nós — Papernow">${logo}</a>
</header>
<nav class="menu" aria-label="Seções">
  <div class="menu-in">${blocks.filter((b) => b.menu).map((b) => `<a href="#${b.id}">${esc(b.menu)}</a>`).join('')}</div>
</nav>
<main id="inicio">
  ${blocks.map((b, i) => b.html(i + 1)).join('\n  ')}
  ${g.whatsappUrl ? `<aside class="wa">
    <div><h3>Ficou com alguma dúvida?</h3><p>A gente responde rapidinho por aqui.</p></div>
    <a class="btn" ${extAttrs(g.whatsappUrl)}>${ICON.wa} Chamar no WhatsApp</a>
  </aside>` : ''}
</main>
<footer class="foot">© ${new Date().getFullYear()} Papernow${g.email ? ` · <a href="mailto:${esc(g.email)}">${esc(g.email)}</a>` : ''}</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/entrenos/entrenos.js?v=1" defer></script>
</body>
</html>`;
}
