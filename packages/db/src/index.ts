export const TENANT_SCHEMAS = ['homtone', 'spoonlemon', 'davivy', 'tysun'] as const;
export type TenantSchema = (typeof TENANT_SCHEMAS)[number];

export const DEFAULT_TENANT: TenantSchema = 'homtone';

export function isTenantSchema(value: string): value is TenantSchema {
  return TENANT_SCHEMAS.includes(value as TenantSchema);
}

export function buildSchemaConnectionString(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set('options', `-csearch_path=${schema},public`);
  return url.toString();
}
