import { z } from "zod";
import { createDevonThinkTool } from "../base/DevonThinkTool.js";

const FindSimilarSchema = z.object({
  recordUuid: z.string().describe("UUID of the record to find similar documents for"),
  databaseName: z.string().optional().describe("Database to search in (defaults to current database)"),
  maxResults: z.number().optional().default(10).describe("Maximum number of similar documents to return"),
  minScore: z.number().min(0).max(1).optional().default(0.5).describe("Minimum similarity score (0-1) to include in results"),
}).strict();

export const findSimilarTool = createDevonThinkTool({
  name: "find_similar",
  description: "Find documents similar to a given record using DEVONthink's AI-powered similarity analysis. Uses semantic understanding to identify related content even when exact words don't match.",
  inputSchema: FindSimilarSchema,
  buildScript: (input, helpers) => {
    const { recordUuid, databaseName, maxResults, minScore } = input;
    
    return helpers.wrapInTryCatch(`
      const theApp = Application("DEVONthink");
      theApp.includeStandardAdditions = true;
      
      // Get the source record
      const sourceRecord = theApp.getRecordWithUuid(${helpers.formatValue(recordUuid)});
      if (!sourceRecord) {
        const result = {};
        result["success"] = false;
        result["error"] = "Record not found: " + ${helpers.formatValue(recordUuid)};
        return JSON.stringify(result);
      }
      
      // Get target database
      ${helpers.buildDatabaseLookup(databaseName)}
      
      // Use DEVONthink's compare function to find similar records
      let similarRecords = [];
      try {
        // Build compare options using bracket notation (required for JXA)
        const compareOptions = {};
        compareOptions["record"] = sourceRecord;  // Record must be part of the options object
        compareOptions["in"] = targetDatabase;
        compareOptions["comparison"] = "data comparison";
        
        // Use single object parameter (like summarizeContentsOf and classify)
        const similarItems = theApp.compare(compareOptions);
        
        if (similarItems && similarItems.length > 0) {
          // Process similar items returned by compare
          const scoredResults = [];
          
          for (let i = 0; i < Math.min(similarItems.length, ${maxResults} * 2); i++) {
            const item = similarItems[i];
            try {
              // Extract score and record info
              const score = item.score ? item.score() : item.probability ? item.probability() : 0.5;
              
              if (score >= ${minScore}) {
                const record = item.record ? item.record() : item;
                if (record.uuid() !== sourceRecord.uuid()) { // Skip source record
                  scoredResults.push({
                    uuid: record.uuid(),
                    name: record.name(),
                    path: record.location ? record.location() : "",
                    type: record.type(),
                    score: score,
                    tags: record.tags ? record.tags().map(t => t.name ? t.name() : t) : [],
                    comment: record.comment ? record.comment() : "",
                    wordCount: record.wordCount ? record.wordCount() : 0
                  });
                }
              }
            } catch (itemError) {
              // Skip problematic items
            }
          }
          
          // Sort by score and limit results
          similarRecords = scoredResults
            .sort((a, b) => b.score - a.score)
            .slice(0, ${maxResults});
        }
          
      } catch (searchError) {
        // Fallback: use classification to find similar items
        try {
          const classifyOptions = {};
          classifyOptions["record"] = sourceRecord;
          classifyOptions["in"] = targetDatabase;
          
          const classifications = theApp.classify(classifyOptions);
          
          similarRecords = classifications.slice(0, ${maxResults}).map(cls => {
            const record = cls.record ? cls.record() : cls;
            return {
              uuid: record.uuid(),
              name: record.name(),
              path: record.path ? record.path() : record.location(),
              type: record.type(),
              score: cls.score ? cls.score() : 0.5,
              tags: record.tags ? record.tags().map(t => t.name()) : [],
              comment: record.comment ? record.comment() : "",
              wordCount: record.wordCount ? record.wordCount() : 0
            };
          });
        } catch (classifyError) {
          const result = {};
          result["success"] = false;
          result["error"] = "Similarity search failed: " + searchError.toString() + "; Classification fallback failed: " + classifyError.toString();
          return JSON.stringify(result);
        }
      }
      
      const result = {};
      result["success"] = true;
      result["source"] = {
        uuid: sourceRecord.uuid(),
        name: sourceRecord.name(),
        type: sourceRecord.type()
      };
      result["similarRecords"] = similarRecords;
      result["resultCount"] = similarRecords.length;
      result["searchDatabase"] = targetDatabase.name();
      
      return JSON.stringify(result);
    `);
  }
});