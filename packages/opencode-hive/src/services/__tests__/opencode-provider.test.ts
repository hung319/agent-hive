import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { OpenCodeProviderService } from '../opencode-provider.js';

/**
 * V2 note: the provider runs transient LLM calls through
 * `client.session.generate({ sessionID, prompt }) → { text }`, so every test
 * passes a `sessionID` and mocks `session.generate` instead of the V1
 * `session.prompt`.
 */
describe('OpenCodeProviderService', () => {
  let mockClient: any;
  const SESSION = 'session-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      session: {
        generate: vi.fn(),
      },
    };
  });

  describe('generateStructured', () => {
    it('should parse JSON response from session.generate', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: '{"summary": "test", "count": 42}',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured<{ summary: string; count: number }>({
        sessionID: 'session-1',
        systemPrompt: 'Be helpful',
        userPrompt: 'Extract data',
        expectedFields: ['summary', 'count'],
      });

      expect(result).not.toBeNull();
      expect(result?.summary).toBe('test');
      expect(result?.count).toBe(42);
    });

    it('should return null when no sessionID (V2 generate needs a session)', async () => {
      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured({
        systemPrompt: 'test',
        userPrompt: 'test',
      });
      expect(result).toBeNull();
      expect(mockClient.session.generate).not.toHaveBeenCalled();
    });

    it('should return null when client.session.generate is unavailable', async () => {
      const service = new OpenCodeProviderService({});
      const result = await service.generateStructured({
        sessionID: 'session-1',
        systemPrompt: 'test',
        userPrompt: 'test',
      });
      expect(result).toBeNull();
    });

    it('should return null on JSON parse failure', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: 'Not JSON at all',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured({
        sessionID: 'session-1',
        systemPrompt: 'test',
        userPrompt: 'test',
        expectedFields: ['summary'],
      });
      expect(result).toBeNull();
    });

    it('should return null when expected fields are missing', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: '{"summary": "hello"}',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured({
        sessionID: 'session-1',
        systemPrompt: 'test',
        userPrompt: 'test',
        expectedFields: ['summary', 'missingField'],
      });
      expect(result).toBeNull();
    });

    it('should handle session.generate rejection gracefully', async () => {
      mockClient.session.generate.mockRejectedValue(new Error('Provider not available'));

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured({
        sessionID: 'session-1',
        systemPrompt: 'test',
        userPrompt: 'test',
      });
      expect(result).toBeNull();
    });

    it('should extract JSON from markdown code block', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: 'Here is the result:\n```json\n{"key": "value", "number": 123}\n```',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.generateStructured<{ key: string; number: number }>({
        sessionID: 'session-1',
        systemPrompt: 'test',
        userPrompt: 'test',
        expectedFields: ['key', 'number'],
      });

      expect(result).not.toBeNull();
      expect(result?.key).toBe('value');
      expect(result?.number).toBe(123);
    });
  });

  describe('isAvailable', () => {
    it('should return true when provider responds with status ok', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: '{"status": "ok"}',
      });

      const service = new OpenCodeProviderService(mockClient, SESSION);
      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when provider responds with wrong status', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: '{"status": "error"}',
      });

      const service = new OpenCodeProviderService(mockClient, SESSION);
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when client unavailable', async () => {
      const service = new OpenCodeProviderService({});
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false on rejection', async () => {
      mockClient.session.generate.mockRejectedValue(new Error('down'));

      const service = new OpenCodeProviderService(mockClient, SESSION);
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('captureStructuredMemory', () => {
    it('should format structured memory from session context', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: JSON.stringify({
          summary: 'Worked on authentication',
          key_decisions: ['Use JWT'],
          key_learnings: ['Rate limit at 100/min'],
          active_tasks: ['Add refresh token'],
          tags: ['auth', 'security'],
        }),
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.captureStructuredMemory('Session context here...', 'session-1');

      expect(result).not.toBeNull();
      expect(result).toContain('Worked on authentication');
      expect(result).toContain('Use JWT');
      expect(result).toContain('Rate limit at 100/min');
      expect(result).toContain('auth, security');
    });

    it('should return null when provider returns no summary', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: '{"tags": ["test"]}',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.captureStructuredMemory('Session context...', 'session-1');
      expect(result).toBeNull();
    });

    it('should return null when client unavailable', async () => {
      const service = new OpenCodeProviderService({});
      const result = await service.captureStructuredMemory('test', 'session-1');
      expect(result).toBeNull();
    });

    it('should return null when no sessionID', async () => {
      const service = new OpenCodeProviderService(mockClient);
      const result = await service.captureStructuredMemory('test');
      expect(result).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockClient.session.generate.mockResolvedValue({
        text: 'not json at all and no code blocks',
      });

      const service = new OpenCodeProviderService(mockClient);
      const result = await service.captureStructuredMemory('test', 'session-1');
      expect(result).toBeNull();
    });
  });
});
