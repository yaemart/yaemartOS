import { fetchCapabilities } from '../api/auth-client';

export async function getUserCapabilities(accessToken: string, brand?: string): Promise<string[]> {
  return fetchCapabilities(accessToken, brand);
}

export function canAccess(capabilities: string[], required: string): boolean {
  if (capabilities.includes('*')) {
    return true;
  }
  return capabilities.includes(required);
}
