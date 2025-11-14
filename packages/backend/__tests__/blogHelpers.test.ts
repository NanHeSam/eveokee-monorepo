import { describe, it, expect } from "vitest";
import {
  calculateReadingTime,
  generateSlug,
  normalizeTagsField,
} from "../convex/utils/blogHelpers";

describe("blogHelpers", () => {
  describe("calculateReadingTime", () => {
    it("should calculate reading time for short content", () => {
      const markdown = "This is a short test with exactly ten words total.";
      const result = calculateReadingTime(markdown);
      expect(result).toBe(1); // Minimum 1 minute
    });

    it("should calculate reading time for longer content", () => {
      // Generate ~400 words (should be 2 minutes at 200 words/min)
      const words = Array(400).fill("word").join(" ");
      const result = calculateReadingTime(words);
      expect(result).toBe(2);
    });

    it("should remove markdown formatting when calculating", () => {
      const markdown = `
# Heading

This is **bold** and *italic* text with \`code\` inline.

\`\`\`javascript
const x = 1;
\`\`\`

[Link text](https://example.com)

![Image alt](https://example.com/image.png)
      `;
      const result = calculateReadingTime(markdown);
      // Should only count the actual words: "Heading", "This", "is", "bold", "and", "italic", "text", "with", "code", "inline", "Link", "text"
      expect(result).toBe(1); // 12 words = 1 minute minimum
    });

    it("should handle empty content", () => {
      expect(calculateReadingTime("")).toBe(1);
      expect(calculateReadingTime("   ")).toBe(1);
    });

    it("should handle content with HTML tags", () => {
      const markdown = "<p>This is <strong>HTML</strong> content with <a href='#'>links</a></p>";
      const result = calculateReadingTime(markdown);
      expect(result).toBe(1); // 6 words = 1 minute minimum
    });

    it("should calculate correct time for 200 words", () => {
      const words = Array(200).fill("word").join(" ");
      const result = calculateReadingTime(words);
      expect(result).toBe(1); // Exactly 200 words = 1 minute
    });

    it("should calculate correct time for 201 words", () => {
      const words = Array(201).fill("word").join(" ");
      const result = calculateReadingTime(words);
      expect(result).toBe(2); // 201 words rounds up to 2 minutes
    });

    it("should handle RankPill test article", () => {
      const markdown = `## This is a test article

This is a test payload sent from RankPill to verify your webhook integration is working correctly.

When you publish real articles, you'll receive the actual article data including:

- Full HTML and Markdown content
- Featured images
- Meta descriptions
- Published URLs
- And more!`;
      const result = calculateReadingTime(markdown);
      expect(result).toBe(1); // ~35 words = 1 minute
    });
  });

  describe("generateSlug", () => {
    it("should generate slug from title", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
      expect(generateSlug("Test Article from RankPill")).toBe("test-article-from-rankpill");
    });

    it("should handle special characters", () => {
      expect(generateSlug("Café & Restaurant")).toBe("cafe-and-restaurant");
      expect(generateSlug("What's New?")).toBe("whats-new");
    });

    it("should handle empty input", () => {
      expect(generateSlug("")).toBe("");
    });
  });

  describe("normalizeTagsField", () => {
    it("should normalize tags from array in tags field", () => {
      const payload = { tags: ["AI", "Testing", "Webhooks"] };
      expect(normalizeTagsField(payload)).toEqual(["AI", "Testing", "Webhooks"]);
    });

    it("should normalize tags from array in tag field", () => {
      const payload = { tag: ["AI", "Testing"] };
      expect(normalizeTagsField(payload)).toEqual(["AI", "Testing"]);
    });

    it("should normalize tags from string in tags field", () => {
      const payload = { tags: "AI" };
      expect(normalizeTagsField(payload)).toEqual(["AI"]);
    });

    it("should normalize tags from string in tag field", () => {
      const payload = { tag: "Testing" };
      expect(normalizeTagsField(payload)).toEqual(["Testing"]);
    });

    it("should return empty array when no tags", () => {
      expect(normalizeTagsField({})).toEqual([]);
      expect(normalizeTagsField({ other: "field" })).toEqual([]);
    });

    it("should prioritize tags over tag field", () => {
      const payload = { tags: ["AI"], tag: ["Other"] };
      expect(normalizeTagsField(payload)).toEqual(["AI"]);
    });
  });
});
