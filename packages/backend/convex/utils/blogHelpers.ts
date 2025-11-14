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

