import { describe, expect, test } from "vitest";
import { zodResponseFormat } from "openai/helpers/zod";

import { researchReportSchema } from "@/src/schemas/research";

describe("OpenAI schema compatibility", () => {
  test("research report schema does not emit unsupported uri formats", () => {
    const responseFormat = zodResponseFormat(researchReportSchema, "research_report");
    const schema = responseFormat.json_schema.schema as Record<string, unknown>;
    const serialized = JSON.stringify(schema);

    expect(serialized).not.toContain('"format":"uri"');
  });
});
