import { describe, expect, it } from 'vitest';
import { slugify } from '../src/modules/identity-tenant/tenants/slugify';

describe('slugify', () => {
  it('lowercases and hyphenates a normal name', () => {
    expect(slugify('Northwind Cloud')).toBe('northwind-cloud');
  });

  it('strips punctuation and collapses repeated separators', () => {
    expect(slugify('Acme & Co., Ltd.')).toBe('acme-co-ltd');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Globex-  ')).toBe('globex');
  });

  it('falls back to a generic slug when nothing ASCII-alphanumeric survives', () => {
    // A non-Latin name (e.g. Arabic) produces no a-z0-9 characters — the
    // caller's uniqueness loop still gives it a distinct slug via a suffix.
    expect(slugify('شركة الشمال')).toBe('organization');
  });
});
