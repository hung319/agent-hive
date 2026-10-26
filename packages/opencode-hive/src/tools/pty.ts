import { tool, type ToolDefinition, type ToolContext } from '../compat/v2-tool.js';
import * as fs from 'fs';
import * as path from 'path';
import { getHiveNodeModulesPath } from '../utils/tool-installer.js';

/**
 * PTY (Pseudo-Terminal) tools
 * 
 * Requires: bun-pty package
 * 
 * These tools provide interactive PTY management for running background processes,
 * sending interactive input, and reading output on demand.
 * 
 * Use cases:
 * - Running dev servers (npm run dev, cargo watch)
 * - Watch modes (npm test -- --watch)
 * - Interactive programs (REPLs, prompts)
 * - Long-running processes
 * 
 * bun-pty is auto-installed when the plugin loads.
 * You can also install it manually: npm install -g bun-pty
 * 
 * Note: These tools provide a wrapper around the opencode-pty functionality.
 * For full PTY support, consider using the opencode-pty plugin directly.
 */

export interface PtyStartArgs {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface PtySendArgs {
  id: string;
  input: string;
}

export interface PtyReadArgs {
  id: string;
  clear?: boolean;
}

export interface PtyKillArgs {
  id: string;
}

export interface PtyListArgs {
  // No arguments needed
}

export interface PtySession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc?: any;
  command: string;
  startedAt: Date;
  /** Output seen so far. pty_read with clear drains it. */
  buffer: string;
  exited: boolean;
}

// Store for PTY sessions (in-memory, resets on restart)
export const ptySessions = new Map<string, PtySession>();

/**
 * Try to load bun-pty, checking auto-installed hive packages first.
 *
 * Returns the spawn function, normalised across the API shapes bun-pty has
 * shipped: 0.3 exported `open(options)`, and every version from 0.4 on exports
 * `spawn(file, args, options)`. Reading `.open` unconditionally made pty_start
 * fail with "open2 is not a function" on any current install, which reads to a
 * user as "this session has no shell".
 */
async function loadBunPty(): Promise<(file: string, args: string[], options: Record<string, unknown>) => any> {
  // Check hive auto-installed packages first
  const hiveModules = getHiveNodeModulesPath();
  const hivePkgPath = path.join(hiveModules, 'bun-pty');

  let mod: any;
  if (fs.existsSync(hivePkgPath)) {
    mod = await import(hivePkgPath);
  } else {
    // Fall back to normal module resolution via eval
    // to bypass TypeScript static module resolution for non-declared deps
    // eslint-disable-next-line no-eval
    mod = await eval('import("bun-pty")');
  }

  return normaliseSpawn(mod);
}

/** Pick whichever spawn entry point this bun-pty build actually exports. */
export function normaliseSpawn(mod: any): (file: string, args: string[], options: Record<string, unknown>) => any {
  if (typeof mod?.spawn === 'function') return mod.spawn;
  if (typeof mod?.open === 'function') {
    const open = mod.open;
    return (_file: string, _args: string[], options: Record<string, unknown>) => open(options);
  }
  throw new Error(
    'bun-pty was loaded but exports neither spawn() nor open(); ' +
      'reinstall with: npm i -g bun-pty@latest',
  );
}

