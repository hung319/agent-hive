/**
 * V2 tool compat layer.
 *
 * OpenCode V2 replaced the plugin-level `tool` map with `ctx.tool.transform`
 * registrations: JSON Schema inputs, a `{ content, metadata }` result shape,
 * and a new tool context (no `metadata()` callback, `signal`, `progress`).
 *
 * This module keeps the V1 ergonomics used across `src/tools/*` — zod arg
 * shapes (`tool.schema.*`), a legacy ToolContext, and string-or-structured
 * results — while emitting native V2 tool definitions that OpenCode registers
 * through `ctx.tool.transform`.
 */
import { z } from 'zod';

export { z };
/** Compatibility for `tool.schema.*` — identical to the V1 namespace (zod). */
export const schema = z;

export type ToolContext = {
  sessionID: string;
  messageID: string;
  id: string;
  /**
   * Agent running the session/tool call.
   */
  agent: string;
  /**
   * Current project directory for this session.
   */
  directory: string;
  /**
   * Project worktree root for this session.
   */
  worktree: string;
  /**
   * Abort signal for the current call (V1 `abort`).
   */
  abort: AbortSignal;
  /**
   * Progress updates shown on the tool call (V1 `metadata` callback).
   */
  metadata(input: {
    title?: string;
    metadata?: Record<string, unknown>;
  }): void;
  /**
   * Request a permission decision before continuing (V1 `ask`).
   * mapped to `ctx.permission.assert` in V2.
   */
  ask(input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata?: Record<string, unknown>;
  }): Promise<void>;
};

export type ToolAttachment = {
  type: 'file';
  mime: string;
  url: string;
  filename?: string;
};

export type ToolResult =
  | string
  | {
      title?: string;
      output: string;
      metadata?: Record<string, unknown>;
      attachments?: ToolAttachment[];
    };

/** Minimal structural type — deliberately loose against V2's branded schemas. */
export type ToolDefinition = {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  options?: { permission?: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(input: any, context: any): Promise<any>;
};

/**
 * Runtime services captured during plugin `setup` and used by tool wrappers.
 */
interface CompatHost {
  directory: string;
  worktree?: string;
  permission?: {
    assert(input: {
      sessionID: string;
      agent: string;
      action: string;
      resources: string[];
      save?: string[];
      metadata?: Record<string, unknown>;
      source?: { type: 'tool'; messageID: string; id: string };
    }): Promise<unknown>;
  };
}

let host: CompatHost | null = null;

/** Called once from plugin setup with the live V2 plugin context. */
export function configureToolCompat(next: CompatHost | null): void {
  host = next;
}

function buildLegacyContext(v2Context: {
  sessionID: string;
  agent: string;
  messageID: string;
  id: string;
  signal: AbortSignal;
  progress: (update: Record<string, unknown>) => Promise<void>;
}): ToolContext {
  const directory = host?.directory ?? process.cwd();
  return {
    sessionID: v2Context.sessionID,
    messageID: v2Context.messageID,
    id: v2Context.id,
    agent: v2Context.agent,
    directory,
    worktree: host?.worktree ?? directory,
    abort: v2Context.signal,
    metadata: (update) => {
      void v2Context.progress(update as Record<string, unknown>).catch(() => { /* best-effort */ });
    },
    ask: async ({ permission, patterns, always, metadata }) => {
      if (!host?.permission) {
        throw new Error('Permission prompting is unavailable in this context.');
      }
      await host.permission.assert({
        sessionID: v2Context.sessionID,
        agent: v2Context.agent,
        source: { type: 'tool', messageID: v2Context.messageID, id: v2Context.id },
        action: permission,
        resources: patterns,
        save: always,
        metadata,
      });
    },
  };
}

function normalizeResult(result: unknown): {
  content: string | Array<{ type: 'text'; text: string } | { type: 'file'; uri: string; mime: string; name?: string }>;
  metadata?: Record<string, unknown>;
} {
  if (result === undefined || result === null) return { content: '' };
  if (typeof result === 'string') return { content: result };
  const structured = result as unknown as {
    output: string;
    metadata?: Record<string, unknown>;
    attachments?: ToolAttachment[];
  };
  const attachments = ((structured.attachments ?? []) as ToolAttachment[]).map((a) => ({
    type: 'file' as const,
    uri: a.url,
    mime: a.mime,
    name: a.filename,
  }));
  const content = attachments.length > 0
    ? [{ type: 'text' as const, text: structured.output }, ...attachments]
    : [{ type: 'text' as const, text: structured.output }];
  return { content, metadata: structured.metadata as Record<string, unknown> | undefined };
}

interface ToolFactory {
  <Args extends z.ZodRawShape>(
    name: string,
    input: {
      description: string;
      args: Args;
      options?: { permission?: string };
      execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult | void>;
    },
  ): ToolDefinition;
  /** V1 compatibility: `tool.schema.string()` etc. — plain zod. */
  schema: typeof z;
}

function createTool(
  name: string,
  input: {
    description: string;
    args: z.ZodRawShape;
    options?: { permission?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(args: any, context: ToolContext): Promise<ToolResult | void>;
  },
): ToolDefinition {
  const argsSchema = z.object(input.args);
  return {
    name,
    description: input.description,
    input: argsSchema,
    options: input.options,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(args: any, v2Context: any) {
      const context = buildLegacyContext(v2Context);
      return Promise.resolve(input.execute(args, context)).then((result) => normalizeResult(result));
    },
  };
}

/**
 * V1-compatible tool factory that returns a registerable V2 tool definition.
 *
 * Usage: `tool('look_at', { description, args, execute })` — `execute` keeps
 * the legacy V1 signature `(args, legacyContext)`, and `tool.schema.*` stays
 * available for arg building (identical to the V1 namespace).
 */
export const tool = Object.assign(createTool, { schema: z }) as ToolFactory;
