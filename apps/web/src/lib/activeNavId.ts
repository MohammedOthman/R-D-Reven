/** Maps a locale-agnostic pathname to the sidebar nav item id it should highlight. */
export function activeNavIdFromPathname(pathname: string): string {
  if (pathname.startsWith('/design-system')) return 'design-system';
  return 'command-center';
}
