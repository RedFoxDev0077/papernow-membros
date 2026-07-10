import { config } from './config.js';

// Nomes dos meses em português (usados nos rótulos do calendário)
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatBR(d) {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Gera as 52 semanas do planner a partir de PLANNER_START (uma segunda-feira).
 * Cada semana: número, data de início (segunda), fim (domingo), mês de referência.
 * Espelha o formato do Master Planner físico.
 */
export function buildWeeks() {
  const weeks = [];
  const start = config.plannerStart;
  for (let i = 0; i < 52; i++) {
    const startDate = addDays(start, i * 7);
    const endDate = addDays(start, i * 7 + 6);
    const monthIndex = startDate.getUTCMonth();
    weeks.push({
      week: i + 1,
      startDate: toISODate(startDate),
      endDate: toISODate(endDate),
      month: monthIndex + 1,
      monthName: MONTHS_PT[monthIndex],
      label: `${formatBR(startDate)} – ${formatBR(endDate)}`,
    });
  }
  return weeks;
}

// Semanas agrupadas por mês (para navegação por meses no calendário)
export function weeksByMonth() {
  const grouped = {};
  for (const w of buildWeeks()) {
    (grouped[w.month] ||= { month: w.month, monthName: w.monthName, weeks: [] }).weeks.push(w);
  }
  return Object.values(grouped);
}

export function isValidWeek(n) {
  return Number.isInteger(n) && n >= 1 && n <= 52;
}

// Semana "atual" do planner: mapeia a data de hoje para o calendário do planner.
// Se hoje estiver fora do ano do planner, projeta o mesmo dia/mês no ano do planner
// para que a experiência já faça sentido durante os testes.
export function currentWeek(now = new Date()) {
  const weeks = buildWeeks();
  const firstStart = new Date(weeks[0].startDate + 'T00:00:00Z');
  const lastEnd = new Date(weeks[51].endDate + 'T23:59:59Z');

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
