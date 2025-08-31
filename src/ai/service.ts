import { executeJxa } from '../applescript/execute.js';
import { escapeStringForJXA } from '../utils/escapeString.js';
import {
  ChatRequest,
  ChatResponse,
  ClassifyRequest,
  ClassificationProposal,
  SummarizeRequest,
  SummarizeTextRequest,
  TranscribeRequest,
  TranscriptionResult,
  ChatEngine,
  AIServiceHealth,
  DevonThinkAIError
} from './types.js';

/**
 * DEVONthink AI Service
 * Provides access to DEVONthink's native AI capabilities via JXA
 */
export class DevonThinkAIService {
  /**
   * Get chat response from DEVONthink's AI
   */
  public async getChatResponse(request: ChatRequest): Promise<ChatResponse> {
    try {
      const script = this.buildChatScript(request);
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Chat request failed', 'getChatResponse');
      }

      return result.response;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to get chat response: ${error instanceof Error ? error.message : String(error)}`,
        'getChatResponse',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get classification proposals for a record
   */
  public async classifyRecord(request: ClassifyRequest): Promise<ClassificationProposal[]> {
    try {
      const script = this.buildClassifyScript(request);
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Classification failed', 'classifyRecord');
      }

      return result.proposals;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to classify record: ${error instanceof Error ? error.message : String(error)}`,
        'classifyRecord',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Summarize multiple records
   */
  public async summarizeRecords(request: SummarizeRequest): Promise<{ uuid: string; content: string }> {
    try {
      const script = this.buildSummarizeRecordsScript(request);
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Summarization failed', 'summarizeRecords');
      }

      return result.summary;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to summarize records: ${error instanceof Error ? error.message : String(error)}`,
        'summarizeRecords',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Summarize text content
   */
  public async summarizeText(request: SummarizeTextRequest): Promise<string> {
    try {
      const script = this.buildSummarizeTextScript(request);
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Text summarization failed', 'summarizeText');
      }

      return result.summary;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to summarize text: ${error instanceof Error ? error.message : String(error)}`,
        'summarizeText',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transcribe audio/video record
   */
  public async transcribeRecord(request: TranscribeRequest): Promise<TranscriptionResult> {
    try {
      const script = this.buildTranscribeScript(request);
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Transcription failed', 'transcribeRecord');
      }

      return result.transcription;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to transcribe record: ${error instanceof Error ? error.message : String(error)}`,
        'transcribeRecord',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get available chat engines and models
   */
  public async getChatEngines(): Promise<ChatEngine[]> {
    try {
      const script = `
        (() => {
          const theApp = Application("DEVONthink");
          theApp.includeStandardAdditions = true;
          
          try {
            // Get available chat models - this might not be available in all versions
            const engines = [];
            // Note: get chat models for engine might require specific engine parameter
            // This is a placeholder - actual implementation depends on DEVONthink version
            
            return JSON.stringify({
              success: true,
              engines: engines
            });
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error.toString()
            });
          }
        })();
      `;
      
      const result = await executeJxa<any>(script);
      
      if (!result.success) {
        throw new DevonThinkAIError(result.error || 'Failed to get chat engines', 'getChatEngines');
      }

      return result.engines;
    } catch (error) {
      throw new DevonThinkAIError(
        `Failed to get chat engines: ${error instanceof Error ? error.message : String(error)}`,
        'getChatEngines',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check AI service health
   */
  public async checkHealth(): Promise<AIServiceHealth> {
    try {
      const script = `
        (() => {
          const theApp = Application("DEVONthink");
          theApp.includeStandardAdditions = true;
          
          try {
            // Test basic AI functionality with a simple chat request
            const testResponse = theApp.getChatResponseForMessage("Hello");
            
            return JSON.stringify({
              success: true,
              available: !!testResponse,
              lastChecked: new Date().toISOString()
            });
          } catch (error) {
            return JSON.stringify({
              success: true,
              available: false,
              error: error.toString(),
              lastChecked: new Date().toISOString()
            });
          }
        })();
      `;
      
      const result = await executeJxa<any>(script);
      
      return {
        available: result.available || false,
        engines: [], // Would need to be populated by getChatEngines
        error: result.error,
        lastChecked: new Date(result.lastChecked || Date.now())
      };
    } catch (error) {
      return {
        available: false,
        engines: [],
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Build JXA script for chat requests
   */
  private buildChatScript(request: ChatRequest): string {
    const { message, records, mode, temperature, model, engine, role, url, image, toolCalls, thinking } = request;
    
    return `
      (() => {
        const theApp = Application("DEVONthink");
        theApp.includeStandardAdditions = true;
        
        try {
          const options = {};
          ${records ? `
            const recordUuids = ${JSON.stringify(records)};
            const recordObjects = recordUuids.map(uuid => theApp.getRecordWithUuid(uuid)).filter(r => r);
            options["record"] = recordObjects;
          ` : ''}
          ${mode ? `options["mode"] = "${escapeStringForJXA(mode)}";` : ''}
          ${temperature !== undefined ? `options["temperature"] = ${temperature};` : ''}
          ${model ? `options["model"] = "${escapeStringForJXA(model)}";` : ''}
          ${engine ? `options["engine"] = "${escapeStringForJXA(engine)}";` : ''}
          ${role ? `options["role"] = "${escapeStringForJXA(role)}";` : ''}
          ${url ? `options["url"] = "${escapeStringForJXA(url)}";` : ''}
          ${image ? `options["image"] = "${escapeStringForJXA(image)}";` : ''}
          ${toolCalls !== undefined ? `options["toolCalls"] = ${toolCalls};` : ''}
          ${thinking !== undefined ? `options["thinking"] = ${thinking};` : ''}
          
          const response = theApp.getChatResponseForMessage("${escapeStringForJXA(message)}", options);
          
          return JSON.stringify({
            success: true,
            response: {
              content: typeof response === 'string' ? response : response.content || '',
              model: response.model,
              usage: response.usage
            }
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.toString()
          });
        }
      })();
    `;
  }

  /**
   * Build JXA script for classification
   */
  private buildClassifyScript(request: ClassifyRequest): string {
    const { recordUuid, databaseName, comparisonType, proposeTags } = request;
    
    return `
      (() => {
        const theApp = Application("DEVONthink");
        theApp.includeStandardAdditions = true;
        
        try {
          const record = theApp.getRecordWithUuid("${escapeStringForJXA(recordUuid)}");
          if (!record) {
            throw new Error("Record not found with UUID: ${escapeStringForJXA(recordUuid)}");
          }
          
          const options = {};
          ${databaseName ? `
            const databases = theApp.databases();
            const targetDatabase = databases.find(db => db.name() === "${escapeStringForJXA(databaseName)}");
            if (targetDatabase) {
              options["in"] = targetDatabase;
            }
          ` : ''}
          ${comparisonType ? `options["comparison"] = "${escapeStringForJXA(comparisonType)}";` : ''}
          ${proposeTags !== undefined ? `options["tags"] = ${proposeTags};` : ''}
          
          const proposals = theApp.classify(record, options);
          
          const formattedProposals = proposals.map(proposal => ({
            name: proposal.name ? proposal.name() : proposal.toString(),
            probability: proposal.probability ? proposal.probability() : 1.0,
            uuid: proposal.uuid ? proposal.uuid() : undefined
          }));
          
          return JSON.stringify({
            success: true,
            proposals: formattedProposals
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.toString()
          });
        }
      })();
    `;
  }

  /**
   * Build JXA script for record summarization
   */
  private buildSummarizeRecordsScript(request: SummarizeRequest): string {
    const { recordUuids, summaryType, summaryStyle, parentGroupUuid } = request;
    
    return `
      (() => {
        const theApp = Application("DEVONthink");
        theApp.includeStandardAdditions = true;
        
        try {
          const recordObjects = ${JSON.stringify(recordUuids)}.map(uuid => 
            theApp.getRecordWithUuid(uuid)
          ).filter(r => r);
          
          if (recordObjects.length === 0) {
            throw new Error("No valid records found");
          }
          
          const options = { to: "${escapeStringForJXA(summaryType)}" };
          ${summaryStyle ? `options["as"] = "${escapeStringForJXA(summaryStyle)}";` : ''}
          ${parentGroupUuid ? `
            const parentGroup = theApp.getRecordWithUuid("${escapeStringForJXA(parentGroupUuid)}");
            if (parentGroup) {
              options["in"] = parentGroup;
            }
          ` : ''}
          
          const summary = theApp.summarizeContentsOf(recordObjects, options);
          
          return JSON.stringify({
            success: true,
            summary: {
              uuid: summary.uuid ? summary.uuid() : undefined,
              content: summary.plainText ? summary.plainText() : summary.toString()
            }
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.toString()
          });
        }
      })();
    `;
  }

  /**
   * Build JXA script for text summarization
   */
  private buildSummarizeTextScript(request: SummarizeTextRequest): string {
    const { text, summaryStyle } = request;
    
    return `
      (() => {
        const theApp = Application("DEVONthink");
        theApp.includeStandardAdditions = true;
        
        try {
          const options = {};
          ${summaryStyle ? `options["as"] = "${escapeStringForJXA(summaryStyle)}";` : ''}
          
          const summary = theApp.summarizeText("${escapeStringForJXA(text)}", options);
          
          return JSON.stringify({
            success: true,
            summary: summary || ""
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.toString()
          });
        }
      })();
    `;
  }

  /**
   * Build JXA script for transcription
   */
  private buildTranscribeScript(request: TranscribeRequest): string {
    const { recordUuid, language, timestamps } = request;
    
    return `
      (() => {
        const theApp = Application("DEVONthink");
        theApp.includeStandardAdditions = true;
        
        try {
          const record = theApp.getRecordWithUuid("${escapeStringForJXA(recordUuid)}");
          if (!record) {
            throw new Error("Record not found with UUID: ${escapeStringForJXA(recordUuid)}");
          }
          
          const options = {};
          ${language ? `options["language"] = "${escapeStringForJXA(language)}";` : ''}
          ${timestamps !== undefined ? `options["timestamps"] = ${timestamps};` : ''}
          
          const transcription = theApp.transcribe(record, options);
          
          return JSON.stringify({
            success: true,
            transcription: {
              text: transcription.text || transcription.toString(),
              confidence: transcription.confidence,
              language: transcription.language
            }
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.toString()
          });
        }
      })();
    `;
  }
}

/**
 * Singleton instance of the DEVONthink AI service
 */
export const devonThinkAI = new DevonThinkAIService();