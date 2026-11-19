/** Lowercase, scheme- and www-free, path-free identity key for a company domain. */
export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.trim();
  return normalized || null;
}
