# ResearchAI

ResearchAI is an AI-powered research workspace that allows users to upload PDF documents and ask questions about their content.

The application extracts text from uploaded documents and sends the document content together with the user's question to an AI model. The AI response is returned as a structured result and displayed in a clean research-oriented interface.

---

## 1. Project Overview

ResearchAI is designed to help users quickly understand and analyze information contained in PDF documents.

Instead of manually searching through long documents, users can upload one or more PDF files and ask questions about their content.

The application focuses on document-based AI research, structured answers, streaming responses, and conversation management.

---

## 2. Problem

Reading and analyzing long documents can take a significant amount of time.

Users may need to:

- Find specific information inside documents.
- Summarize important content.
- Identify key points.
- Understand limitations or risks.
- Determine possible next actions.

ResearchAI provides an interface where users can upload documents and ask questions directly about their content.

---

## 3. Solution

The application provides a document-based AI research workflow:

1. User uploads one or more PDF documents.
2. The application extracts text from the PDF files.
3. Extracted document content is stored in the frontend application state.
4. User asks a question about the uploaded documents.
5. The frontend sends the question and document content to the backend API.
6. The backend sends the request to the Groq AI API.
7. The AI generates a structured response.
8. The response is streamed back to the frontend.
9. The frontend parses the response and displays it as:
   - Summary
   - Key Points
   - Risks & Limitations
   - Suggested Actions

---

## 4. Features

### Document Management

- Upload multiple PDF documents.
- Validate PDF file type.
- Validate file size.
- Extract text from PDF documents.
- Display document name, size, and page count.
- Delete uploaded documents.
- Persist uploaded documents using browser local storage.

### AI Question Answering

Users can ask questions based on uploaded documents.

The AI is instructed to use only the uploaded document content and avoid introducing information from outside the documents.

### Structured AI Response

AI responses are organized into four sections:

- Summary
- Key Points
- Risks & Limitations
- Suggested Actions

This makes the response easier to read than displaying raw AI-generated text.

### AI Streaming

The application uses streaming responses from the AI API.

The backend receives the AI response as a stream and forwards the generated content to the frontend.

The frontend reads the response stream and processes the final structured response.

### Conversation History

Users can:

- Create a new conversation.
- View previous conversations.
- Switch between conversations.
- Delete conversations.
- Persist conversations using browser local storage.

### Regenerate Response

Users can regenerate an AI response for an existing question.

### Copy Response

Users can copy the structured AI answer to the clipboard.

### Responsive Interface

The interface supports both desktop and mobile layouts.

---

## 5. Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Next.js API Routes
- TypeScript

### AI

- Groq API
- Groq SDK
- `openai/gpt-oss-20b`

### Document Processing

- PDF text extraction through the document parsing API

### Storage

- Browser Local Storage for conversations and uploaded document metadata/content

---

## 6. Architecture & Workflow

The main application workflow is:

```text
User
  |
  v
Next.js Frontend
  |
  +----------------------+
  |                      |
  v                      v
Upload PDF            Ask Question
  |                      |
  v                      v
/api/documents/parse   /api/chat
  |                      |
  v                      v
Extract PDF Text       Groq API
                         |
                         v
                  Streaming Response
                         |
                         v
                  Frontend Parser
                         |
                         v
                  Structured Answer
                         |
                         v
              Summary / Key Points /
              Risks / Suggested Actions