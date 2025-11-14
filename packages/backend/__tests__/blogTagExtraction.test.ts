import { describe, it, expect } from "vitest";
import { createTestEnvironment } from "./convexTestUtils";
import { internal } from "../convex/_generated/api";

/**
 * Test for AI-powered blog tag extraction fallback behavior
 *
 * Note: These tests verify that the action handles failures gracefully
 * by returning default tags when OpenAI is unavailable or fails.
 * Full integration tests with real OpenAI API should be done manually.
 */

describe("Blog Tag Extraction - Fallback Behavior", () => {
  it("should return default tag array when OpenAI API key is missing", async () => {
    const t = createTestEnvironment();

    // No API key set, so it should fall back to default
    const result = await t.action(internal.blogActions.extractTagsFromContent, {
      title: "Test Article",
      content: "Some test content here about technology and software development.",
    });

    // Should return default tag on failure
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["AI"]); // Falls back to default
  });

  it("should return array with at least one tag", async () => {
    const t = createTestEnvironment();

    const result = await t.action(internal.blogActions.extractTagsFromContent, {
      title: "Empty Article",
      content: "",
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0); // Should return at least default tag
  });

  it("should handle long content without errors", async () => {
    const t = createTestEnvironment();

    // Generate long content (>2000 chars)
    const longContent = Array(500).fill("word").join(" ") + `

# Long Article

This is a very long article with lots of content that exceeds the typical limit.
We want to ensure the system handles this gracefully without errors.
    `;

    const result = await t.action(internal.blogActions.extractTagsFromContent, {
      title: "Very Long Article About Technology",
      content: longContent,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
