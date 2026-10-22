import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { HiddenJudgeService } from '../hidden-judge.js';

// Mock judge-prompt module
vi.mock('../../utils/judge-prompt.js', () => ({
  detectPlanningLoop: vi.fn(),
  detectActionLoop: vi.fn(),
  detectPermissionSeeking: vi.fn(),
  detectStoppedWithTodos: vi.fn(),
  detectFalseComplete: vi.fn(),
  runHeuristicDetectors: vi.fn(),
  buildJudgeSystemPrompt: vi.fn(() => 'Judge system prompt'),
  parseJudgeResponse: vi.fn(),
}));

import { runHeuristicDetectors, parseJudgeResponse } from '../../utils/judge-prompt.js';

describe('HiddenJudgeService', () => {
  let mockClient: any;
  let defaultConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      session: {
        create: vi.fn().mockResolvedValue({ id: 'judge-session-1' }),
        generate: vi.fn().mockResolvedValue({
          text: '{"verdict": "complete", "reason": "All good"}',
        }),
        synthetic: vi.fn().mockResolvedValue(undefined),
      },
    };
    defaultConfig = { enabled: true, maxRetries: 3, minToolCalls: 5, writeRatioThreshold: 0.1 };
  });

  describe('evaluateAndFeedback', () => {
    it('should skip when disabled', async () => {
      const service = new HiddenJudgeService({ enabled: false });
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.5, lastMessage: 'Done' },
      });
      expect(runHeuristicDetectors).not.toHaveBeenCalled();
    });

    it('should skip when client is null', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: null as any,
        taskContext: { toolCalls: 10, writeRatio: 0.5, lastMessage: 'Done' },
      });
      expect(runHeuristicDetectors).not.toHaveBeenCalled();
    });

    it('should skip when tool calls below minToolCalls threshold', async () => {
      const service = new HiddenJudgeService({ enabled: true, minToolCalls: 5 });
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 3, writeRatio: 0.5, lastMessage: 'Done' },
      });
      expect(runHeuristicDetectors).not.toHaveBeenCalled();
    });

    it('should inject feedback when heuristic detects premature stop', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'premature',
        reason: 'PLANNING_LOOP: Many tool calls with low write ratio',
      });

      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 20, writeRatio: 0.05, lastMessage: 'Let me know what to do next' },
      });

      // Should inject feedback via session.synthetic (V2)
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(1);
      const callArg = mockClient.session.synthetic.mock.calls[0][0];
      expect(callArg.sessionID).toBe('session-1');
      expect(callArg.text).toContain('PLANNING_LOOP');
    });

    it('should not inject feedback when heuristic says normal and LLM agrees', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'normal',
        reason: null,
      });

      // mock LLM returns 'complete' — no feedback needed
      mockClient.session.create.mockResolvedValue({ id: 'judge-session-test' });
      mockClient.session.generate.mockResolvedValue({
        text: '{"verdict": "complete", "reason": "All good"}',
      });

      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Task complete, tests pass' },
      });

      // LLM judge ran in its own hidden session; feedback must NOT be injected
      // into the main session (synthetic was only called with judge-* ids, if at all)
      const mainSessionCalls = (mockClient.session.synthetic as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: any[]) => call[0]?.sessionID === 'session-1');
      expect(mainSessionCalls).toHaveLength(0);
    });

    it('should respect maxRetries limit', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'premature',
        reason: 'STOPPED-WITH-TODOS',
      });

      // First call — should inject
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Remaining tasks... let me know' },
      });
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(1);

      // Second call — same session, should still inject (retry 2)
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Remaining tasks...' },
      });
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(2);

      // Third call — retry count hits maxRetries=3
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'More remaining tasks...' },
      });
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(3);

      // Fourth call — should be blocked by maxRetries
      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Still more...' },
      });
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(3); // No more calls
    });

    it('should handle missing session.create gracefully', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      const clientWithoutCreate = {
        session: {
          synthetic: vi.fn(),
          // no create method
        },
      };
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'suspicious',
        reason: 'Possible permission-seeking',
      });

      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: clientWithoutCreate,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Should I continue?' },
      });

      // Should not crash — no feedback injected since LLM judge unavailable
      expect(clientWithoutCreate.session.synthetic).not.toHaveBeenCalled();
    });

    it('should not crash when client throws in evaluate', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('heuristic error');
      });

      await expect(
        service.evaluateAndFeedback({
          sessionId: 'session-1',
          client: mockClient,
          taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Done' },
        }),
      ).resolves.toBeUndefined();
    });

    it('should call LLM judge for suspicious heuristics', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'suspicious',
        reason: 'Possible permission-seeking',
      });
      parseJudgeResponse.mockReturnValue({
        verdict: 'incomplete',
        reason: 'LLM confirmed permission seeking',
      });

      mockClient.session.create.mockResolvedValue({ id: 'judge-session-test' });
      mockClient.session.generate.mockResolvedValue({
        text: '{"verdict": "incomplete", "reason": "LLM confirmed"}',
      });

      await service.evaluateAndFeedback({
        sessionId: 'session-1',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'Should I continue?' },
      });

      // Should create hidden session
      expect(mockClient.session.create).toHaveBeenCalled();
      // Should inject feedback with LLM verdict into the main session
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(1);
      const feedback = mockClient.session.synthetic.mock.calls[0][0];
      expect(feedback.sessionID).toBe('session-1');
      expect(feedback.text).toContain('LLM confirmed');
    });
  });

  describe('clearRetryCount', () => {
    it('should clear retry count for a session', async () => {
      const service = new HiddenJudgeService(defaultConfig);
      (runHeuristicDetectors as ReturnType<typeof vi.fn>).mockReturnValue({
        verdict: 'premature',
        reason: 'TEST',
      });

      // Run until max retries
      for (let i = 0; i < 4; i++) {
        await service.evaluateAndFeedback({
          sessionId: 'session-clear',
          client: mockClient,
          taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'test' },
        });
      }
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(3); // Blocked on 4th

      service.clearRetryCount('session-clear');

      // Should be able to evaluate again
      await service.evaluateAndFeedback({
        sessionId: 'session-clear',
        client: mockClient,
        taskContext: { toolCalls: 10, writeRatio: 0.3, lastMessage: 'test' },
      });
      expect(mockClient.session.synthetic).toHaveBeenCalledTimes(4);
    });
  });
});
