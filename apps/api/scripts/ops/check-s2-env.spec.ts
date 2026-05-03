import { describe, expect, it } from 'vitest';
import { run } from './check-s2-env';

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'GEMINI_API_KEY',
  'GEMINI_EMBED_MODEL',
  'NEXTAUTH_SECRET',
  'LINGXING_APP_ID',
  'LINGXING_APP_SECRET',
  'JWT_SECRET',
];

function fullEnv(
  overrides?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/yaemartos',
    REDIS_URL: 'redis://localhost:6379',
    GEMINI_API_KEY: 'AIzaSy-test-key',
    GEMINI_EMBED_MODEL: 'text-embedding-004',
    NEXTAUTH_SECRET: 'nextauth-secret-value',
    LINGXING_APP_ID: 'lx_app_001',
    LINGXING_APP_SECRET: 'lx_secret_abc',
    JWT_SECRET: 'jwt-secret-value',
    ...overrides,
  };
}

describe('check-s2-env run()', () => {
  it('returns true when all required vars are present', () => {
    expect(run(fullEnv())).toBe(true);
  });

  it('returns false when a required var is missing', () => {
    expect(run(fullEnv({ DATABASE_URL: undefined }))).toBe(false);
    expect(run(fullEnv({ GEMINI_API_KEY: undefined }))).toBe(false);
    expect(run(fullEnv({ JWT_SECRET: undefined }))).toBe(false);
  });

  it('treats an empty-string value as missing for required vars', () => {
    expect(run(fullEnv({ REDIS_URL: '' }))).toBe(false);
    expect(run(fullEnv({ LINGXING_APP_SECRET: '   ' }))).toBe(false);
  });

  it('returns true when an optional var (GEMINI_MODEL) is absent', () => {
    const env = fullEnv({ GEMINI_MODEL: undefined });
    expect(run(env)).toBe(true);
  });

  it('returns true even when GEMINI_EMBED_MODEL has a different value (warning, not error)', () => {
    // expectedValue mismatch is a WARNING, not a hard failure
    expect(run(fullEnv({ GEMINI_EMBED_MODEL: 'text-embedding-005' }))).toBe(true);
  });

  it('returns false only when a required var is absent, not on warning', () => {
    const env = fullEnv({ GEMINI_EMBED_MODEL: 'wrong-model' });
    expect(run(env)).toBe(true);
  });

  it('returns false if multiple required vars are missing', () => {
    expect(
      run({
        ...fullEnv(),
        DATABASE_URL: undefined,
        REDIS_URL: undefined,
        JWT_SECRET: undefined,
      }),
    ).toBe(false);
  });

  it('returns true with all required keys set to non-empty strings', () => {
    const env = Object.fromEntries(REQUIRED_KEYS.map((k) => [k, 'dummy-value']));
    expect(run(env)).toBe(true);
  });
});
