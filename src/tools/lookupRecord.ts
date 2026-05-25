import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Tool, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeJxa } from "../applescript/execute.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

const LookupRecordSchema = z
	.object({
		lookupType: z
			.enum(["filename", "path", "url", "tags", "comment", "contentHash"])
			.describe("Type of lookup to perform"),
		value: z.string().describe("Value to search for"),
		tags: z.array(z.string()).optional().describe("Tags to search for (for lookupType 'tags')"),
		matchAnyTag: z
			.boolean()
			.optional()
			.describe("Match any tag instead of all (for lookupType 'tags')"),
		databaseName: z
			.string()
			.optional()
			.describe(
				"Database to scope the lookup to. If omitted, every open database is searched.",
			),
		limit: z.number().optional().describe("Maximum results to return (optional)"),
	})
	.strict();

type LookupRecordInput = z.infer<typeof LookupRecordSchema>;

interface LookupResult {
	success: boolean;
	error?: string;
	results?: Array<{
		id: number;
		name: string;
		path: string;
		location: string;
		recordType: string;
		kind: string;
		creationDate?: string;
		modificationDate?: string;
		tags?: string[];
		size?: number;
		url?: string;
		comment?: string;
	}>;
	totalCount?: number;
}

const lookupRecord = async (input: LookupRecordInput): Promise<LookupResult> => {
	const { lookupType, value, tags, matchAnyTag, databaseName, limit = 50 } = input;

	const script = `
    (() => {
      const theApp = Application("DEVONthink");
      theApp.includeStandardAdditions = true;

      try {
        // Determine the set of databases to search.
        // If a databaseName is supplied, scope to that one database.
        // Otherwise, iterate every open database — DEVONthink's lookupRecordsWith*
        // APIs do not natively support "all databases" the way search() does, so we
        // must call them once per database and union the results.
        let searchDatabases;
        if ("${databaseName || ""}") {
          const databases = theApp.databases();
          const targetDb = databases.find(db => db.name() === "${databaseName}");
          if (!targetDb) {
            return JSON.stringify({
              success: false,
              error: "Database not found: ${databaseName}"
            });
          }
          searchDatabases = [targetDb];
        } else {
          searchDatabases = theApp.databases();
        }

        // lookupRecordsWith* returns AppleScript reference arrays; collect into
        // a plain array as we go so we can dedupe by UUID across databases.
        const seen = {};
        let searchResults = [];

        for (let dbIdx = 0; dbIdx < searchDatabases.length; dbIdx++) {
          const searchDatabase = searchDatabases[dbIdx];
          let dbResults;

          switch ("${lookupType}") {
            case "filename":
              dbResults = theApp.lookupRecordsWithFile("${value}", { in: searchDatabase });
              break;
            case "path":
              dbResults = theApp.lookupRecordsWithPath("${value}", { in: searchDatabase });
              break;
            case "url": {
              const urlValue = "${value}";
              const dtPrefix = "x-devonthink-item://";
              if (urlValue.startsWith(dtPrefix)) {
                // x-devonthink-item:// resolves globally via UUID — do it once,
                // not per-database, then short-circuit the loop.
                if (dbIdx === 0) {
                  const identifier = decodeURIComponent(urlValue.substring(dtPrefix.length));
                  const record = theApp.getRecordWithUuid(identifier);
                  if (record && record.exists()) {
                    dbResults = [record];
                  } else {
                    dbResults = [];
                  }
                  dbIdx = searchDatabases.length; // exit the for-loop after this iter
                } else {
                  dbResults = [];
                }
              } else {
                dbResults = theApp.lookupRecordsWithURL(decodeURIComponent(urlValue), { in: searchDatabase });
              }
              break;
            }
            case "comment":
              dbResults = theApp.lookupRecordsWithComment("${value}", { in: searchDatabase });
              break;
            case "contentHash":
              dbResults = theApp.lookupRecordsWithContentHash("${value}", { in: searchDatabase });
              break;
            case "tags": {
              const tagArray = ${tags ? JSON.stringify(tags) : "[]"};
              if (tagArray.length === 0 && "${value}") {
                tagArray.push("${value}");
              }
              const tagOptions = { in: searchDatabase };
              if (${matchAnyTag}) {
                tagOptions.any = true;
              }
              dbResults = theApp.lookupRecordsWithTags(tagArray, tagOptions);
              break;
            }
            default:
              return JSON.stringify({
                success: false,
                error: "Invalid lookup type: ${lookupType}"
              });
          }

          if (dbResults && dbResults.length > 0) {
            for (let i = 0; i < dbResults.length; i++) {
              const rec = dbResults[i];
              const uuid = rec.uuid();
              if (!seen[uuid]) {
                seen[uuid] = true;
                searchResults.push(rec);
              }
            }
          }
        }
        
        if (!searchResults || searchResults.length === 0) {
          return JSON.stringify({
            success: true,
            results: [],
            totalCount: 0
          });
        }
        
        // Limit results and extract properties
        const limitedResults = searchResults.slice(0, ${limit});
        const results = limitedResults.map(record => {
          const result = {
            id: record.id(),
            name: record.name(),
            path: record.path(),
            location: record.location(),
            recordType: record.recordType(),
            kind: record.kind(),
            creationDate: record.creationDate() ? record.creationDate().toString() : null,
            modificationDate: record.modificationDate() ? record.modificationDate().toString() : null,
            tags: record.tags(),
            size: record.size()
          };
          
          // Include URL if available
          if (record.url && record.url()) {
            result.url = record.url();
          }
          
          // Include comment if available
          if (record.comment && record.comment()) {
            result.comment = record.comment();
          }
          
          return result;
        });
        
        return JSON.stringify({
          success: true,
          results: results,
          totalCount: searchResults.length
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.toString()
        });
      }
    })();
  `;

	return await executeJxa<LookupResult>(script);
};

export const lookupRecordTool: Tool = {
	name: "lookup_record",
	description:
		'Look up records in DEVONthink by a specific attribute.\n\nBy default the lookup spans every open database; pass "databaseName" to scope to a single database.\n\nExample:\n{\n  "lookupType": "filename",\n  "value": "report.pdf"\n}',
	inputSchema: zodToJsonSchema(LookupRecordSchema) as ToolInput,
	run: lookupRecord,
};
