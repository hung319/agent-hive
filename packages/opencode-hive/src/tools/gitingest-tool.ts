import { tool, type ToolDefinition } from '@opencode-ai/plugin';
import { fetchGitingest } from './gitingest.js';

/**
 * Gitingest tool - Fetch GitHub repository content for AI analysis.
 *
 * Uses gitingest.com API to extract repo summary, directory tree,
 * and file contents in a format optimized for LLM consumption.
 *
 * Pattern from opencode-froggy: native tool, no MCP server needed.
 *
 * @see https://github.com/smartfrog/opencode-froggy
 */
export const gitingestTool: ToolDefinition = tool({
  description: `Fetch a GitHub repository's full content via gitingest.com. Returns summary, directory tree, and file contents optimized for LLM analysis. Use when you need to understand an external repository's structure or code.

**Parameters:**
- url: GitHub repository URL (e.g., https://github.com/owner/repo)
- maxFileSize: Maximum file size in bytes to include (default: 50000)
- pattern: Glob pattern to filter files
- patternType: Whether pattern includes or excludes matching files (default: exclude)

**Returns:**
- Summary, directory tree, and file contents as structured text

**Example:**
\`\`\`
gitingest({ url: "https://github.com/facebook/react" })
gitingest({ url: "https://github.com/vercel/next.js", pattern: "*.ts", patternType: "include" })
\`\`\``,
  args: {
    url: tool.schema.string().describe('GitHub repository URL (e.g., https://github.com/owner/repo)'),
    maxFileSize: tool.schema.number().optional().describe('Maximum file size in bytes to include (default: 50000)'),
    pattern: tool.schema.string().optional().describe('Glob pattern to filter files'),
    patternType: tool.schema.enum(['include', 'exclude']).optional().describe('Whether pattern includes or excludes matching files (default: exclude)'),
  },
  async execute(args) {
    try {
      const result = await fetchGitingest(args);
      return result;
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      }, null, 2);
    }
  },
});
