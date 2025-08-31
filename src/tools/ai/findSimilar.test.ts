import { describe, it, expect, vi, beforeEach } from "vitest";
import { findSimilarTool } from "./findSimilar.js";
import * as executeModule from "../../applescript/execute.js";

// Mock the executeJxa function
vi.mock("../../applescript/execute.js");

describe("findSimilarTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct tool properties", () => {
    expect(findSimilarTool.name).toBe("find_similar");
    expect(findSimilarTool.description).toContain("Find documents similar to a given record");
    expect(findSimilarTool.inputSchema).toBeDefined();
    expect(findSimilarTool.run).toBeTypeOf("function");
  });

  it("should find similar documents successfully", async () => {
    const mockResponse = {
      success: true,
      source: {
        uuid: "source-uuid",
        name: "AI Research Paper",
        type: "markdown"
      },
      similarDocuments: [
        {
          uuid: "similar1",
          name: "Machine Learning Guide",
          path: "/Research/ML Guide.pdf",
          type: "PDF",
          score: 0.8,
          tags: ["machine-learning", "research"],
          comment: "Key reference",
          wordCount: 1200
        },
        {
          uuid: "similar2", 
          name: "Neural Networks",
          path: "/Research/Neural Networks.md",
          type: "markdown",
          score: 0.7,
          tags: ["ai", "neural-nets"],
          comment: "",
          wordCount: 800
        }
      ],
      resultCount: 2,
      searchDatabase: "Research Database"
    };

    vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

    const result = await findSimilarTool.run({
      recordUuid: "source-uuid",
      maxResults: 10,
      minScore: 0.5
    });

    expect(result).toEqual(mockResponse);
    expect(executeModule.executeJxa).toHaveBeenCalledTimes(1);
    
    const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
    expect(calledScript).toContain("getRecordWithUuid");
    expect(calledScript).toContain("source-uuid");
    expect(calledScript).toContain("compareOptions[\"comparison\"] = \"data comparison\"");
  });

  it("should handle source record not found", async () => {
    const mockResponse = {
      success: false,
      error: "Record not found: invalid-uuid"
    };

    vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

    const result = await findSimilarTool.run({
      recordUuid: "invalid-uuid"
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Record not found");
  });

  it("should use specific database when provided", async () => {
    const mockResponse = {
      success: true,
      source: { uuid: "uuid1", name: "Test Doc", type: "markdown" },
      similarDocuments: [],
      resultCount: 0,
      searchDatabase: "Specific Database"
    };

    vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

    await findSimilarTool.run({
      recordUuid: "uuid1",
      databaseName: "Specific Database"
    });

    const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
    expect(calledScript).toContain("Specific Database");
  });

  it("should validate input schema", async () => {
    await expect(findSimilarTool.run({
      // Missing required recordUuid
      maxResults: 5
    })).rejects.toThrow();

    await expect(findSimilarTool.run({
      recordUuid: "uuid1",
      maxResults: "invalid" // Should be number
    })).rejects.toThrow();

    await expect(findSimilarTool.run({
      recordUuid: "uuid1",
      minScore: 1.5 // Should be 0-1
    })).rejects.toThrow();
  });

  it("should handle search and classification failures", async () => {
    const mockResponse = {
      success: false,
      error: "Similarity search failed: Database not accessible; Classification fallback failed: AI service unavailable"
    };

    vi.mocked(executeModule.executeJxa).mockResolvedValueOnce(mockResponse);

    const result = await findSimilarTool.run({
      recordUuid: "uuid1"
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Similarity search failed");
    expect(result.error).toContain("Classification fallback failed");
  });

  it("should filter results by minimum score", async () => {
    await findSimilarTool.run({
      recordUuid: "uuid1",
      minScore: 0.8 // High threshold
    });

    const calledScript = vi.mocked(executeModule.executeJxa).mock.calls[0][0];
    expect(calledScript).toContain("0.8"); // Should use the minScore in filtering
  });
});