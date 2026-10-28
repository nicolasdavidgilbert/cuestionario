// CSV RFC 4180 con BOM para que Excel detecte UTF-8.
// Las celdas que empiezan por = + - @ se prefijan con ' para evitar fórmulas al abrirlas.
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((column) => escapeCell(column.label)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column.key])).join(','))
  }
  return `﻿${lines.join('\r\n')}\r\n`
}
