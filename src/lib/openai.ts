import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodTypeAny } from "zod";

import { assertWorkflowConfig } from "@/src/lib/config";

declare global {
  var __salesAgentOpenAi: OpenAI | undefined;
}

function getOpenAiClient() {
  if (!global.__salesAgentOpenAi) {
    const config = assertWorkflowConfig();
    global.__salesAgentOpenAi = new OpenAI({
      apiKey: config.openAiApiKey!,
    });
  }

  return global.__salesAgentOpenAi;
}

export async function generateStructuredObject<TSchema extends ZodTypeAny>({
  schema,
  schemaName,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
}: {
  schema: TSchema;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) {
  const config = assertWorkflowConfig();
  const client = getOpenAiClient();
  const completion = await client.chat.completions.parse({
    model: config.openAiModel,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(schema, schemaName),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("OpenAI returned no parsed output.");
  }

  return schema.parse(parsed);
}
