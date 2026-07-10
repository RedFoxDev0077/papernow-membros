export function isValidWeek(n) {
  return Number.isInteger(n) && n >= 1 && n <= 52;
}
