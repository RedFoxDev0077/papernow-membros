import { config } from './config.js';

// Nomes dos meses em português (usados nos rótulos do calendário)
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toISODate(d) { return d.toISOString().slice(0, 10); }
function formatBR(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Segunda-feira da semana que contém `date` (semana começa na segunda).
function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();               // 0=Dom … 6=Sáb
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Gera as semanas do planner de forma CONTÍNUA e sem dias órfãos:
 * a Semana 1 é a semana (seg–dom) que contém 1º de janeiro do ano do planner,
 * e as semanas seguem até cobrir 31 de dezembro. Isso resulta em 52 ou 53 semanas
 * conforme o ano real e faz a virada de ano sem deixar dias de fora.
 *
 * Um início explícito pode ser fixado via PLANNER_START (uma segunda-feira),
 * caso o planner físico use outra âncora — é só ajustar essa variável.
 */
export function buildWeeks() {
  const year = config.plannerYear;
  const week1 = config.plannerStart
    ? mondayOfWeek(new Date(config.plannerStart + 'T00:00:00Z'))
    : mondayOfWeek(new Date(Date.UTC(year, 0, 1)));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const weeks = [];
  const cur = new Date(week1);
  let i = 0;
  while (cur <= yearEnd && i < 53) {
    const start = new Date(cur);
    const end = new Date(cur); end.setUTCDate(end.getUTCDate() + 6);

    // Mês de referência: mês do início da semana; a Semana 1 que começa em
    // dezembro do ano anterior é agrupada em Janeiro (é a 1ª semana do planner).
    let m = start.getUTCMonth();
    if (start.getUTCFullYear() < year) m = 0;

    weeks.push({
      week: i + 1,
      startDate: toISODate(start),
      endDate: toISODate(end),
      month: m + 1,
      monthName: MONTHS_PT[m],
      label: `${formatBR(start)} – ${formatBR(end)}`,
    });
    cur.setUTCDate(cur.getUTCDate() + 7);
    i++;
  }
  return weeks;
}

export function totalWeeks() { return buildWeeks().length; }

// Semanas agrupadas por mês (para navegação por meses no calendário)
export function weeksByMonth() {
  const grouped = {};
  for (const w of buildWeeks()) {
    (grouped[w.month] ||= { month: w.month, monthName: w.monthName, weeks: [] }).weeks.push(w);
  }
  return Object.values(grouped).sort((a, b) => a.month - b.month);
}

export function isValidWeek(n) {
  return Number.isInteger(n) && n >= 1 && n <= totalWeeks();
}

// Semana "atual" do planner: mapeia a data de hoje para o calendário do planner.
export function currentWeek(now = new Date()) {
  const weeks = buildWeeks();
  const firstStart = new Date(weeks[0].startDate + 'T00:00:00Z');
  const lastEnd = new Date(weeks[weeks.length - 1].endDate + 'T23:59:59Z');

  let ref = new Date(Date.UTC(config.plannerYear, now.getUTCMonth(), now.getUTCDate()));
  if (ref < firstStart) ref = firstStart;
  if (ref > lastEnd) ref = lastEnd;

  for (const w of weeks) {
    const start = new Date(w.startDate + 'T00:00:00Z');
    const end = new Date(w.endDate + 'T23:59:59Z');
    if (ref >= start && ref <= end) return w;
  }
  return weeks[0];
}

export { MONTHS_PT };
