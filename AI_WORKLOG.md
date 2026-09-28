# AI Work Log

## Project

**Project Name:** AI Research Workspace

**Challenge:** 7-Day AI Builder Challenge – Frontend Developer

**Technology:** Next.js, TypeScript, Tailwind CSS, Groq API

---

## 1. AI Tools Used

During development, I used AI tools to help with:

- Understanding the challenge requirements.
- Planning the application structure and user flow.
- Writing and improving TypeScript/Next.js code.
- Debugging API and streaming issues.
- Designing the structured AI response format.
- Improving error handling and input validation.
- Reviewing and improving the UI/UX.
- Understanding errors returned by AI providers and APIs.

Main AI tools used:

- ChatGPT
- Groq API
- AI-assisted coding and debugging

---

## 2. How AI Helped

AI was mainly used as a development assistant rather than simply generating the entire application.

AI helped me:

1. Plan the architecture of the application.
2. Understand how the frontend communicates with the backend API.
3. Implement the PDF upload and document processing flow.
4. Implement the AI question-answering feature.
5. Implement streaming responses from the AI API.
6. Design a structured JSON response format.
7. Debug API errors and invalid AI responses.
8. Improve validation and error handling.
9. Review the code and identify possible issues.
10. Improve the user interface and overall user experience.

The final application was tested manually to verify that the implemented features worked correctly.

---

## 3. Development Process

### Step 1 – Define the Problem

The goal was to build an AI research workspace where users can upload PDF documents and ask questions about the uploaded content.

The application should answer questions using the uploaded documents rather than relying on unrelated external information.

---

### Step 2 – Build the Document Upload Flow

The application was designed to allow users to:

- Upload PDF files.
- Upload multiple documents.
- Validate file type.
- Limit file size to 20 MB.
- Extract text from uploaded PDFs.
- Display uploaded documents in the workspace.
- Delete uploaded documents.

The extracted document content is then provided to the AI question-answering system.

---

### Step 3 – Build the AI API

A Next.js API route was created at:

`/api/chat`

The API receives:

- The user's question.
- The uploaded document contents.

The documents are combined into a context that is sent to the AI model.

The AI is instructed to use only the uploaded documents when answering the question.

---

### Step 4 – Structured AI Response

Instead of returning an unstructured text response, the AI was instructed to return a JSON object containing:

```json
{
  "summary": "string",
  "key_points": ["string"],
  "risks": ["string"],
  "actions": ["string"]
}