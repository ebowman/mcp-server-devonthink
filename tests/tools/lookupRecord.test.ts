import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeJxaMock } = vi.hoisted(() => ({
	executeJxaMock: vi.fn(),
}));

vi.mock("../../src/applescript/execute.js", () => ({
	executeJxa: executeJxaMock,
}));

import { lookupRecordTool } from "../../src/tools/lookupRecord.js";

describe("lookupRecordTool", () => {
	beforeEach(() => {
		executeJxaMock.mockReset();
		executeJxaMock.mockResolvedValue({ success: true, results: [], totalCount: 0 });
	});

	describe("default scope (no databaseName)", () => {
		it("iterates every open database when databaseName is omitted", async () => {
			await lookupRecordTool.run?.({
				lookupType: "tags",
				value: "",
				tags: ["regression"],
			});

			const [script] = executeJxaMock.mock.calls[0];
			// The script must walk all databases, not fall back to currentDatabase().
			expect(script).toContain("searchDatabases = theApp.databases();");
			expect(script).not.toContain("theApp.currentDatabase()");
		});

		it("leaves the database-name guard inert (empty literal) when no databaseName is supplied", async () => {
			await lookupRecordTool.run?.({
				lookupType: "filename",
				value: "report.pdf",
			});

			const [script] = executeJxaMock.mock.calls[0];
			// pDatabaseName is interpolated as `null` when undefined, which is falsy
			// at runtime, so the scoped branch never runs.
			expect(script).toContain("const pDatabaseName = null;");
		});
	});

	describe("scoped (databaseName supplied)", () => {
		it("scopes to the named database when databaseName is supplied", async () => {
			await lookupRecordTool.run?.({
				lookupType: "filename",
				value: "report.pdf",
				databaseName: "MyDB",
			});

			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pDatabaseName = "MyDB";');
			expect(script).toContain("db.name() === pDatabaseName");
			expect(script).toContain("searchDatabases = [targetDb];");
		});
	});

	describe("lookup type dispatch", () => {
		it("dispatches to lookupRecordsWithFile for filename", async () => {
			await lookupRecordTool.run?.({ lookupType: "filename", value: "report.pdf" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pValue = "report.pdf";');
			expect(script).toContain(
				"theApp.lookupRecordsWithFile(pValue, { in: searchDatabase })",
			);
		});

		it("dispatches to lookupRecordsWithPath for path", async () => {
			await lookupRecordTool.run?.({ lookupType: "path", value: "/Inbox/Note" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				"theApp.lookupRecordsWithPath(pValue, { in: searchDatabase })",
			);
		});

		it("dispatches to lookupRecordsWithComment for comment", async () => {
			await lookupRecordTool.run?.({ lookupType: "comment", value: "hello" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				"theApp.lookupRecordsWithComment(pValue, { in: searchDatabase })",
			);
		});

		it("dispatches to lookupRecordsWithContentHash for contentHash", async () => {
			await lookupRecordTool.run?.({ lookupType: "contentHash", value: "abc123" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				"theApp.lookupRecordsWithContentHash(pValue, { in: searchDatabase })",
			);
		});

		it("dispatches to lookupRecordsWithTags for tags and honors matchAnyTag", async () => {
			await lookupRecordTool.run?.({
				lookupType: "tags",
				value: "",
				tags: ["a", "b"],
				matchAnyTag: true,
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pTags = ["a", "b"];');
			expect(script).toContain("const pMatchAnyTag = true;");
			expect(script).toContain("if (pMatchAnyTag) {");
			expect(script).toContain("tagOptions.any = true;");
			expect(script).toContain("theApp.lookupRecordsWithTags(tagArray, tagOptions);");
		});
	});

	describe("url lookup", () => {
		it("uses getRecordWithUuid shortcut for x-devonthink-item URLs and short-circuits the db loop", async () => {
			await lookupRecordTool.run?.({
				lookupType: "url",
				value: "x-devonthink-item://1234-5678",
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const dtPrefix = "x-devonthink-item://";');
			expect(script).toContain("theApp.getRecordWithUuid(identifier);");
			expect(script).toContain("dbIdx = searchDatabases.length;");
		});

		it("falls back to lookupRecordsWithURL for non-DT URLs", async () => {
			await lookupRecordTool.run?.({
				lookupType: "url",
				value: "https://example.com/page",
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				"theApp.lookupRecordsWithURL(decodeURIComponent(pValue), { in: searchDatabase })",
			);
		});
	});

	it("dedupes results by UUID across databases", async () => {
		await lookupRecordTool.run?.({ lookupType: "filename", value: "shared.md" });
		const [script] = executeJxaMock.mock.calls[0];
		expect(script).toContain("const seen = {};");
		expect(script).toContain("if (!seen[uuid]) {");
	});

	describe("input escaping and validation", () => {
		it("escapes embedded double-quotes in value", async () => {
			await lookupRecordTool.run?.({
				lookupType: "filename",
				value: 'evil"injection.md',
			});
			const [script] = executeJxaMock.mock.calls[0];
			// The escaped form must appear; the raw form (which would break out of
			// the JXA string literal) must not appear adjacent to its surrounding quotes.
			expect(script).toContain('const pValue = "evil\\"injection.md";');
			expect(executeJxaMock).toHaveBeenCalledTimes(1);
		});

		it("escapes backslashes and newlines in value", async () => {
			await lookupRecordTool.run?.({
				lookupType: "comment",
				value: "line1\nline2\\path",
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pValue = "line1\\nline2\\\\path";');
		});

		it("escapes embedded double-quotes in databaseName", async () => {
			await lookupRecordTool.run?.({
				lookupType: "filename",
				value: "x.md",
				databaseName: 'odd"name',
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pDatabaseName = "odd\\"name";');
		});

		it("escapes embedded double-quotes in tags", async () => {
			await lookupRecordTool.run?.({
				lookupType: "tags",
				value: "",
				tags: ['weird"tag', "plain"],
			});
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain('const pTags = ["weird\\"tag", "plain"];');
		});

		it("rejects value containing a control character before invoking JXA", async () => {
			const result = await lookupRecordTool.run?.({
				lookupType: "filename",
				value: "bad\x00value",
			});
			expect(result).toEqual({
				success: false,
				error: "Value contains invalid characters",
			});
			expect(executeJxaMock).not.toHaveBeenCalled();
		});

		it("rejects databaseName containing a control character before invoking JXA", async () => {
			const result = await lookupRecordTool.run?.({
				lookupType: "filename",
				value: "x.md",
				databaseName: "bad\x01db",
			});
			expect(result).toEqual({
				success: false,
				error: "Database name contains invalid characters",
			});
			expect(executeJxaMock).not.toHaveBeenCalled();
		});

		it("rejects tag containing a control character before invoking JXA", async () => {
			const result = await lookupRecordTool.run?.({
				lookupType: "tags",
				value: "",
				tags: ["ok", "bad\x07tag"],
			});
			expect(result).toEqual({
				success: false,
				error: "Tag contains invalid characters",
			});
			expect(executeJxaMock).not.toHaveBeenCalled();
		});
	});
});
