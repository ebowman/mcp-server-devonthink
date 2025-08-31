/**
 * Types for DEVONthink AI service integration
 * These types correspond to DEVONthink's native AI capabilities exposed via JXA
 */

/**
 * DEVONthink AI chat message parameters
 */
export interface ChatRequest {
  message: string;
  records?: string[]; // UUIDs of records to include in context
  mode?: string; // Chat mode
  temperature?: number; // 0.0 to 1.0
  model?: string; // Specific model to use
  engine?: string; // Chat engine to use
  role?: string; // System role
  url?: string; // URL to include in context
  image?: string; // Base64 image data or file path
  toolCalls?: boolean; // Enable tool calls
  thinking?: boolean; // Enable thinking mode
}

/**
 * DEVONthink AI chat response
 */
export interface ChatResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Classification request parameters
 */
export interface ClassifyRequest {
  recordUuid: string;
  databaseName?: string;
  comparisonType?: 'data comparison' | 'tags comparison';
  proposeTags?: boolean; // True for tags, false for groups
}

/**
 * Classification proposal result
 */
export interface ClassificationProposal {
  name: string;
  probability: number;
  uuid?: string; // For group proposals
}

/**
 * Summary types supported by DEVONthink
 */
export type SummaryType = 'markdown' | 'rich' | 'simple' | 'sheet';

/**
 * Summary style options
 */
export type SummaryStyle = 'brief' | 'detailed' | 'comprehensive';

/**
 * Summarization request for multiple records
 */
export interface SummarizeRequest {
  recordUuids: string[];
  summaryType: SummaryType;
  summaryStyle?: SummaryStyle;
  parentGroupUuid?: string; // Where to create the summary
}

/**
 * Available chat engines/models
 */
export interface ChatEngine {
  name: string;
  models: string[];
  capabilities: string[];
}

/**
 * AI service health status
 */
export interface AIServiceHealth {
  available: boolean;
  engines: ChatEngine[];
  error?: string;
  lastChecked: Date;
}

/**
 * DEVONthink AI service error
 */
export class DevonThinkAIError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DevonThinkAIError';
  }
}