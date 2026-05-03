/**
 * Per-brand voice & tone guidelines injected into listing generation prompts.
 * Single source of truth shared by all platform-specific assemblers.
 *
 * Static for S1/S2; will be sourced from DB (BrandGuidelineService) in S3+.
 */
export const BRAND_VOICE: Record<string, string> = {
  homtone:
    'Brand voice: warm, approachable, and trustworthy. Write in a friendly, confident tone. ' +
    'Emphasize ease of use, family-friendly design, and reliable performance. Avoid technical jargon.',
  spoonlemon:
    'Brand voice: playful, cheerful, and practical. Write with a light, upbeat tone. ' +
    'Emphasize everyday convenience, clever design, and value for money. Use simple, vivid language.',
  davivy:
    'Brand voice: sophisticated, aspirational, and quality-focused. Write with a refined, confident tone. ' +
    'Emphasize premium materials, craftsmanship, and lifestyle elevation. Avoid casual phrasing.',
  tysun:
    'Brand voice: energetic, adventurous, and performance-driven. Write with an active, bold tone. ' +
    'Emphasize durability, outdoor performance, and an active lifestyle. Use action-oriented language.',
};

export function getBrandVoiceSection(brandId: string | undefined): string {
  const key = brandId?.toLowerCase() ?? '';
  const guide = BRAND_VOICE[key];
  return guide
    ? `Brand Voice Guide:\n${guide}`
    : `Brand: ${brandId ?? 'Unknown'} (no specific voice guide; write in a professional, benefit-focused tone).`;
}
