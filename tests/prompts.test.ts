import { describe, it, expect } from "vitest";
import { prompts } from "../src/prompts.js";
import * as promptsModule from "../src/prompts.js";

describe("prompts", () => {
  describe("prompts list", () => {
    it("contains all expected prompts", () => {
      expect(prompts).toHaveLength(4);
      expect(prompts.map(p => p.name)).toEqual([
        "search-packages",
        "analyze-package",
        "compare-alternatives",
        "check-dependencies",
      ]);
    });

    it("all prompts have required properties", () => {
      prompts.forEach(prompt => {
        expect(prompt.name).toBeDefined();
        expect(prompt.description).toBeDefined();
        expect(prompt.arguments).toBeDefined();
        expect(Array.isArray(prompt.arguments)).toBe(true);
      });
    });

    it("all prompt arguments have required properties", () => {
      prompts.forEach(prompt => {
        prompt.arguments.forEach(arg => {
          expect(arg.name).toBeDefined();
          expect(arg.description).toBeDefined();
          expect(typeof arg.required).toBe("boolean");
        });
      });
    });
  });

  describe("getPrompt", () => {
    it("returns search-packages prompt", () => {
      const result = promptsModule.getPrompt("search-packages");
      expect(result.description).toBe("Search for npm packages with examples");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("{query}");
    });

    it("returns analyze-package prompt", () => {
      const result = promptsModule.getPrompt("analyze-package");
      expect(result.description).toContain("detailed information");
      expect(result.messages[0].content.text).toContain("{packageName}");
      expect(result.messages[0].content.text).toContain("README");
      expect(result.messages[0].content.text).toContain("GitHub stars");
    });

    it("returns compare-alternatives prompt", () => {
      const result = promptsModule.getPrompt("compare-alternatives");
      expect(result.description).toContain("Compare");
      expect(result.messages[0].content.text).toContain("{packages}");
      expect(result.messages[0].content.text).toContain("download counts");
      expect(result.messages[0].content.text).toContain("licenses");
    });

    it("returns check-dependencies prompt", () => {
      const result = promptsModule.getPrompt("check-dependencies");
      expect(result.description).toContain("dependencies");
      expect(result.messages[0].content.text).toContain("{packageName}");
      expect(result.messages[0].content.text).toContain("version requirements");
    });

    it("throws error for unknown prompt", () => {
      expect(() => promptsModule.getPrompt("unknown-prompt")).toThrow("Prompt not found: unknown-prompt");
    });

    it("returns prompt with correct message structure", () => {
      const result = promptsModule.getPrompt("search-packages");
      expect(result.messages[0]).toHaveProperty("role", "user");
      expect(result.messages[0]).toHaveProperty("content");
      expect(result.messages[0].content).toHaveProperty("type", "text");
      expect(result.messages[0].content).toHaveProperty("text");
      expect(typeof result.messages[0].content.text).toBe("string");
    });
  });
});
