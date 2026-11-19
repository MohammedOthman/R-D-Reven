// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(here, '../messages');

function load(name: 'en' | 'ar'): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(messagesDir, `${name}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (all, [key, child]) => ({
      ...all,
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

const BANNED_WORDS = [
  'leverage',
  'seamless',
  'robust',
  'powerful',
  'utilize',
  'utilise',
  'empower',
  'streamline',
  'best-in-class',
  'world-class',
  'cutting-edge',
];

describe('translated copy', () => {
  const en = flatten(load('en'));
  const ar = flatten(load('ar'));

  it('has the same keys in English and Arabic', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(ar)) {
      expect(value.trim(), `ar.${key}`).not.toBe('');
    }
  });

  it('avoids empty B2B filler in English', () => {
    const offenders = Object.entries(en).filter(([, value]) => {
      const lower = value.toLowerCase();
      return BANNED_WORDS.some((word) => lower.includes(word));
    });
    expect(offenders).toEqual([]);
  });

  it('keeps the Ecosystem surface in both locales', () => {
    expect(en['nav.ecosystem']).toBeTruthy();
    expect(ar['nav.ecosystem']).toBeTruthy();
    expect(en['ecosystem.emptyTitle']).toBeTruthy();
    expect(ar['ecosystem.emptyTitle']).toBeTruthy();
  });

  it('does not use the old internal state-machine labels', () => {
    expect(en['partnerships.relationship.moveToLabel']).not.toBe('Available transitions');
    expect(en['initiatives.availableTransitionsLabel']).not.toBe('Available transitions');
  });
});
