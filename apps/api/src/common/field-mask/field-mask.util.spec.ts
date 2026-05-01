import { describe, expect, it } from 'vitest';
import { applyFieldMask } from './field-mask.util';

describe('applyFieldMask', () => {
  it('returns full payload when wildcard is present', () => {
    const source = { email: 'a@b.com', role: 'admin', secret: 'x' };
    expect(applyFieldMask(source, ['*'])).toEqual(source);
  });

  it('returns only allowed fields', () => {
    const source = { email: 'a@b.com', role: 'admin', secret: 'x' };
    expect(applyFieldMask(source, ['email', 'role'])).toEqual({
      email: 'a@b.com',
      role: 'admin',
    });
  });
});
