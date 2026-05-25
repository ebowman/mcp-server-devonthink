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
			// The conditional checks "${databaseName || ''}" — with no databaseName the
			// runtime condition is `if ("")`, so the scoped branch never runs.
			expect(script).toContain('if ("")');
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
			expect(script).toContain('db.name() === "MyDB"');
			expect(script).toContain("searchDatabases = [targetDb];");
			expect(script).toContain("Database not found: MyDB");
		});
	});

	describe("lookup type dispatch", () => {
		it("dispatches to lookupRecordsWithFile for filename", async () => {
			await lookupRecordTool.run?.({ lookupType: "filename", value: "report.pdf" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				'theApp.lookupRecordsWithFile("report.pdf", { in: searchDatabase })',
			);
		});

		it("dispatches to lookupRecordsWithPath for path", async () => {
			await lookupRecordTool.run?.({ lookupType: "path", value: "/Inbox/Note" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				'theApp.lookupRecordsWithPath("/Inbox/Note", { in: searchDatabase })',
			);
		});

		it("dispatches to lookupRecordsWithComment for comment", async () => {
			await lookupRecordTool.run?.({ lookupType: "comment", value: "hello" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				'theApp.lookupRecordsWithComment("hello", { in: searchDatabase })',
			);
		});

		it("dispatches to lookupRecordsWithContentHash for contentHash", async () => {
			await lookupRecordTool.run?.({ lookupType: "contentHash", value: "abc123" });
			const [script] = executeJxaMock.mock.calls[0];
			expect(script).toContain(
				'theApp.lookupRecordsWithContentHash("abc123", { in: searchDatabase })',
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
			expect(script).toContain('const tagArray = ["a","b"];');
			expect(script).toContain("if (true) {");
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
				"theApp.lookupRecordsWithURL(decodeURIComponent(urlValue), { in: searchDatabase })",
			);
		});
	});

	it("dedupes results by UUID across databases", async () => {
		await lookupRecordTool.run?.({ lookupType: "filename", value: "shared.md" });
		const [script] = executeJxaMock.mock.calls[0];
		expect(script).toContain("const seen = {};");
		expect(script).toContain("if (!seen[uuid]) {");
	});
});
