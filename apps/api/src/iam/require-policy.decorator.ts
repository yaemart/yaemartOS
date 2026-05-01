import { SetMetadata } from '@nestjs/common';

export const POLICY_METADATA_KEY = 'iam:policy';

export type PolicyRequirement = {
  obj: string;
  act: string;
  field?: string;
};

export const RequirePolicy = (requirement: PolicyRequirement) =>
  SetMetadata(POLICY_METADATA_KEY, requirement);
