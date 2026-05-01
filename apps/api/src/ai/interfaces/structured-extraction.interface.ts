/** Placeholder for structured extraction from listings / PDFs (S2+). */
export interface IStructuredExtractionService {
  ping(): Promise<'ok'>;
}
