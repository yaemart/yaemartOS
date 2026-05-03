import type { LocaleCode } from '../../generated/prisma';

/**
 * Per-locale writing guidelines injected into listing generation prompts.
 * When targetLocale is not EN, the model writes directly in the target language
 * (no intermediate EN generation + translation).
 *
 * Guidelines are intentionally brief — they guide tone and register, not grammar.
 * The model is expected to produce idiomatic copy in the target language.
 */
export const LOCALE_GUIDELINES: Partial<Record<LocaleCode, string>> = {
  en: [
    '- Lead the title with the brand name + primary keyword + key differentiator',
    '- Each bullet starts with a capitalized feature name followed by an em-dash',
    '- Description must be a coherent paragraph (no bullet formatting)',
    '- Do NOT include any markdown formatting in the JSON string values',
  ].join('\n'),

  es: [
    '- Escribe todo el contenido directamente en español. No traduzcas desde inglés.',
    '- El título debe comenzar con el nombre de la marca + palabra clave principal + diferenciador clave',
    '- Cada punto de viñeta comienza con el nombre de la característica en mayúsculas seguido de un guion largo (—)',
    '- La descripción debe ser un párrafo coherente (sin formato de viñetas)',
    '- Usa un tono natural y fluido en español; evita calcos del inglés',
    '- NO incluyas ningún formato markdown en los valores de cadena JSON',
  ].join('\n'),

  fr: [
    "- Rédige tout le contenu directement en français. Ne traduis pas depuis l'anglais.",
    '- Le titre doit commencer par le nom de la marque + mot-clé principal + différenciateur clé',
    "- Chaque point de liste commence par le nom de la fonctionnalité avec une majuscule, suivi d'un tiret cadratin (—)",
    '- La description doit être un paragraphe cohérent (sans mise en forme de liste)',
    "- Utilise un ton naturel et fluide en français; évite les calques de l'anglais",
    "- N'inclus aucun formatage markdown dans les valeurs de chaîne JSON",
  ].join('\n'),

  de: [
    '- Schreibe alle Inhalte direkt auf Deutsch. Übersetze nicht aus dem Englischen.',
    '- Der Titel beginnt mit dem Markennamen + Hauptkeyword + wichtigstem Alleinstellungsmerkmal',
    '- Jeder Aufzählungspunkt beginnt mit einem großgeschriebenen Merkmalsnamen gefolgt von einem Gedankenstrich (—)',
    '- Die Beschreibung muss ein zusammenhängender Absatz sein (kein Aufzählungsformat)',
    '- Verwende einen natürlichen, fließenden deutschen Stil; vermeide Anglizismen',
    '- Füge keine Markdown-Formatierung in JSON-Stringwerte ein',
  ].join('\n'),

  it: [
    "- Scrivi tutti i contenuti direttamente in italiano. Non tradurre dall'inglese.",
    '- Il titolo deve iniziare con il nome del brand + parola chiave principale + differenziatore chiave',
    '- Ogni punto elenco inizia con il nome della caratteristica in maiuscolo seguito da un trattino em (—)',
    '- La descrizione deve essere un paragrafo coerente (senza formattazione a elenchi)',
    "- Usa un tono naturale e scorrevole in italiano; evita calchi dall'inglese",
    '- NON includere alcuna formattazione markdown nei valori stringa JSON',
  ].join('\n'),
};

/**
 * Returns locale-specific writing guidelines, falling back to EN if the
 * requested locale has no dedicated guidelines.
 */
export function getLocaleGuidelines(locale: LocaleCode): string {
  return LOCALE_GUIDELINES[locale] ?? LOCALE_GUIDELINES['en'] ?? '';
}

/** Returns true when the locale requires the model to write in a non-English language. */
export function isNonEnglishLocale(locale: LocaleCode): boolean {
  return locale !== 'en';
}
