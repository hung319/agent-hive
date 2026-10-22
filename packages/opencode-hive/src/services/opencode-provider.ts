/**
 * OpenCode Provider Service — piggyback on session.prompt for structured output.
 *
 * Pattern sourced from tickernelz/opencode-mem.
 * Instead of requiring separate API keys for auto-capture, uses the connected
 * OpenCode provider (the same one the user uses for chat). OpenCode owns auth,
 * token refresh, and provider routing — no extra API configuration needed.
 *
 * Key design:
 * - Uses `client.session.generate()` for transient LLM calls (no separate API keys);
 *   OpenCode V2 runs transient generation inside a session, so a sessionID is required.
 * - Simplified schema validation (not Zod — keeps bundle size small)
 * - 0-risk: every method catches errors and returns null
 * - Graceful degradation when client is unavailable
 */

export interface GenerateStructedParams {
  systemPrompt: string;
  userPrompt: string;
  /**
   * Session used for the transient generation request. OpenCode V2's
   * `session.generate` always runs inside a session; without a sessionID
   * the request is skipped (0-risk degradation).
   */
  sessionID?: string;
  /** Expected fields in the response (simplified schema: just field names for validation) */
  expectedFields?: string[];
}

/**
 * Service that uses the connected OpenCode provider for LLM calls.
 * No extra API keys needed — piggybacks on the user's existing provider.
 */
export class OpenCodeProviderService {
  /**
   * @param defaultSessionID Default session for transient generation calls
   *   (V2 `session.generate` runs inside a session). Individual calls can
   *   still provide a `sessionID` parameter that takes precedence.
   */
  constructor(private client: any, private defaultSessionID?: string) {}

  /**
   * Ask the LLM to extract structured information via session.generate.
   * Uses the connected OpenCode provider — no separate API configuration.
   * OpenCode V2's `session.generate` runs inside a session, so a sessionID
   * is required; without one the request is skipped (0-risk).
   *
   * @returns Parsed JSON object, or null on any failure (0-risk)
   */
  async generateStructured<T extends Record<string, unknown> = Record<string, unknown>>(
    params: GenerateStructedParams,
  ): Promise<T | null> {
    let sessionID = params.sessionID;
    // 0-risk guard: fall back to the provider's default session, then skip
    if (!sessionID) sessionID = this.defaultSessionID;
    if (!sessionID || !this.client?.session?.generate) return null;

    try {
      const response = await this.client.session.generate({
        sessionID,
        prompt: `${params.systemPrompt}\n\n${params.userPrompt}`,
      });

      const text = response?.text;
      if (!text) return null;

      // Try to parse JSON from response
      const parsed = this.parseJSON(text);
      if (!parsed) return null;

      // Validate expected fields if specified
      if (params.expectedFields && params.expectedFields.length > 0) {
        const hasAllFields = params.expectedFields.every(field => field in parsed);
        if (!hasAllFields) return null;
      }

      return parsed as T;
    } catch (error) {
      // 0-risk: never throw
      console.warn(
        '[opencode-provider] generateStructured failed:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Check if the provider is available.
   * Makes a lightweight LLM call to verify connectivity.
   * 0-risk: returns false on any failure.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.generateStructured<{ status: string }>({
        systemPrompt: 'You are a health check service.',
        userPrompt: 'Respond with a JSON object: {"status": "ok"}',
        expectedFields: ['status'],
      });
      return result?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Capture and structure session content using the OpenCode provider.
   * Returns structured memory content suitable for vector memory storage.
   *
   * @param sessionContext - Raw session text to structure
   * @returns Structured memory content, or null on failure
   */
  async captureStructuredMemory(sessionContext: string, sessionID?: string): Promise<string | null> {
    const systemPrompt = [
      'You are a memory curator. Extract key information from the following session context.',
      'Respond with a JSON object containing:',
      '- "summary": A 1-2 sentence summary of the session',
      '- "key_decisions": Array of decisions made (strings)',
      '- "key_learnings": Array of insights learned (strings)',
      '- "active_tasks": Array of task names mentioned (strings)',
      '- "tags": Array of relevant topic tags (strings)',
    ].join('\n');

    const result = await this.generateStructured<{
      summary?: string;
      key_decisions?: string[];
      key_learnings?: string[];
      active_tasks?: string[];
      tags?: string[];
    }>({
      systemPrompt,
      userPrompt: `Session context:\n\n${sessionContext.slice(0, 4000)}`,
      sessionID,
      expectedFields: ['summary'],
    });

    if (!result?.summary) return null;

    // Format as structured text for vector memory storage
    const parts: string[] = [result.summary];
    if (result.key_decisions?.length) {
      parts.push('', 'Decisions:', ...result.key_decisions.map(d => `  - ${d}`));
    }
    if (result.key_learnings?.length) {
      parts.push('', 'Learnings:', ...result.key_learnings.map(l => `  - ${l}`));
    }
    if (result.active_tasks?.length) {
      parts.push('', 'Tasks:', ...result.active_tasks.map(t => `  - ${t}`));
    }
    if (result.tags?.length) {
      parts.push('', `Tags: ${result.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Extract JSON from response text, handling markdown code blocks.
   */
  private parseJSON(text: string): Record<string, unknown> | null {
    // Try direct JSON parse first
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON — try extracting from markdown
    }

    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*\n?(\{[\s\S]*?\})\n?\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }

    // Try finding any JSON object in the text
    const looseMatch = text.match(/\{[\s\S]*?"\w+"[\s\S]*?\}/);
    if (looseMatch) {
      try {
        const parsed = JSON.parse(looseMatch[0]);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }

    return null;
  }
}
