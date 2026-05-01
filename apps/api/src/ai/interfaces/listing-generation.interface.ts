import type { GenerateListingInput, ListingContent } from '@yaemartos/shared-types';

export interface IListingGenerationService {
  helloWorld(): Promise<string>;
  generateListing(input: GenerateListingInput): Promise<ListingContent>;
}