async function startPty(args: PtyStartArgs): Promise<string> {
  try {
    const spawn = await loadBunPty();

    // bun-pty takes the executable and its argv separately. Route through a
    // shell so a user's command string behaves like the one they typed.
    const isWindows = process.platform === 'win32';
    const pty = spawn(
      isWindows ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh',
      isWindows ? ['/d', '/s', '/c', args.command] : ['-c', args.command],
      {
        cwd: args.cwd,
        cols: 120,
        rows: 30,
        // bun-pty replaces the environment rather than extending it.
        env: args.env ? { ...process.env, ...args.env } : process.env,
      },
    );
    
    const id = `pty-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    ptySessions.set(id, {
      proc: pty,
      command: args.command,
      startedAt: new Date(),
      buffer: '',
      exited: false,
    });
    
    // Keep the output. Without this, pty_read could only report "running" and
    // the session that started a background process had no way to see it.
    pty.onData?.((data: string) => {
      const session = ptySessions.get(id);
      if (!session) return;
      session.buffer += data;
      // Bound a chatty process: keep the tail, which is what a reader wants.
      if (session.buffer.length > 200_000) {
        session.buffer = session.buffer.slice(-200_000);
      }
    });
    pty.onExit?.((event: { exitCode?: number }) => {
      const session = ptySessions.get(id);
      if (!session) return;
      session.exited = true;
      session.buffer += `\n[exit ${event?.exitCode ?? '?'}]\n`;
    });
    
    return `Started PTY session: ${id}
Command: ${args.command}
Working Directory: ${args.cwd ?? process.cwd()}

Use pty_read with id "${id}" to read output, pty_send to send input, and pty_kill to terminate.`;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("not found") || error.message.includes("MODULE_NOT_FOUND") || error.message.includes("Cannot find module") || error.message.includes("Cannot find package"))) {
      return `pty_start requires bun-pty to be installed:
      
The plugin attempted to auto-install bun-pty but it may have failed due to
native compilation requirements on this system.

Option 1 - Use opencode-pty plugin (recommended, no native deps):
Add "opencode-pty" to your plugins in opencode.json

Option 2 - Install bun-pty manually:
npm install -g bun-pty

The PTY tools provide interactive terminal sessions for:
- Running dev servers in background
- Interactive programs (REPLs)
- Long-running processes
- Watch modes

Note: bun-pty requires native compilation which can fail on some systems.
The opencode-pty plugin handles this more gracefully.`;
    }
    throw error;
  }
}

async function sendToPty(args: PtySendArgs): Promise<string> {
  const session = ptySessions.get(args.id);
  
  if (!session) {
    return `No PTY session found with id: ${args.id}. Use pty_list to see active sessions.`;
  }
  
  if (!session.proc) {
    return `PTY session ${args.id} is not running.`;
  }
  
  try {
    session.proc.write(args.input);
    return `Sent to ${args.id}: ${args.input}`;
  } catch (error) {
    return `Failed to send input: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function readPty(args: PtyReadArgs): Promise<string> {
  const session = ptySessions.get(args.id);
  
  if (!session) {
    return `No PTY session found with id: ${args.id}. Use pty_list to see active sessions.`;
  }
  
  const status = session.exited ? 'exited' : 'running';
  const output = session.buffer;
  // Drain only what was returned. Clearing a buffer that was empty discards
  // nothing, and clearing before the emptiness check would drop the first
  // bytes a slow process wrote between the copy and the reset.
  if (args.clear && output) {
    session.buffer = '';
  }

  const next =
    !args.clear
      ? '\n\n(pass clear: true to drain this buffer)'
      : output
        ? '\n\n(buffer cleared)'
        : '';
  // A one-shot read of a still-starting process is the common failure: the
  // caller sees "no output" and concludes the command produced nothing.
  const waiting =
    !output && !session.exited
      ? '\n\n(still running; call pty_read again to collect output)'
      : '';

  return `PTY Session: ${args.id}
Command: ${session.command}
Started: ${session.startedAt.toISOString()}
Status: ${status}
${output ? `\n${output}` : '\n(no output yet)'}${waiting}${next}`;
}

async function killPty(args: PtyKillArgs): Promise<string> {
  const session = ptySessions.get(args.id);
  
  if (!session) {
    return `No PTY session found with id: ${args.id}. Use pty_list to see active sessions.`;
  }
  
  try {
    if (session.proc) {
      session.proc.kill();
    }
    ptySessions.delete(args.id);
    return `Killed PTY session: ${args.id}`;
  } catch (error) {
    ptySessions.delete(args.id);
    return `Error killing PTY ${args.id}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function listPty(_args: PtyListArgs): Promise<string> {
  if (ptySessions.size === 0) {
    return "No active PTY sessions.";
  }
  
  let output = "Active PTY Sessions:\n\n";
  
  for (const [id, session] of ptySessions) {
    // A held proc is not proof of life. This listed "running" for processes
    // that had long since exited, which reads as a leaked session.
    const status = session.exited ? "exited" : "running";
    output += `ID: ${id}\n`;
    output += `Command: ${session.command}\n`;
    output += `Started: ${session.startedAt.toISOString()}\n`;
    output += `Status: ${status}\n`;
    output += "---\n";
  }
  
  return output;
}

export const ptyStartTool: ToolDefinition = tool("pty_start", {
  description: "Start a new PTY (pseudo-terminal) session for running interactive processes in background. Requires bun-pty or opencode-pty plugin.",
  args: {
    command: tool.schema.string().describe("Command to execute in the PTY"),
    cwd: tool.schema.string().optional().describe("Working directory for the command"),
    env: tool.schema.object({}).optional().describe("Environment variables for the command"),
  },
  async execute(args: PtyStartArgs, _context: ToolContext) {
    return startPty(args);
  },
});

export const ptySendTool: ToolDefinition = tool("pty_send", {
  description: "Send input to a running PTY session.",
  args: {
    id: tool.schema.string().describe("PTY session ID"),
    input: tool.schema.string().describe("Input to send to the PTY"),
  },
  async execute(args: PtySendArgs, _context: ToolContext) {
    return sendToPty(args);
  },
});

export const ptyReadTool: ToolDefinition = tool("pty_read", {
  description: "Read output from a PTY session.",
  args: {
    id: tool.schema.string().describe("PTY session ID"),
    clear: tool.schema.boolean().optional().describe("Clear the output buffer after reading"),
  },
  async execute(args: PtyReadArgs, _context: ToolContext) {
    return readPty(args);
  },
});

export const ptyKillTool: ToolDefinition = tool("pty_kill", {
  description: "Kill/terminate a PTY session.",
  args: {
    id: tool.schema.string().describe("PTY session ID to kill"),
  },
  async execute(args: PtyKillArgs, _context: ToolContext) {
    return killPty(args);
  },
});

export const ptyListTool: ToolDefinition = tool("pty_list", {
  description: "List all active PTY sessions.",
  args: {},
  async execute(_args: PtyListArgs, _context: ToolContext) {
    return listPty({});
  },
});
