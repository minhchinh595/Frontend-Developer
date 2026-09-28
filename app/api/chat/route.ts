import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type AIAnswer = {
  summary: string;
  key_points: string[];
  risks: string[];
  actions: string[];
};

// =========================================
// CLEAN STRING
// =========================================

function cleanString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

// =========================================
// CLEAN STRING ARRAY
// =========================================

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// =========================================
// EXTRACT JSON
// =========================================

function extractJSON(content: string): unknown {
  let text = content.trim();

  // Remove markdown code block if AI returns it
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  // Try parsing the whole response
  try {
    return JSON.parse(text);
  } catch {
    // Continue
  }

  // Try extracting JSON object
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const possibleJSON = text.substring(
      firstBrace,
      lastBrace + 1
    );

    try {
      return JSON.parse(possibleJSON);
    } catch {
      // Continue
    }
  }

  return null;
}

// =========================================
// NORMALIZE AI RESULT
// =========================================

function normalizeAIAnswer(
  parsed: unknown
): AIAnswer {
  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    return {
      summary: "",
      key_points: [],
      risks: [],
      actions: [],
    };
  }

  const object =
    parsed as Record<string, unknown>;

  return {
    summary: cleanString(
      object.summary
    ),

    key_points:
      cleanStringArray(
        object.key_points
      ),

    risks:
      cleanStringArray(
        object.risks
      ),

    actions:
      cleanStringArray(
        object.actions
      ),
  };
}

// =========================================
// POST
// =========================================

export async function POST(
  request: Request
) {
  try {
    // =======================================
    // CHECK API KEY
    // =======================================

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        {
          error:
            "GROQ_API_KEY is missing. Please check your .env.local file.",
        },
        {
          status: 500,
        }
      );
    }

    // =======================================
    // READ REQUEST
    // =======================================

    const body =
      await request.json();

    const question =
      body.question;

    const documents =
      body.documents;

    // =======================================
    // VALIDATE QUESTION
    // =======================================

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return Response.json(
        {
          error:
            "Please enter a question.",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================
    // VALIDATE DOCUMENTS
    // =======================================

    if (
      !Array.isArray(documents) ||
      documents.length === 0
    ) {
      return Response.json(
        {
          error:
            "Please upload at least one document.",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================
    // COMBINE DOCUMENTS
    // =======================================

    const documentContext =
      documents
        .map(
          (
            document: {
              name: string;
              content: string;
            }
          ) => `
DOCUMENT NAME:
${document.name}

DOCUMENT CONTENT:
${document.content}
`
        )
        .join(
          "\n\n==============================\n\n"
        );

    // =======================================
    // LIMIT CONTEXT
    // =======================================

    const maxContextLength =
      50000;

    const limitedContext =
      documentContext.length >
      maxContextLength
        ? documentContext.substring(
            0,
            maxContextLength
          ) +
          "\n\n[Document content truncated]"
        : documentContext;

    // =======================================
    // SYSTEM PROMPT
    // =======================================

    const systemPrompt = `
You are an AI research assistant.

Your job is to answer the user's question using ONLY the uploaded documents.

Do NOT use outside knowledge.

Do NOT invent information.

Your response MUST be a single valid JSON object.

The JSON object MUST have exactly these four properties:

{
  "summary": "string",
  "key_points": ["string"],
  "risks": ["string"],
  "actions": ["string"]
}

IMPORTANT:

- summary must be a string.
- key_points must be an array of strings.
- risks must be an array of strings.
- actions must be an array of strings.
- NEVER omit any property.
- NEVER return null.
- NEVER add extra properties.
- If there are no risks, return "risks": [].
- If there are no actions, return "actions": [].

FIELD INSTRUCTIONS:

summary:
Give a short and accurate summary based only on the uploaded documents.

If the answer cannot be found in the documents, say:
"Thông tin này không được cung cấp trong tài liệu đã tải lên."

key_points:
List the important facts that directly answer the user's question.

If the user asks for a specific number of points, try to provide exactly that number when the document contains enough information.

risks:
List limitations, missing information, uncertainty, or warnings that are supported by the uploaded documents.

If there are none, return [].

actions:
List useful next steps supported by the uploaded documents or directly useful for the user's question.

If there are none, return [].

OUTPUT FORMAT:

Return ONLY JSON.

Example:

{
  "summary": "Tóm tắt nội dung tài liệu.",
  "key_points": [
    "Điểm quan trọng 1",
    "Điểm quan trọng 2"
  ],
  "risks": [],
  "actions": []
}

Do not write Markdown.
Do not write explanations.
Do not write text before the JSON.
Do not write text after the JSON.

If the user asks in Vietnamese, answer in Vietnamese.

Use ONLY the uploaded documents.
`;

    console.log(
      "Starting STREAMING AI request..."
    );

    // =======================================
    // CALL GROQ WITH STREAMING
    // =======================================

    const stream =
      await groq.chat.completions.create({
        model:
          "openai/gpt-oss-20b",

        temperature: 0,

        stream: true,

        // Force the model to return JSON
        response_format: {
          type: "json_object",
        },

        messages: [
          {
            role: "system",
            content: systemPrompt,
          },

          {
            role: "user",
            content: `
UPLOADED DOCUMENTS:

${limitedContext}

==============================

USER QUESTION:

${question.trim()}

==============================

IMPORTANT:

Return ONLY one valid JSON object with exactly:

summary
key_points
risks
actions

If risks are empty:
"risks": []

If actions are empty:
"actions": []
`,
          },
        ],
      });

    // =======================================
    // CREATE STREAM
    // =======================================

    const encoder =
      new TextEncoder();

    const readableStream =
      new ReadableStream({
        async start(controller) {
          try {
            for await (
              const chunk of stream
            ) {
              const content =
                chunk.choices[0]
                  ?.delta?.content;

              if (content) {
                controller.enqueue(
                  encoder.encode(
                    content
                  )
                );
              }
            }

            console.log(
              "Streaming AI response completed."
            );

            controller.close();
          } catch (error) {
            console.error(
              "Streaming error:",
              error
            );

            controller.error(
              error
            );
          }
        },
      });

    // =======================================
    // RETURN STREAM
    // =======================================

    return new Response(
      readableStream,
      {
        status: 200,

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          "X-Accel-Buffering":
            "no",
        },
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "GROQ STREAMING API ERROR:"
    );

    console.error(error);

    console.error(
      "================================="
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown AI error.";

    return Response.json(
      {
        error:
          errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}