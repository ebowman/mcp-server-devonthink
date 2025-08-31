import { z } from "zod";
import { createDevonThinkTool } from "../base/DevonThinkTool.js";

const ClassifyDocumentSchema = z.object({
  documentUuid: z.string().describe("UUID of the document to classify"),
  databaseName: z.string().optional().describe("Name of database to search for classifications in (defaults to current database)"),
  comparisonType: z.enum(['data comparison', 'tags comparison']).optional().describe("Type of comparison algorithm to use"),
  proposeTags: z.boolean().default(false).describe("Propose tags instead of groups (default: false for groups)"),
  maxSuggestions: z.number().min(1).max(20).default(10).describe("Maximum number of classification suggestions to return")
}).strict();

export const classifyDocumentTool = createDevonThinkTool({
  name: "classify_document",
  description: `Get AI-powered classification suggestions for a DEVONthink document. DEVONthink's AI analyzes the document's content and suggests appropriate groups or tags based on similar content in your database.

**What it does:**
• Analyzes the content of a specific document using DEVONthink's built-in AI
• Suggests appropriate groups (folders) or tags for organizing the document
• Uses content similarity to find the best classification matches
• Provides probability scores for each suggestion

**Usage Examples:**
• "Where should I file this research paper?"
• "What tags would be appropriate for this meeting note?"
• "Suggest groups for organizing this financial document"
• "Find similar content to help categorize this email"

**Classification Types:**
• **Groups**: Suggests existing folders/groups where the document would fit well
• **Tags**: Suggests relevant tags based on similar content in your database

**Comparison Methods:**
• **Data Comparison**: Analyzes document content and structure (default)
• **Tags Comparison**: Focuses on existing tag patterns and relationships

**Features:**
• **Content Analysis**: Deep analysis of document text, structure, and context
• **Similarity Matching**: Finds existing content with similar themes and topics  
• **Probability Scoring**: Ranked suggestions with confidence scores
• **Database Scoping**: Search within specific databases or across all open ones
• **Flexible Targeting**: Get suggestions for groups (filing) or tags (labeling)
• **Smart Recommendations**: Handles cases where no similar content exists

**Prerequisites:** DEVONthink Pro with sufficient content for comparison
**Best Results:** Works better with databases containing diverse, well-organized content

Perfect for document organization, content discovery, and maintaining consistent filing systems.`,
  inputSchema: ClassifyDocumentSchema,
  buildScript: (input, helpers) => {
    const { 
      documentUuid, 
      databaseName, 
      comparisonType = 'data comparison', 
      proposeTags = false, 
      maxSuggestions = 10 
    } = input;

    return helpers.wrapInTryCatch(`
      const theApp = Application("DEVONthink");
      theApp.includeStandardAdditions = true;
      
      // Check if DEVONthink is running
      if (!theApp.running()) {
        const result = {};
        result["success"] = false;
        result["error"] = "DEVONthink is not running";
        return JSON.stringify(result);
      }
      
      // Get the record to classify
      const targetRecord = theApp.getRecordWithUuid(${helpers.formatValue(documentUuid)});
      if (!targetRecord) {
        const result = {};
        result["success"] = false;
        result["error"] = "Document not found: " + ${helpers.formatValue(documentUuid)};
        return JSON.stringify(result);
      }
      
      // Determine database scope
      ${helpers.buildDatabaseLookup(databaseName)}
      
      // Build classification options using bracket notation (required for JXA)
      const classifyOptions = {};
      classifyOptions["record"] = targetRecord;  // Record must be part of the options object
      classifyOptions["in"] = targetDatabase;
      classifyOptions["comparison"] = ${helpers.formatValue(comparisonType)};
      classifyOptions["tags"] = ${proposeTags};
      
      // Get classification proposals using single object parameter (like summarizeContentsOf)
      let proposals;
      try {
        proposals = theApp.classify(classifyOptions);
      } catch (classifyError) {
        const result = {};
        result["success"] = false;
        result["error"] = "Classification failed: " + classifyError.toString();
        return JSON.stringify(result);
      }
      
      if (!proposals || proposals.length === 0) {
        const result = {};
        result["success"] = true;
        result["recordName"] = targetRecord.name();
        result["recordType"] = targetRecord.type();
        result["recordLocation"] = targetRecord.location();
        result["classificationTarget"] = ${proposeTags} ? "tags" : "groups";
        result["suggestions"] = [];
        result["totalSuggestions"] = 0;
        return JSON.stringify(result);
      }
      
      // Format suggestions
      const suggestions = [];
      const maxResults = Math.min(${maxSuggestions}, proposals.length);
      
      for (let i = 0; i < maxResults; i++) {
        const proposal = proposals[i];
        const suggestion = {};
        
        suggestion["name"] = proposal.name ? proposal.name() : proposal.toString();
        suggestion["score"] = proposal.score ? proposal.score() : 1.0;
        suggestion["type"] = ${proposeTags} ? "tag" : "group";
        
        if (!${proposeTags} && proposal.uuid) {
          try {
            suggestion["uuid"] = proposal.uuid();
            suggestion["location"] = proposal.location ? proposal.location() : "";
          } catch (metaError) {
            // Some proposals might not have all metadata
          }
        }
        
        suggestions.push(suggestion);
      }
      
      // Build result
      const result = {};
      result["success"] = true;
      result["recordName"] = targetRecord.name();
      result["recordType"] = targetRecord.type();
      result["recordLocation"] = targetRecord.location();
      result["classificationTarget"] = ${proposeTags} ? "tags" : "groups";
      result["suggestions"] = suggestions;
      result["totalSuggestions"] = proposals.length;
      
      return JSON.stringify(result);
    `);
  }
});