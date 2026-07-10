// Ícones de linha (SVG inline, herdam currentColor). Estilo fino e elegante.
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  week: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><rect x="7" y="12.5" width="4" height="4" rx="1" fill="currentColor" stroke="none"/>',
  camera: '<path d="M4 8.5h3l1.5-2h7L18 8.5h2A1.5 1.5 0 0 1 21.5 10v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  note: '<path d="M6 3.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z"/><path d="M14.5 3.5V8H19M8 12.5h8M8 16h5"/>',
  habits: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M12 3.5V6M9 2.5h6"/>',
  book: '<path d="M4 5c2.5-1.2 5-1.2 8 0 3-1.2 5.5-1.2 8 0v13c-2.5-1.2-5-1.2-8 0-3-1.2-5.5-1.2-8 0Z"/><path d="M12 5v13"/>',
  gift: '<path d="M4.5 11.5h15V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z"/><path d="M3.5 8h17v3.5h-17ZM12 8v13"/><path d="M12 8s-1-4-3.5-4-2 3 3.5 4c5.5-1 1-4-1.5-4-.5 0-2 0-2 0"/>',
  heartcontent: '<path d="M12 21s-7-4.4-9-8.3C1.6 9.9 3 6.5 6.2 6.5c1.9 0 3 1.2 3.8 2.3.8-1.1 1.9-2.3 3.8-2.3 3.2 0 4.6 3.4 3.2 6.2C19 16.6 12 21 12 21Z"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  logout: '<path d="M14 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h8"/><path d="M17 8.5l4 3.5-4 3.5M9.5 12h11.5"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M4 4l16 16M9.5 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.6M6.4 7.9A15.9 15.9 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 2.4-.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronL: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronR: '<path d="M9.5 6l6 6-6 6"/>',
  chevronD: '<path d="M6 9.5l6 6 6-6"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  spark: '<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z"/>',
  cake: '<path d="M4 20.5h16M5 20.5v-6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6.5"/><path d="M12 8.5v3M12 5.5v.5"/>',
  plane: '<path d="M4 13.5l16-6-6 16-2.5-6.5L4 13.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};

export function icon(name, size = 20) {
  const d = P[name] || '';
  return `<svg class="i-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${d}</svg>`;
}

// Elemento SVG (para inserir via appendChild)
export function iconEl(name, size = 20) {
  const span = document.createElement('span');
  span.className = 'ic';
  span.style.display = 'inline-flex';
  span.innerHTML = icon(name, size);
  return span;
}
