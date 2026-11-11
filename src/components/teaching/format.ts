const upToOneDecimal = new Intl.NumberFormat('el-GR', {maximumFractionDigits: 1, useGrouping: false});
const oneDecimal = new Intl.NumberFormat('el-GR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** Greek decimal comma, at most one decimal, no grouping: 62,5 · 2279. */
export function formatNumber(value: number): string {
  return upToOneDecimal.format(value);
}

/** Greek decimal comma, always one decimal: 2,0 · 0,9. */
export function formatOneDecimal(value: number): string {
  return oneDecimal.format(value);
}
