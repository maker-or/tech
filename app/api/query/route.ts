import { generateText, tool } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { z } from "zod"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string; model?: string }
    const prompt = body.prompt?.trim()

    if (!prompt) {
      return Response.json({ error: "Missing prompt" }, { status: 400 })
    }

    const model = body.model || "llama-3.3-70b-versatile"

    const result = await generateText({
      model: groq(model),
      system:
        "You are a query assistant. Translate natural language into precise database request plans and call tools when database data is needed.",
      prompt,
      maxSteps: 3,
      tools: {
        query_database: tool({
          description:
            "Runs a database query through the backend integration layer.",
          parameters: z.object({
            query: z.string(),
          }),
          execute: async ({ query }) => {
            return {
              ok: true,
              message:
                "Placeholder DB tool call. Replace with your real database integration.",
              query,
            }
          },
        }),
      },
    })

    return Response.json({
      text: result.text,
      toolResults: result.toolResults,
      finishReason: result.finishReason,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"
    return Response.json({ error: message }, { status: 500 })
  }
}
