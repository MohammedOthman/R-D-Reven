import { describe, expect, it } from 'vitest';
import { rangesOverlap } from '../src/modules/commercial-governance/date-range';

describe('rangesOverlap', () => {
  it('detects two closed ranges that overlap', () => {
    expect(
      rangesOverlap(
        new Date('2026-01-01'),
        new Date('2026-06-30'),
        new Date('2026-06-01'),
        new Date('2026-12-31'),
      ),
    ).toBe(true);
  });

  it('is false for two closed ranges that do not touch', () => {
    expect(
      rangesOverlap(
        new Date('2026-01-01'),
        new Date('2026-03-31'),
        new Date('2026-04-01'),
        new Date('2026-06-30'),
      ),
    ).toBe(false);
  });

  it('treats a null effectiveTo as open-ended, overlapping anything after its start', () => {
    expect(rangesOverlap(new Date('2026-01-01'), null, new Date('2030-01-01'), new Date('2031-01-01'))).toBe(
      true,
    );
  });

  it('is false when an open-ended range starts after the other range ends', () => {
    expect(rangesOverlap(new Date('2030-01-01'), null, new Date('2026-01-01'), new Date('2026-12-31'))).toBe(
      false,
    );
  });

  it('treats touching boundaries (one ends the day the other starts) as overlapping', () => {
    expect(rangesOverlap(new Date('2026-01-01'), new Date('2026-06-01'), new Date('2026-06-01'), null)).toBe(
      true,
    );
  });
});
