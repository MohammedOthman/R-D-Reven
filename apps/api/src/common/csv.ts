// Shared by CSV Import's error-file download and every Authorized CSV
// Export endpoint (PRD §2.2: "Exports apply the same row and field
// policies as the initiating user"). Hand-rolled rather than a dependency
// — `csv-parse` (already a dependency) exists because this app has to
// tolerate arbitrary external CSVs on the way in; every export here starts
// from data this app already fully controls, so a correct two-rule
// escaper is all writing needs.
export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map((value) => csvEscape(value ?? '')).join(','));
  }
  return lines.join('\n');
}
