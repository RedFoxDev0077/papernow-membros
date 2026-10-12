// Painel de gestão da página "Entre Nós" (aba dentro de /admin).
window.EntreNosAdmin = (() => {
  const h = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };

  // O que cada seção pede no formulário. A capa é obrigatória em todas.
  const SECTIONS = {
    conteudo: {
      label: 'Conteúdo', one: 'conteúdo',
      title: 'Nome do conteúdo', titlePh: 'Ex.: 10 Mandamentos da Produtividade — Carol Tolentino',
      subtitle: 'Texto curto (opcional)', subtitlePh: 'Se ficar vazio, aparece "Publicado em <mês> de <ano>"',
      file: 'Arquivo do conteúdo (PDF ou vídeo MP4)', url: 'ou link do conteúdo (YouTube, site…)', fileFirst: true,
      image: 'Capa — 1200 × 900 px (4:3, deitada)',
      note: 'O conteúdo mais recente entra em destaque no topo; os anteriores ficam logo abaixo.',
    },
    downloads: {
      label: 'Downloads', one: 'material',
      title: 'Nome do material', titlePh: 'Ex.: Controle de Compras Online',
      subtitle: 'Descrição curta (opcional)', subtitlePh: 'Ex.: Organização de pedidos e prazos de entrega.',
      file: 'Arquivo para baixar (PDF)', fileRequired: true,
      image: 'Capa — 1200 × 900 px (4:3, deitada)',
    },
    beneficios: {
      label: 'Benefícios', one: 'parceiro',
      title: 'Nome do parceiro', titlePh: 'Ex.: Coffee Mais',
      subtitle: 'Benefício', subtitlePh: 'Ex.: 20% de desconto em produtos no site', subtitleRequired: true,
      coupon: 'Cupom', url: 'Link do site do parceiro',
      image: 'Imagem ou logo — 1200 × 900 px (4:3). Logo: centralize num fundo liso.',
    },
    videos: {
      label: 'Vídeos', one: 'vídeo',
      title: 'Título do vídeo', titlePh: 'Ex.: Como planejar o ano',
      url: 'Link do vídeo (YouTube ou Vimeo)', file: 'ou arquivo de vídeo (MP4)',
      image: 'Capa — 1280 × 720 px (16:9). Para YouTube, se ficar vazia eu busco a capa do próprio vídeo.',
      imageOptional: true,
    },
    loja: {
      label: 'Loja', one: 'produto',
      title: 'Nome do produto', titlePh: 'Ex.: Caderno A5',
      url: 'Link do produto na loja', urlRequired: true,
      image: 'Foto do produto — 1000 × 1000 px (quadrada)',
    },
  };

  let root, getToken, onDenied, state = null, current = 'conteudo', editing = null;

  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: { 'x-admin-token': getToken(), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) { onDenied(); throw new Error('Acesso negado.'); }
    if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');
    return data;
  }

  // Envio com barra de progresso (vídeos e PDFs grandes).
  function send(method, url, form, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('x-admin-token', getToken());
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* resposta sem JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || (xhr.status === 413 ? 'Arquivo grande demais para o servidor.' : 'Não foi possível salvar.')));
      };
      xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'));
      xhr.send(form);
    });
  }

  async function reload() {
    state = await api('GET', '/api/entrenos/admin');
    render();
  }

  function render() {
    root.innerHTML = '';
    const chips = h('div', { class: 'chips' });
    const tabs = [...Object.entries(SECTIONS).map(([k, v]) => [k, v.label]), ['parceira', 'Parceira em destaque'], ['textos', 'Textos, links e logo']];
    // Ordem igual à da página: Conteúdo, Parceira, Downloads…
    tabs.splice(1, 0, tabs.splice(tabs.findIndex((t) => t[0] === 'parceira'), 1)[0]);
    for (const [k, label] of tabs) {
      const n = state.items[k] ? ` (${state.items[k].length})` : '';
      chips.append(h('button', { class: current === k ? 'on' : '', text: label + n, onclick: () => { current = k; editing = null; render(); } }));
    }
    root.append(
      h('div', { class: 'card' }, [
        h('div', { class: 'toprow' }, [h('b', { text: 'Página Entre Nós' }), h('a', { href: '/entrenos', target: '_blank', rel: 'noopener', text: 'Ver a página ↗' })]),
        chips,
        h('p', { class: 'hint', text: 'Toda alteração aparece na página na hora. Seções sem nenhum item publicado ficam ocultas automaticamente.' }),
      ]),
    );
    if (current === 'parceira') root.append(partnerForm());
    else if (current === 'textos') root.append(textsForm());
    else root.append(itemForm(), itemList());
  }

  const field = (label, input, hint) => h('div', {}, [h('label', { text: label }), input, hint ? h('p', { class: 'hint', text: hint }) : null]);

  // ---- Itens das seções ----
  function itemForm() {
    const cfg = SECTIONS[current];
    const it = editing;
    const f = {
      title: h('input', { placeholder: cfg.titlePh || '', maxlength: 160, value: it?.title || '' }),
      subtitle: cfg.subtitle ? h('input', { placeholder: cfg.subtitlePh || '', maxlength: 400, value: it?.subtitle || '' }) : null,
      coupon: cfg.coupon ? h('input', { placeholder: 'Ex.: PAPERNOW', maxlength: 40, value: it?.coupon || '' }) : null,
      url: cfg.url ? h('input', { type: 'url', placeholder: 'https://…', maxlength: 2000, value: it?.url || '' }) : null,
      file: cfg.file ? h('input', { type: 'file', accept: '.pdf,.mp4,.mov,.webm,.zip,.jpg,.jpeg,.png,application/pdf,video/*' }) : null,
      image: h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' }),
    };
    const msg = h('div', { class: 'msg' });
    const bar = h('div', { class: 'bar hidden' }, h('i'));
    const save = h('button', { text: it ? 'Salvar alterações' : `Adicionar ${cfg.one}` });

    save.onclick = async () => {
      msg.className = 'msg';
      if (!f.title.value.trim()) { msg.className = 'msg err'; msg.textContent = 'Informe o nome/título.'; return; }
      if (!it && !cfg.imageOptional && !f.image.files[0]) { msg.className = 'msg err'; msg.textContent = 'A imagem de capa é obrigatória.'; return; }
      const fd = new FormData();
      fd.append('section', current);
      fd.append('title', f.title.value);
      if (f.subtitle) fd.append('subtitle', f.subtitle.value);
      if (f.coupon) fd.append('coupon', f.coupon.value);
      if (f.url) fd.append('url', f.url.value);
      if (f.image.files[0]) fd.append('image', f.image.files[0]);
      if (f.file && f.file.files[0]) fd.append('file', f.file.files[0]);
      save.disabled = true; bar.classList.remove('hidden'); msg.textContent = 'Enviando…';
      try {
        await send(it ? 'PUT' : 'POST', it ? `/api/entrenos/items/${it.id}` : '/api/entrenos/items', fd, (p) => { bar.firstChild.style.width = p + '%'; msg.textContent = p < 100 ? `Enviando… ${p}%` : 'Processando…'; });
        editing = null;
        await reload();
      } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; save.disabled = false; bar.classList.add('hidden'); }
    };

    const currentFile = it?.fileUrl ? h('p', { class: 'hint' }, ['Arquivo atual: ', h('a', { href: it.fileUrl, target: '_blank', rel: 'noopener', text: 'abrir' }), ' — envie outro só se quiser substituir.']) : null;
    const urlField = f.url ? field(cfg.url, f.url, 'O link é guardado e aberto exatamente como você colar (em nova aba).') : null;
    const optionalFile = f.file && !cfg.fileRequired ? field(cfg.file, f.file, `Até ${state.maxFileMb}MB. Vídeos maiores: publique no YouTube (pode ser "não listado") e cole o link.`) : null;
    const currentFileOpt = f.file && !cfg.fileRequired ? currentFile : null;
    return h('div', { class: 'card' }, [
      h('div', { class: 'toprow' }, [
        h('b', { text: it ? `Editando: ${it.title}` : `Novo ${cfg.one}` }),
        it ? h('button', { class: 'ghost sm', text: 'Cancelar', onclick: () => { editing = null; render(); } }) : null,
      ]),
      cfg.note ? h('p', { class: 'hint', text: cfg.note }) : null,
      field(cfg.title, f.title),
      f.subtitle ? field(cfg.subtitle, f.subtitle) : null,
      f.coupon ? field(cfg.coupon, f.coupon, 'Aparece em destaque no card; a cliente toca para copiar.') : null,
      f.file && cfg.fileRequired ? field(cfg.file, f.file, `Até ${state.maxFileMb}MB.`) : null,
      f.file && cfg.fileRequired ? currentFile : null,
      ...(cfg.fileFirst ? [optionalFile, currentFileOpt, urlField] : [urlField, optionalFile, currentFileOpt]),
      field(it ? 'Trocar a capa (opcional)' : 'Imagem de capa' + (cfg.imageOptional ? '' : ' *'), f.image, cfg.image + ' JPG, PNG ou WEBP.'),
      it?.image ? h('img', { class: 'preview', src: it.image, alt: '' }) : null,
      bar, msg, save,
    ]);
  }

  function itemList() {
    const cfg = SECTIONS[current];
    const items = state.items[current];
    const box = h('div', { style: 'margin-top:8px' });
    if (!items.length) box.append(h('div', { class: 'empty', text: 'Nenhum item ainda — esta seção fica oculta na página até você adicionar o primeiro.' }));
    items.forEach((it, i) => {
      const act = (label, fn, cls = 'mini') => h('button', { class: cls, text: label, onclick: async (e) => { e.target.disabled = true; try { await fn(); } catch (err) { alert(err.message); } } });
      const toggle = () => { const fd = new FormData(); fd.append('active', it.active ? '0' : '1'); return api('PUT', `/api/entrenos/items/${it.id}`, fd).then(reload); };
      box.append(h('div', { class: 'item' + (it.active ? '' : ' off') }, [
        h('div', { class: 'l' }, [
          it.image ? h('img', { class: 'thumb', src: it.image, alt: '' }) : h('div', { class: 'thumb' }),
          h('div', {}, [
            h('div', { class: 't', text: it.title }),
            h('div', { class: 'm' }, [
              it.active ? null : h('span', { class: 'tag', text: 'OCULTO' }),
              it.coupon ? h('span', { class: 'tag', text: it.coupon }) : null,
              it.fileKind ? h('span', { class: 'tag', text: `${it.fileKind.toUpperCase()} · ${it.hits} ${current === 'downloads' ? 'downloads' : 'acessos'}` }) : null,
              it.url && !it.fileKind ? h('span', { class: 'tag', text: 'LINK' }) : null,
            ]),
          ]),
        ]),
        h('div', { class: 'acts' }, [
          i > 0 ? act('↑', () => api('POST', `/api/entrenos/items/${it.id}/move`, { dir: 'up' }).then(reload)) : null,
          i < items.length - 1 ? act('↓', () => api('POST', `/api/entrenos/items/${it.id}/move`, { dir: 'down' }).then(reload)) : null,
          h('button', { class: 'mini', text: 'Editar', onclick: () => { editing = it; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }),
          act(it.active ? 'Ocultar' : 'Mostrar', toggle),
          act('Excluir', async () => { if (confirm(`Excluir "${it.title}"? Essa ação não tem volta.`)) { await api('DELETE', `/api/entrenos/items/${it.id}`); if (editing?.id === it.id) editing = null; } await reload(); }, 'del sm'),
        ]),
      ]));
    });
    return h('div', { class: 'card' }, [h('b', { text: `${cfg.label} publicados` }), box]);
  }

  // ---- Configurações (parceira, textos, links, logo) ----
  async function saveSettings(data, files, msg, btn, flags = {}) {
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    for (const [k, v] of Object.entries(files)) if (v) fd.append(k, v);
    for (const [k, v] of Object.entries(flags)) if (v) fd.append(k, '1');
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Salvando…';
    try {
      await send('PUT', '/api/entrenos/settings', fd, () => {});
      await reload();
    } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; btn.disabled = false; }
  }

  function partnerForm() {
    const p = state.settings.partner, s = state.settings.sections.parceira;
    const inp = (v, max = 600) => h('input', { value: v || '', maxlength: max });
    const area = (v) => { const t = h('textarea', { rows: 2, maxlength: 600 }); t.value = v || ''; return t; };
    const f = {
      active: h('input', { type: 'checkbox', style: 'width:auto;margin-right:8px', checked: p.active }),
      title: inp(s.title), subtitle: area(s.subtitle), menuLabel: inp(p.menuLabel, 40),
      image: h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' }),
      cardTitle: inp(p.cardTitle), cardText: area(p.cardText),
      primaryLabel: inp(p.primaryLabel, 80), primaryUrl: h('input', { type: 'url', value: p.primaryUrl || '', placeholder: 'https://… (link de afiliada)', maxlength: 2000 }),
      storeText: inp(p.storeText), storeUrl: h('input', { type: 'url', value: p.storeUrl || '', placeholder: 'https://www.papernow.com.br/…', maxlength: 2000 }),
      fullText: inp(p.fullText), coupon: inp(p.coupon, 40), fullUrl: h('input', { type: 'url', value: p.fullUrl || '', placeholder: 'https://… (link de afiliada)', maxlength: 2000 }),
      microtext: inp(p.microtext),
    };
    const msg = h('div', { class: 'msg' });
    const btn = h('button', { text: 'Salvar parceira em destaque' });
    btn.onclick = () => saveSettings({
      sections: { parceira: { title: f.title.value, subtitle: f.subtitle.value } },
      partner: { active: f.active.checked, menuLabel: f.menuLabel.value, cardTitle: f.cardTitle.value, cardText: f.cardText.value, primaryLabel: f.primaryLabel.value, primaryUrl: f.primaryUrl.value, storeText: f.storeText.value, storeUrl: f.storeUrl.value, fullText: f.fullText.value, coupon: f.coupon.value, fullUrl: f.fullUrl.value, microtext: f.microtext.value },
    }, { partnerImage: f.image.files[0] }, msg, btn);

    const linkHint = 'Abre em nova aba e é guardado exatamente como você colar — os parâmetros de rastreio não são alterados.';
    return h('div', { class: 'card' }, [
      h('div', { class: 'toprow' }, h('b', { text: 'Parceira em destaque' })),
      h('p', { class: 'hint', text: 'Uma parceira por vez, com acesso liberado. Quando a parceira mudar, troque os textos, a foto e os links aqui.' }),
      h('label', { style: 'display:flex;align-items:center;font-size:14px;color:var(--ink)' }, [f.active, 'Mostrar esta seção na página']),
      h('div', { class: 'row' }, [field('Título da seção', f.title), field('Nome no menu', f.menuLabel)]),
      field('Subtítulo da seção', f.subtitle),
      field('Foto do topo do card', f.image, '1600 × 900 px (16:9, deitada). No computador a foto aparece mais baixa (corta em cima e embaixo), então deixe o assunto principal no centro.'),
      p.image ? h('img', { class: 'preview', src: `/entrenos-media/${p.image}`, alt: '' }) : h('p', { class: 'hint', text: 'Ainda sem foto — a página mostra um bloco neutro no lugar.' }),
      field('Título do card', f.cardTitle),
      field('Texto do card', f.cardText),
      h('fieldset', {}, [h('legend', { text: 'Ação 1 — botão principal' }), field('Texto do botão', f.primaryLabel), field('Link', f.primaryUrl, linkHint)]),
      h('fieldset', {}, [h('legend', { text: 'Ação 2 — quem ainda não tem o Master Planner' }), field('Texto', f.storeText), field('Link da loja', f.storeUrl)]),
      h('fieldset', {}, [h('legend', { text: 'Ação 3 — acesso completo com cupom' }), field('Texto', f.fullText, 'Escreva {cupom} onde o cupom deve aparecer em destaque.'), field('Cupom', f.coupon), field('Link', f.fullUrl, linkHint)]),
      field('Microtexto no fim do card', f.microtext),
      h('p', { class: 'hint', text: 'Enquanto um link estiver vazio, a ação aparece na página mas ainda não clica.' }),
      msg, btn,
    ]);
  }

  function textsForm() {
    const st = state.settings, g = st.general;
    const names = { conteudo: 'Conteúdo exclusivo', downloads: 'Downloads', beneficios: 'Clube de benefícios', videos: 'Vídeos', loja: 'Loja', app: 'Leve o Entre Nós com você' };
    const secs = {};
    const blocks = Object.entries(names).map(([k, label]) => {
      const t = h('input', { value: st.sections[k].title, maxlength: 120 });
      const s = h('textarea', { rows: 2, maxlength: 600 }); s.value = st.sections[k].subtitle;
      secs[k] = { t, s };
      return h('fieldset', {}, [h('legend', { text: label }), field('Título', t), field('Subtítulo', s)]);
    });
    const f = {
      logo: h('input', { type: 'file', accept: 'image/png,image/webp,image/jpeg' }),
      storeUrl: h('input', { type: 'url', value: g.storeUrl || '', maxlength: 2000 }),
      whatsappUrl: h('input', { type: 'url', value: g.whatsappUrl || '', maxlength: 2000 }),
      email: h('input', { value: g.email || '', maxlength: 120 }),
    };
    const msg = h('div', { class: 'msg' });
    const btn = h('button', { text: 'Salvar textos e links' });
    let removeLogo = false;
    btn.onclick = () => {
      const data = { sections: {}, general: { storeUrl: f.storeUrl.value, whatsappUrl: f.whatsappUrl.value, email: f.email.value } };
      for (const [k, v] of Object.entries(secs)) data.sections[k] = { title: v.t.value, subtitle: v.s.value };
      saveSettings(data, { logo: f.logo.files[0] }, msg, btn, { removeLogo: removeLogo && !f.logo.files[0] });
    };
    return h('div', { class: 'card' }, [
      h('div', { class: 'toprow' }, h('b', { text: 'Textos, links e logo' })),
      field('Logo do topo (arte com a tagline)', f.logo, 'PNG com fundo transparente, na versão clara (branca), com cerca de 1200 px de largura. Ela aparece centralizada na faixa nude.'),
      g.logo
        ? h('div', {}, [h('img', { class: 'preview', src: `/entrenos-media/${g.logo}`, alt: '' }), h('p', { class: 'hint' }, h('a', { href: '#', text: 'Remover e voltar ao logo em texto', onclick: (e) => { e.preventDefault(); removeLogo = true; e.target.textContent = 'Será removido ao salvar'; } }))])
        : h('p', { class: 'hint', text: 'Ainda sem arte enviada — a página mostra o nome "ENTRE NÓS" em texto com o logo Papernow.' }),
      field('Link "Ver a loja"', f.storeUrl),
      field('Link do WhatsApp', f.whatsappUrl, 'Vazio = o bloco do WhatsApp some da página.'),
      field('E-mail do rodapé', f.email),
      ...blocks,
      msg, btn,
    ]);
  }

  return {
    init(el, tokenGetter, denied) {
      root = el; getToken = tokenGetter; onDenied = denied;
      root.innerHTML = '<div class="card"><div class="empty">Carregando…</div></div>';
      reload().catch((e) => { root.innerHTML = ''; root.append(h('div', { class: 'card' }, h('div', { class: 'msg err', text: e.message }))); });
    },
  };
})();
