import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from '../src/common/csv';

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('Globex Consolidated')).toBe('Globex Consolidated');
  });

  it('quotes and escapes a value containing a comma', () => {
    expect(csvEscape('Acme, Inc.')).toBe('"Acme, Inc."');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('Say "hello"')).toBe('"Say ""hello"""');
  });

  it('quotes a value containing a newline', () => {
    expect(csvEscape('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('toCsv', () => {
  it('joins a header row and data rows with commas and newlines', () => {
    const csv = toCsv(
      ['Name', 'Stage'],
      [
        ['Globex', 'ACTIVE'],
        ['Acme, Inc.', 'AT_RISK'],
      ],
    );
    expect(csv).toBe('Name,Stage\nGlobex,ACTIVE\n"Acme, Inc.",AT_RISK');
  });

  it('renders null/undefined cells as an empty string, not "null"/"undefined"', () => {
    const csv = toCsv(['A', 'B'], [[null, undefined]]);
    expect(csv).toBe('A,B\n,');
  });

  it('produces just the header row for an empty data set', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A,B');
  });
});
