export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  return 0
}

export function formatNumber(n: number): string {
  return n.toLocaleString()
}
