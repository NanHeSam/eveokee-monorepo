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

