/**
 * Shared V2 plugin test harness.
 *
 * OpenCode V2 plugins receive a plugin `ctx` (domains: location, agent, tool,
 * session, shell, event, mcp, command, ...) and return a cleanup function from
 * `setup`. This helper builds a mock ctx that records everything the plugin
 * registers, mirroring the shape used in hook-cadence.test.ts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ToolContext } from '../compat/v2-tool.js';

export interface CapturedSessionHook {
  name: string;
  handler: (event: unknown) => unknown | Promise<unknown>;
}

export interface V2Harness {
  projectDir: string;
  /** Isolated $HOME seeded for this run (ConfigService config location). */
  homeDir: string;
  /** Restore the original $HOME after the run. */
  restoreHome: () => void;
  addedTools: Map<string, { name: string; execute: (args: unknown, ctx: unknown) => Promise<unknown> }>;
  sessionHooks: Map<string, Array<CapturedSessionHook['handler']>>;
  mcpSet: Map<string, unknown>;
  cleanupFns: Array<() => void>;
  /** Agent ids passed to `agentEditor.default(...)`. */
  agentDefaults: string[];
  /** Agent ids mutated via `agentEditor.update(id, fn)` with the mutator. */
  agentUpdates: Array<[string, (agent: Record<string, unknown>) => void]>;
}

/** Dispose any plugin-registered cleanup listeners. */
export function disposeHarness(harness: V2Harness): void {
  harness.restoreHome();
  for (const dispose of harness.cleanupFns) {
    try {
      dispose();
    } catch {
      /* 0-risk */
    }
  }
  harness.cleanupFns.length = 0;
}

export async function runV2PluginSetup(options?: {
  directory?: string;
  config?: Record<string, unknown>;
}): Promise<V2Harness> {
  const { default: plugin } = await import('../index.js');

  const projectDir = options?.directory ?? fs.mkdtempSync(path.join(os.tmpdir(), 'hive-v2-'));

  // ConfigService reads user config from $HOME/.config/opencode/agent_hive.json.
  // With an explicit `config` option the harness isolates HOME in a temp dir and
  // seeds the config there. Otherwise it keeps the ambient HOME untouched so
  // callers can place agent_hive.json themselves (V1 harness behaviour).
  const isolateHome = options?.config !== undefined;
  const previousHome = process.env.HOME;
  const homeDir = isolateHome
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'hive-v2-home-'))
    : (previousHome ?? '');
  if (isolateHome) process.env.HOME = homeDir;

  const harness: V2Harness = {
    projectDir,
    homeDir,
    restoreHome: () => {
      if (!isolateHome) return;
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
    },
    addedTools: new Map(),
    sessionHooks: new Map(),
    mcpSet: new Map(),
    cleanupFns: [],
    agentDefaults: [],
    agentUpdates: [],
  };

  if (options?.config) {
    const configDir = path.join(homeDir, '.config', 'opencode');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'agent_hive.json'), JSON.stringify(options.config, null, 2));
  }

  const ctx = {
    location: { directory: projectDir },
    app: {},
    permission: {} as unknown,
    agent: {
      transform: async (update: (editor: unknown) => void) => {
        update({
          list: () => [],
          get: (_id: string) => ({ mode: 'primary', hidden: false }),
          default: (id: string) => harness.agentDefaults.push(id),
          update: (id: string, fn: (agent: Record<string, unknown>) => void) =>
            harness.agentUpdates.push([id, fn]),
          remove: () => {},
        });
      },
      reload: async () => {},
    },
    tool: {
      transform: async (update: (editor: unknown) => void) => {
        update({
          add: (toolDef: { name: string; execute: (args: unknown, ctx: unknown) => Promise<unknown> }) =>
            harness.addedTools.set(toolDef.name, toolDef),
          get: () => undefined,
          list: () => [],
          namespace: () => {},
        });
      },
      hook: async () => {},
    },
    session: {
      hook: async (name: string, handler: CapturedSessionHook['handler']) => {
        const list = harness.sessionHooks.get(name) ?? [];
        list.push(handler);
        harness.sessionHooks.set(name, list);
      },
      context: async () => [],
      synthetic: async () => {},
      generate: async () => ({ text: '' }),
    },
    shell: { hook: async () => {} },
    event: {
      // Empty event stream keeps the judge idle subscription loop at 0 events.
      subscribe: async (_input?: unknown) => [] as unknown[],
    },
    mcp: {
      transform: async (update: (editor: unknown) => void) => {
        update({
          get: (name: string) => harness.mcpSet.get(name),
          set: (name: string, config: unknown) => harness.mcpSet.set(name, config),
          list: () => [...harness.mcpSet.keys()],
        });
      },
    },
    command: {
      transform: async (update: (editor: unknown) => void) => {
        update({ add: () => {}, list: () => [], get: () => undefined });
      },
    },
  };

  const cleanup = await (plugin as unknown as { setup: (ctx: unknown) => Promise<unknown> }).setup(ctx as never);
  harness.cleanupFns.push(...unwrapCleanups(cleanup));

  return harness;
}

function unwrapCleanups(cleanup: unknown): Array<() => void> {
  if (typeof cleanup === 'function') return [cleanup as () => void];
  if (cleanup && typeof (cleanup as { dispose?: () => void }).dispose === 'function') {
    const dispose = (cleanup as { dispose: () => void }).dispose.bind(cleanup);
    return [dispose];
  }
  if (cleanup && typeof (cleanup as { [Symbol.asyncDispose]?: () => Promise<void> })[Symbol.asyncDispose] === 'function') {
    const dispose = (cleanup as { [Symbol.asyncDispose]: () => Promise<unknown> })[Symbol.asyncDispose].bind(cleanup);
    return [() => {
      void dispose();
    }];
  }
  return [];
}

/**
 * Build the legacy V1 `config.agent` record from the generated V2 agent
 * definitions: each `.opencode/agents/<id>.md` body becomes `prompt`.
 */
export function agentPromptProxy(
  harness: Pick<V2Harness, 'projectDir'>,
): Record<string, { prompt: string }> {
  const dir = path.join(harness.projectDir, '.opencode', 'agents');
  const out: Record<string, { prompt: string }> = {};
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    const id = entry.replace(/\.md$/, '');
    const body = fs.readFileSync(path.join(dir, entry), 'utf-8').split('---').slice(2).join('---');
    out[id] = { prompt: body };
  }
  return out;
}

/** V2 tool-call context handed to registered tool definitions' execute(). */
export function createV2ToolContext(sessionID: string): {
  sessionID: string;
  messageID: string;
  id: string;
  agent: string;
  signal: AbortSignal;
  progress: (update: Record<string, unknown>) => Promise<void>;
} {
  return {
    sessionID,
    messageID: 'msg_test',
    id: 'call_test',
    agent: 'test',
    signal: new AbortController().signal,
    progress: async () => {},
  };
}

/**
 * Execute a registered tool and unwrap the normalized V2 `{ content }`
 * result back into the legacy V1 string/structured shape tests assert on.
 */
export async function execTool(
  harness: V2Harness,
  name: string,
  args: unknown,
  toolContext?: unknown,
): Promise<unknown> {
  const def = harness.addedTools.get(name);
  if (!def) throw new Error(`tool not registered: ${name}`);
  const result = await def.execute(args, toolContext ?? createV2ToolContext((args as { sessionID?: string }).sessionID ?? 'sess_test'));
  const wrapped = result as { content?: unknown } | null | undefined;
  return wrapped && typeof wrapped === 'object' && 'content' in wrapped ? wrapped.content : result;
}
