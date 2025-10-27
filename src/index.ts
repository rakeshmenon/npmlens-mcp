/**
 * NPMLens MCP stdio server. Exposes tools for npm search, README retrieval,
 * enriched package info (downloads + GitHub), downloads, and usage snippets.
 * This is the executable entry point used by MCP clients.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";
import { resourceList, resourceTemplates, handleResourceRead } from "./resources.js";
import { prompts, getPrompt } from "./prompts.js";

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

const server = new Server(
  { name: "NPMLens", version: packageJson.version },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Register handler for listing all available tools
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Register handler for calling individual tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${toolName}`,
        },
      ],
      isError: true,
    };
  }

  return await tool.handler(request.params.arguments ?? {});
});

// Register handler for listing resources
server.setRequestHandler(ListResourcesRequestSchema, () => {
  return { resources: resourceList };
});

// Register handler for reading resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return await handleResourceRead(request.params.uri);
});

// Register handler for listing prompts
server.setRequestHandler(ListPromptsRequestSchema, () => {
  return { prompts };
});

// Register handler for getting a specific prompt
server.setRequestHandler(GetPromptRequestSchema, (request) => {
  return getPrompt(request.params.name);
});

// Register handler for listing resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, () => {
  return { resourceTemplates };
});

/** Start the MCP server over stdio. */
async function main() {
  // Start the MCP server over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
