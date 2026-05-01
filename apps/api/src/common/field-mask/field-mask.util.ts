export function applyFieldMask<T extends Record<string, unknown>>(
  payload: T,
  allowedFields: string[],
): Partial<T> {
  if (allowedFields.includes('*')) {
    return payload;
  }

  const result: Partial<T> = {};
  for (const key of allowedFields) {
    if (key in payload) {
      result[key as keyof T] = payload[key as keyof T];
    }
  }
  return result;
}
