/**
 * Prompt definitions and handlers for NPMLens MCP server.
 * Prompts provide example interactions to help users understand tool usage.
 */

export type PromptArgument = {
  name: string;
  description: string;
  required: boolean;
};

export type PromptDefinition = {
  name: string;
  description: string;
  arguments: PromptArgument[];
};

export const prompts: PromptDefinition[] = [
  {
    name: "search-packages",
    description: "Search for npm packages with examples",
    arguments: [
      {
        name: "query",
        description: "What to search for (e.g., 'react hooks', 'typescript testing')",
        required: true,
      },
    ],
  },
  {
    name: "analyze-package",
    description: "Get detailed information about a package including README, downloads, and GitHub stats",
    arguments: [
      {
        name: "packageName",
        description: "Name of the npm package (e.g., 'react', 'express')",
        required: true,
      },
    ],
  },
  {
    name: "compare-alternatives",
    description: "Compare multiple packages side-by-side",
    arguments: [
      {
        name: "packages",
        description: "Comma-separated package names (e.g., 'react-query,swr,apollo-client')",
        required: true,
      },
    ],
  },
  {
    name: "check-dependencies",
    description: "View a package's dependencies and their versions",
    arguments: [
      {
        name: "packageName",
        description: "Name of the package to analyze",
        required: true,
      },
    ],
  },
];

export type PromptMessage = {
  role: "user";
  content: {
    type: "text";
    text: string;
  };
};

export type PromptResponse = {
  description: string;
  messages: PromptMessage[];
};

const promptExamples: Record<string, string> = {
  "search-packages": "Search npm for '{query}' and show me the top results with their download counts and descriptions.",
  "analyze-package": "Give me detailed information about the '{packageName}' npm package including its README, weekly downloads, GitHub stars, and a usage example.",
  "compare-alternatives": "Compare these npm packages: {packages}. Show me their download counts, GitHub stars, licenses, and help me decide which one to use.",
  "check-dependencies": "Show me all dependencies for '{packageName}' and their version requirements.",
};

export function getPrompt(name: string): PromptResponse {
  const prompt = prompts.find(p => p.name === name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  // All prompts should have examples; this is a sanity check
  /* c8 ignore next */
  const exampleText = promptExamples[name] ?? `Use the ${name} prompt`;

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: exampleText,
        },
      },
    ],
  };
}
