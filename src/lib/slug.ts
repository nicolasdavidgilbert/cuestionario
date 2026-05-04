export function normalizeSlug(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}
