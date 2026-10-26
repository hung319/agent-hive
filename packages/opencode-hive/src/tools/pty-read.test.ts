/**
 * pty_read buffer semantics.
 *
 * The tools wrap a real process, so these tests drive the exported tool
 * definition with a fake session table rather than spawning one: what matters
 * is when the buffer is drained and what the reader is told, not the PTY.
 */
import { describe, it, expect } from 'bun:test';
import { readPty, ptySessions, type PtySession } from './pty.js';

function fakeSession(overrides: Partial<PtySession> = {}): PtySession {
  return {
    proc: {} as never,
    command: 'echo hi',
    startedAt: new Date('2026-10-26T00:00:00.000Z'),
    buffer: '',
    exited: false,
    ...overrides,
  };
}

describe('pty_read', () => {
  it('says to read again when a running process has not written yet', async () => {
    ptySessions.set('t1', fakeSession({ buffer: '', exited: false }));

    const out = await readPty({ id: 't1', clear: true });

    expect(out).toContain('(no output yet)');
    expect(out).toContain('call pty_read again');
    // A one-shot read must not claim the buffer was cleared when it was empty.
    expect(out).not.toContain('(buffer cleared)');
    ptySessions.delete('t1');
  });

  it('returns output and drains only when there was output', async () => {
    ptySessions.set('t2', fakeSession({ buffer: 'hello\n', exited: true }));

    const first = await readPty({ id: 't2', clear: true });
    expect(first).toContain('hello');
    expect(first).toContain('(buffer cleared)');

    const second = await readPty({ id: 't2', clear: true });
    expect(second).toContain('(no output yet)');
    expect(second).not.toContain('hello');
    ptySessions.delete('t2');
  });

  it('keeps the buffer when clear is not passed', async () => {
    ptySessions.set('t3', fakeSession({ buffer: 'keep me\n', exited: true }));

    await readPty({ id: 't3' });
    const again = await readPty({ id: 't3' });

    expect(again).toContain('keep me');
    expect(again).toContain('pass clear: true');
    ptySessions.delete('t3');
  });

  it('reports an exited session as exited, not running', async () => {
    ptySessions.set('t4', fakeSession({ exited: true, buffer: 'done\n' }));

    const out = await readPty({ id: 't4' });

    expect(out).toContain('Status: exited');
    expect(out).not.toContain('call pty_read again');
    ptySessions.delete('t4');
  });
});
