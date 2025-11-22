import { describe, test, expect } from "vitest";
import { constructContextPrompt } from "../../convex/memory/util";

describe("constructContextPrompt", () => {
    test("handles both existing people and tags", () => {
        const prompt = constructContextPrompt(["Alice", "Bob"], ["fun", "work"]);
        expect(prompt).toContain("Existing People: Alice, Bob");
        expect(prompt).toContain("Existing Tags: fun, work");
        expect(prompt).toContain(
            "When extracting people and tags, prefer using the exact names and tags from the lists above if they match the context; otherwise, create new ones."
        );
    });

    test("handles only existing people", () => {
        const prompt = constructContextPrompt(["Alice"], []);
        expect(prompt).toContain("Existing People: Alice");
        expect(prompt).toContain("No existing tags.");
        expect(prompt).toContain(
            "When extracting people, prefer using the exact names from the list above if they match the context; otherwise, create new names."
        );
    });

    test("handles only existing tags", () => {
        const prompt = constructContextPrompt([], ["fun"]);
        expect(prompt).toContain("No existing people.");
        expect(prompt).toContain("Existing Tags: fun");
        expect(prompt).toContain(
            "When extracting tags, prefer using the exact tags from the list above if they match the context; otherwise, create new tags."
        );
    });

    test("handles no existing people or tags", () => {
        const prompt = constructContextPrompt([], []);
        expect(prompt).toContain("No existing people.");
        expect(prompt).toContain("No existing tags.");
        expect(prompt).toContain("Create new names and tags as needed.");
    });
});
