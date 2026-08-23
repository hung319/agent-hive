import { describe, it, expect } from 'bun:test';

import { getBuiltinMcps } from './index.js';
import type { CodegraphMcpResolution } from '../utils/codegraph-installer.js';

function resolution(command: string[], source: CodegraphMcpResolution['source']): CodegraphMcpResolution {
  return { command, source };
}

describe('getBuiltinMcps', () => {
  it('filters disabledMcps from the result', () => {
    const mcps = getBuiltinMcps(['websearch'], { resolveCodegraph: () => null });
    expect(mcps.websearch).toBeUndefined();
    expect(mcps.context7).toBeDefined();
    expect(mcps.grep_app).toBeDefined();
  });

  it('omits codegraph when the resolver returns null', () => {
    const mcps = getBuiltinMcps([], { resolveCodegraph: () => null });
    expect(mcps.codegraph).toBeUndefined();
    expect(mcps.context7).toBeDefined();
  });

  it('registers codegraph with the resolved command plus serve --mcp appended', () => {
    const mcps = getBuiltinMcps([], {
      resolveCodegraph: () => resolution(['/bin/execPath', '/shim/npm-shim.js'], 'npm'),
    });
    expect(mcps.codegraph).toMatchObject({
      type: 'local',
      command: ['/bin/execPath', '/shim/npm-shim.js', 'serve', '--mcp'],
    });
    const env = mcps.codegraph?.type === 'local' ? mcps.codegraph.environment : undefined;
    expect(env?.DO_NOT_TRACK).toBe('1');
    expect(env?.CODEGRAPH_NO_DOWNLOAD).toBeUndefined();
  });

  it('passes bundle and path source commands through verbatim', () => {
    const bundle = getBuiltinMcps([], {
      resolveCodegraph: () => resolution(['/managed/codegraph'], 'bundle'),
    });
    expect(bundle.codegraph?.command).toEqual(['/managed/codegraph', 'serve', '--mcp']);

    const viaPath = getBuiltinMcps([], {
      resolveCodegraph: () => resolution(['codegraph'], 'path'),
    });
    expect(viaPath.codegraph?.command).toEqual(['codegraph', 'serve', '--mcp']);
  });

  it('still omits codegraph when the user disabled it explicitly', () => {
    const mcps = getBuiltinMcps(['codegraph'], {
      resolveCodegraph: () => resolution(['codegraph'], 'path'),
    });
    expect(mcps.codegraph).toBeUndefined();
  });

  it('leaves remote MCPs unaffected by the codegraph resolver', () => {
    const mcps = getBuiltinMcps([], { resolveCodegraph: () => null });
    expect(mcps.websearch).toMatchObject({ type: 'remote' });
    expect(mcps.context7).toMatchObject({ type: 'remote' });
    expect(mcps.grep_app).toMatchObject({ type: 'remote' });
  });
});
