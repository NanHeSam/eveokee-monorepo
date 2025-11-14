import slugify from "@sindresorhus/slugify";

/**
 * Generate a URL-safe slug from a title
 * Handles unicode characters by transliterating them (e.g., "Café" -> "cafe", "你好" -> "ni-hao")
 * 
 * @param title - The title to generate a slug from
 * @returns A URL-safe slug, or empty string if title is empty/invalid
 */
export function generateSlug(title: string): string {
  if (!title || typeof title !== "string") {
    return "";
  }

  return slugify(title, {
    lowercase: true,
    separator: "-",
    decamelize: false,
    customReplacements: [
      // Ensure common punctuation is handled consistently
      ["'", ""], // Remove apostrophes
      ["'", ""], // Remove smart apostrophes
      ['"', ""], // Remove quotes
      ['"', ""], // Remove smart quotes
    ],
  });
}

/**
 * Normalize tags field from various payload formats to a consistent string array
 * Handles multiple formats:
 * - Array in payload.tags or payload.tag
 * - Single string in payload.tags or payload.tag
 *
 * @param payload - The payload object that may contain tags in various formats
 * @returns An array of tag strings, empty array if no tags found
 */
export function normalizeTagsField(payload: any): string[] {
  if (Array.isArray(payload.tags)) return payload.tags;
  if (Array.isArray(payload.tag)) return payload.tag;
  if (typeof payload.tags === "string") return [payload.tags];
  if (typeof payload.tag === "string") return [payload.tag];
  return [];
}

/**
 * Calculate estimated reading time in minutes from markdown content
 * Uses average reading speed of 200 words per minute
 *
 * @param markdown - The markdown content to analyze
 * @returns Estimated reading time in minutes (minimum 1 minute)
 */
export function calculateReadingTime(markdown: string): number {
  if (!markdown || typeof markdown !== "string") {
    return 1;
  }

  // Remove markdown formatting to get clean text
  // Remove code blocks
  let cleanText = markdown.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  cleanText = cleanText.replace(/`[^`]*`/g, "");
  // Remove images
  cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/g, "");
  // Remove links but keep the text
  cleanText = cleanText.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  // Remove headings markers
  cleanText = cleanText.replace(/^#+\s+/gm, "");
  // Remove bold/italic markers
  cleanText = cleanText.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleanText = cleanText.replace(/(\*|_)(.*?)\1/g, "$2");
  // Remove HTML tags
  cleanText = cleanText.replace(/<[^>]*>/g, "");

  // Count words (split by whitespace and filter empty strings)
  const words = cleanText.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Calculate reading time (average 200 words per minute)
  const WORDS_PER_MINUTE = 200;
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);

  // Minimum 1 minute
  return Math.max(1, minutes);
}

