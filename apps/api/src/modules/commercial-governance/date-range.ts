// Shared by Agreement and Commercial Rule version approval — both apply the
// identical "no two approved versions may cover overlapping effective
// windows" rule (AGR-02/RULE-03's shared acceptance gate; T-011).
export function rangesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date(8640000000000000);
  const bEnd = bTo ?? new Date(8640000000000000);
  return aFrom <= bEnd && bFrom <= aEnd;
}
