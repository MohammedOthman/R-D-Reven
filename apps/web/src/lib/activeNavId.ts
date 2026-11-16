/** Maps locale-agnostic workspace paths, including record pages, to navigation. */
export function activeNavIdFromPathname(pathname: string): string {
  const sections = [
    'partnerships',
    'initiatives',
    'reviews',
    'agreements',
    'evidence-outcomes',
    'audit',
    'administration',
    'design-system',
  ];
  return (
    sections.find((section) => pathname === `/${section}` || pathname.startsWith(`/${section}/`)) ??
    'command-center'
  );
}
