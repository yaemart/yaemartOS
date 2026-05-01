import { describe, it, expect } from 'vitest';
import { canAccess } from './permissions';

describe('canAccess', () => {
  it('grants access when wildcard present', () => {
    expect(canAccess(['*'], 'listings:read')).toBe(true);
  });

  it('grants access for exact match', () => {
    expect(canAccess(['listings:read', 'products:read'], 'listings:read')).toBe(true);
  });

  it('denies access when capability not found', () => {
    expect(canAccess(['products:read'], 'listings:write')).toBe(false);
  });

  it('denies access with empty capabilities', () => {
    expect(canAccess([], 'listings:read')).toBe(false);
  });
});
