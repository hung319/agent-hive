/**
 * Gitingest - Fetch GitHub repository content for AI analysis.
 *
 * Makes a direct POST to gitingest.com API to extract:
 * - Repository summary
 * - Directory tree
 * - File contents
 *
 * Returns structured text optimized for LLM consumption.
 *
 * @see https://github.com/cyclotruc/gitingest
 * @see https://github.com/smartfrog/opencode-froggy (native tool pattern)
 */

export interface GitingestArgs {
  url: string;
  maxFileSize?: number;
  pattern?: string;
  patternType?: 'include' | 'exclude';
}

export interface GitingestResult {
  summary: string;
  tree: string;
  content: string;
}

/**
 * Fetch repository content via gitingest.com API
 */
export async function fetchGitingest(args: GitingestArgs): Promise<string> {
  const response = await fetch('https://gitingest.com/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_text: args.url,
      max_file_size: args.maxFileSize ?? 50000,
      pattern: args.pattern ?? '',
      pattern_type: args.patternType ?? 'exclude',
    }),
  });

  if (!response.ok) {
    throw new Error(`Gitingest API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GitingestResult;
  return `${data.summary}\n\n${data.tree}\n\n${data.content}`;
}
