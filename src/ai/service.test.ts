import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevonThinkAIService } from './service.js';
import * as executeModule from '../applescript/execute.js';

// Mock the executeJxa function
vi.mock('../applescript/execute.js', () => ({
  executeJxa: vi.fn()
}));

describe('DevonThinkAIService', () => {
  let service: DevonThinkAIService;

  beforeEach(() => {
    service = new DevonThinkAIService();
    vi.clearAllMocks();
  });

  describe('getChatResponse', () => {
    it('should get chat response successfully', async () => {
      const mockResponse = {
        success: true,
        response: {
          content: 'This is a test response',
          model: 'gpt-4',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        }
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      const result = await service.getChatResponse({
        message: 'Hello, AI!',
        temperature: 0.7,
        model: 'gpt-4'
      });

      expect(result).toEqual({
        content: 'This is a test response',
        model: 'gpt-4',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      });

      expect(executeModule.executeJxa).toHaveBeenCalledTimes(1);
      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('getChatResponseForMessage');
      expect(calledScript).toContain('Hello, AI!');
      expect(calledScript).toContain('temperature');
    });

    it('should include records in chat request', async () => {
      const mockResponse = {
        success: true,
        response: { content: 'Response with context' }
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await service.getChatResponse({
        message: 'Analyze these documents',
        records: ['uuid1', 'uuid2']
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('recordUuids');
      expect(calledScript).toContain('getRecordWithUuid');
    });

    it('should handle chat errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Chat service unavailable'
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await expect(service.getChatResponse({
        message: 'Hello'
      })).rejects.toThrow('Chat service unavailable');
    });
  });

  describe('classifyRecord', () => {
    it('should classify record successfully', async () => {
      const mockResponse = {
        success: true,
        proposals: [
          { name: 'Documents', probability: 0.8, uuid: 'group-uuid-1' },
          { name: 'Work', probability: 0.6, uuid: 'group-uuid-2' }
        ]
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      const result = await service.classifyRecord({
        recordUuid: 'test-record-uuid'
      });

      expect(result).toEqual([
        { name: 'Documents', probability: 0.8, uuid: 'group-uuid-1' },
        { name: 'Work', probability: 0.6, uuid: 'group-uuid-2' }
      ]);

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('classify');
      expect(calledScript).toContain('test-record-uuid');
    });

    it('should handle classification with options', async () => {
      const mockResponse = {
        success: true,
        proposals: []
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await service.classifyRecord({
        recordUuid: 'test-uuid',
        databaseName: 'Test DB',
        comparisonType: 'tags comparison',
        proposeTags: true
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('Test DB');
      expect(calledScript).toContain('tags comparison');
      expect(calledScript).toContain('options["tags"] = true');
    });

    it('should handle classification errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Record not found'
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await expect(service.classifyRecord({
        recordUuid: 'invalid-uuid'
      })).rejects.toThrow('Record not found');
    });
  });

  describe('summarizeRecords', () => {
    it('should summarize records successfully', async () => {
      const mockResponse = {
        success: true,
        summary: {
          uuid: 'summary-uuid',
          content: '# Summary\n\nThis is a comprehensive summary...'
        }
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      const result = await service.summarizeRecords({
        recordUuids: ['uuid1', 'uuid2'],
        summaryType: 'markdown',
        summaryStyle: 'detailed'
      });

      expect(result).toEqual({
        uuid: 'summary-uuid',
        content: '# Summary\n\nThis is a comprehensive summary...'
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('summarizeContentsOf');
      expect(calledScript).toContain('markdown');
      expect(calledScript).toContain('detailed');
    });

    it('should handle parent group specification', async () => {
      const mockResponse = {
        success: true,
        summary: { uuid: 'summary-uuid', content: 'Summary content' }
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await service.summarizeRecords({
        recordUuids: ['uuid1'],
        summaryType: 'rich',
        parentGroupUuid: 'parent-uuid'
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      expect(calledScript).toContain('parent-uuid');
      expect(calledScript).toContain('getRecordWithUuid');
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when AI is available', async () => {
      const mockResponse = {
        success: true,
        available: true,
        lastChecked: '2023-12-01T10:00:00.000Z'
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      const result = await service.checkHealth();

      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.lastChecked).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when AI is unavailable', async () => {
      const mockResponse = {
        success: true,
        available: false,
        error: 'AI service not configured',
        lastChecked: '2023-12-01T10:00:00.000Z'
      };

      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      const result = await service.checkHealth();

      expect(result.available).toBe(false);
      expect(result.error).toBe('AI service not configured');
    });

    it('should handle health check errors gracefully', async () => {
      vi.mocked(executeModule.executeJxa).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.checkHealth();

      expect(result.available).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('script building', () => {
    it('should properly escape strings in chat script', async () => {
      const mockResponse = { success: true, response: { content: 'test' } };
      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await service.getChatResponse({
        message: 'Test with "quotes" and \'apostrophes\'',
        model: 'gpt-4'
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      
      // Should contain escaped quotes
      expect(calledScript).toContain('\\"quotes\\"');
      expect(calledScript).toContain('\\\'apostrophes\\\'');
    });

    it('should handle undefined optional parameters', async () => {
      const mockResponse = { success: true, response: { content: 'test' } };
      vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

      await service.getChatResponse({
        message: 'Simple message'
        // No optional parameters
      });

      const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
      
      // Should not contain undefined option assignments
      expect(calledScript).not.toContain('options["temperature"] = undefined');
      expect(calledScript).not.toContain('options["model"] = undefined');
    });
  });
});