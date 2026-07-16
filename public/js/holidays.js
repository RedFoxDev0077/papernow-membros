// Feriados nacionais do Brasil, calculados para qualquer ano (inclui os móveis).
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Domingo de Páscoa (algoritmo de Meeus/Butcher).
function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function shift(date, days) { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }

export function holidaysFor(year) {
  const e = easter(year);
  return {
    [iso(year, 1, 1)]: 'Confraternização Universal',
    [shift(e, -48)]: 'Carnaval',
    [shift(e, -47)]: 'Carnaval',
    [shift(e, -2)]: 'Sexta-feira Santa',
    [iso(year, 4, 21)]: 'Tiradentes',
    [iso(year, 5, 1)]: 'Dia do Trabalho',
    [shift(e, 60)]: 'Corpus Christi',
    [iso(year, 9, 7)]: 'Independência',
    [iso(year, 10, 12)]: 'N. Sra. Aparecida',
    [iso(year, 11, 2)]: 'Finados',
    [iso(year, 11, 15)]: 'Proclamação da República',
    [iso(year, 11, 20)]: 'Consciência Negra',
    [iso(year, 12, 25)]: 'Natal',
  };
}
