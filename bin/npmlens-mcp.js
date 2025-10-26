#!/usr/bin/env node

/**
 * Wrapper script for npmlens-mcp that ensures clean stdio for MCP communication.
 * This script directly runs the built index.js to avoid package manager output.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Get the directory of this script
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import and run the main server
const indexPath = join(__dirname, "../dist/index.js");
await import(indexPath);
