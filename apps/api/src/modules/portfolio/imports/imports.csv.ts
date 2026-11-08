import { parse } from 'csv-parse/sync';
import { UnprocessableEntityException } from '@nestjs/common';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * A hand-rolled `split(',')` breaks on any real-world export (Excel/CRM CSVs
 * routinely quote fields containing commas) — `csv-parse` handles quoting,
 * embedded newlines and escaping correctly. `columns: true` uses the header
 * row as keys, which is exactly the source-column-name mapping IMP-03 needs.
 */
export function parseCsv(buffer: Buffer): ParsedCsv {
  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    throw new UnprocessableEntityException(
      'Could not parse this file as CSV. Check for malformed rows or an inconsistent column count.',
    );
  }

  const [firstRow] = records;
  if (!firstRow) {
    throw new UnprocessableEntityException('This file has no data rows.');
  }

  const headers = Object.keys(firstRow);
  if (headers.length === 0 || headers.some((h) => !h)) {
    throw new UnprocessableEntityException('This file has no usable header row.');
  }

  return { headers, rows: records };
}
