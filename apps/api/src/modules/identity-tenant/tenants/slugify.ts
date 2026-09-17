/** ASCII-only, lowercase, hyphen-separated. Good enough for a URL-safe slug seed — uniqueness is handled by the caller. */
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'organization';
}
