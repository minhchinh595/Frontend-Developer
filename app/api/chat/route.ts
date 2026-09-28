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

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(
      (item) => item.length > 0
    );
}

// =========================================
// EXTRACT JSON FROM AI RESPONSE
// =========================================

function extractJSON(
  content: string
): unknown {
  let text = content.trim();

  // -----------------------------------------
  // REMOVE MARKDOWN CODE BLOCK
  // -----------------------------------------

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  // -----------------------------------------
  // DIRECT JSON PARSE
  // -----------------------------------------

  try {
    return JSON.parse(text);
  } catch {
    // Continue below
  }

  // -----------------------------------------
  // FIND JSON OBJECT
  // -----------------------------------------

  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const possibleJSON =
      text.substring(
        firstBrace,
        lastBrace + 1
      );

    try {
      return JSON.parse(
        possibleJSON
      );
    } catch {
      // Continue below
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
    parsed as Record<
      string,
      unknown
    >;

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
- NEVER return ":" as a property value.
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
      "Starting AI request..."
    );

    // =======================================
    // CALL GROQ
    // =======================================

    const completion =
      await groq.chat.completions.create(
        {
          model:
            "openai/gpt-oss-20b",

          temperature: 0,

          messages: [
            {
              role: "system",
              content:
                systemPrompt,
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
        }
      );

    // =======================================
    // GET AI RESPONSE
    // =======================================

    const content =
      completion.choices[0]
        ?.message?.content;

    if (!content) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    console.log(
      "AI response received."
    );

    console.log(
      "AI raw response:",
      content
    );

    // =======================================
    // PARSE JSON
    // =======================================

    const parsed =
      extractJSON(content);

    if (!parsed) {
      console.error(
        "Could not extract valid JSON from AI response:",
        content
      );

      throw new Error(
        "The AI returned invalid JSON."
      );
    }

    // =======================================
    // NORMALIZE
    // =======================================

    const result =
      normalizeAIAnswer(
        parsed
      );

    console.log(
      "Normalized AI result:",
      result
    );

    // =======================================
    // RETURN RESULT
    // =======================================

    return Response.json(
      result
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "GROQ API ERROR:"
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