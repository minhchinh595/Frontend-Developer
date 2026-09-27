import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    // =========================================
    // CHECK API KEY
    // =========================================

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing. Please check your .env.local file.",
        },
        {
          status: 500,
        }
      );
    }

    // =========================================
    // READ REQUEST
    // =========================================

    const body = await request.json();

    const question = body.question;
    const documents = body.documents;

    // =========================================
    // VALIDATE QUESTION
    // =========================================

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================
    // VALIDATE DOCUMENTS
    // =========================================

    if (
      !Array.isArray(documents) ||
      documents.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please upload at least one document.",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================
    // COMBINE DOCUMENTS
    // =========================================

    const documentContext = documents
      .map(
        (document: {
          name: string;
          content: string;
        }) => {
          return `
DOCUMENT NAME: ${document.name}

DOCUMENT CONTENT:
${document.content}
`;
        }
      )
      .join(
        "\n\n==============================\n\n"
      );

    // =========================================
    // LIMIT CONTEXT
    // =========================================

    const maxContextLength = 50000;

    const limitedContext =
      documentContext.length > maxContextLength
        ? documentContext.substring(
            0,
            maxContextLength
          ) +
          "\n\n[Document content truncated]"
        : documentContext;

    // =========================================
    // SYSTEM PROMPT
    // =========================================

    const systemPrompt = `
You are an AI research assistant.

Your job is to answer the user's question
using ONLY the uploaded documents.

Do not use outside knowledge.

IMPORTANT RULES:

1. Never invent information.

2. If the answer cannot be found in the
   uploaded documents, clearly state that
   the information is not available.

3. Return ONLY valid JSON.

4. The JSON must follow exactly this structure:

{
  "summary": "string",
  "key_points": ["string"],
  "risks": ["string"],
  "actions": ["string"]
}

5. "summary":
   Give a short summary of the answer.

6. "key_points":
   Give the most important points related
   to the user's question.

7. "risks":
   Include limitations, warnings or missing
   information if relevant.
   If there are no risks, return an empty array.

8. "actions":
   Give useful next steps if relevant.
   If there are no actions, return an empty array.

9. Do not add markdown.
10. Do not add explanations outside the JSON.
11. Answer in Vietnamese when the user asks
    in Vietnamese.
`;

    // =========================================
    // CALL GROQ
    // =========================================

    const completion =
      await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",

        temperature: 0.2,

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

${question}
`,
          },
        ],
      });

    // =========================================
    // GET RESPONSE
    // =========================================

    const rawAnswer =
      completion.choices[0]?.message?.content;

    if (!rawAnswer) {
      throw new Error(
        "The AI did not return a response."
      );
    }

    // =========================================
    // PARSE JSON
    // =========================================

    let structuredAnswer;

    try {
      structuredAnswer = JSON.parse(
        rawAnswer
      );
    } catch (error) {
      console.error(
        "Failed to parse AI JSON:",
        rawAnswer
      );

      throw new Error(
        "The AI returned invalid structured data."
      );
    }

    // =========================================
    // VALIDATE STRUCTURE
    // =========================================

    const result = {
      summary:
        typeof structuredAnswer.summary ===
        "string"
          ? structuredAnswer.summary
          : "",

      key_points:
        Array.isArray(
          structuredAnswer.key_points
        )
          ? structuredAnswer.key_points
          : [],

      risks:
        Array.isArray(
          structuredAnswer.risks
        )
          ? structuredAnswer.risks
          : [],

      actions:
        Array.isArray(
          structuredAnswer.actions
        )
          ? structuredAnswer.actions
          : [],
    };

    console.log(
      "Structured AI response:",
      result
    );

    // =========================================
    // RETURN
    // =========================================

    return NextResponse.json({
      success: true,
      answer: result,
    });
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

    return NextResponse.json(
      {
        error: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}