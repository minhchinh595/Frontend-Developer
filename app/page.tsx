"use client";

import { useRef, useState } from "react";

type DocumentItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  pageCount?: number;
};

type StructuredAnswer = {
  summary: string;
  key_points: string[];
  risks: string[];
  actions: string[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content?: string;
  answer?: StructuredAnswer;
};

export default function Home() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [question, setQuestion] =
    useState("");

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [isAsking, setIsAsking] =
    useState(false);

  const [error, setError] =
    useState("");

  // =========================================
  // OPEN FILE SELECTOR
  // =========================================

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // =========================================
  // UPLOAD FILE
  // =========================================

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      for (const file of Array.from(files)) {
        // Only PDF
        if (file.type !== "application/pdf") {
          setError(
            `${file.name} is not a PDF file.`
          );

          continue;
        }

        // 20MB limit
        if (
          file.size >
          20 * 1024 * 1024
        ) {
          setError(
            `${file.name} is larger than 20 MB.`
          );

          continue;
        }

        try {
          const formData =
            new FormData();

          formData.append(
            "file",
            file
          );

          const response =
            await fetch(
              "/api/documents/parse",
              {
                method: "POST",
                body: formData,
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            setError(
              data.error ||
                `Failed to process ${file.name}.`
            );

            continue;
          }

          const newDocument: DocumentItem =
            {
              id: crypto.randomUUID(),

              name: file.name,

              size: file.size,

              type: file.type,

              content: data.text,

              pageCount:
                data.pageCount,
            };

          setDocuments(
            (current) => [
              ...current,
              newDocument,
            ]
          );
        } catch (error) {
          console.error(error);

          setError(
            `Could not process ${file.name}.`
          );
        }
      }
    } finally {
      setIsUploading(false);

      event.target.value = "";
    }
  };

  // =========================================
  // ASK AI
  // =========================================

  const handleAskAI = async () => {
    if (!question.trim()) {
      return;
    }

    if (documents.length === 0) {
      setError(
        "Please upload at least one document first."
      );

      return;
    }

    setError("");
    setIsAsking(true);

    const userQuestion =
      question.trim();

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),

      role: "user",

      content: userQuestion,
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );

    setQuestion("");

    try {
      const response =
        await fetch("/api/chat", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            question:
              userQuestion,

            documents:
              documents.map(
                (document) => ({
                  name:
                    document.name,

                  content:
                    document.content,
                })
              ),
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to get AI response."
        );
      }

      // =====================================
      // STRUCTURED ANSWER
      // =====================================

      const assistantMessage:
        Message = {
          id: crypto.randomUUID(),

          role: "assistant",

          answer: data.answer,
        };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ]
      );
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setIsAsking(false);
    }
  };

  // =========================================
  // ENTER KEY
  // =========================================

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleAskAI();
    }
  };

  // =========================================
  // COPY ANSWER
  // =========================================

  const handleCopy = async (
    answer: StructuredAnswer
  ) => {
    const text = `
SUMMARY

${answer.summary}

KEY POINTS

${answer.key_points
  .map(
    (point) => `• ${point}`
  )
  .join("\n")}

RISKS

${answer.risks
  .map(
    (risk) => `• ${risk}`
  )
  .join("\n")}

ACTIONS

${answer.actions
  .map(
    (action) => `• ${action}`
  )
  .join("\n")}
`;

    try {
      await navigator.clipboard.writeText(
        text.trim()
      );
    } catch (error) {
      console.error(error);
    }
  };

  // =========================================
  // REGENERATE
  // =========================================

  const handleRegenerate = async () => {
    const lastUserMessage =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "user"
        );

    if (!lastUserMessage?.content) {
      return;
    }

    setQuestion(
      lastUserMessage.content
    );

    setTimeout(() => {
      handleAskAI();
    }, 0);
  };

  // =========================================
  // NEW CHAT
  // =========================================

  const handleNewChat = () => {
    setMessages([]);
    setQuestion("");
    setError("");
  };

  // =========================================
  // FILE SIZE
  // =========================================

  const formatFileSize = (
    bytes: number
  ) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };

  // =========================================
  // STRUCTURED ANSWER UI
  // =========================================

  const renderAnswer = (
    answer: StructuredAnswer
  ) => {
    return (
      <div className="space-y-4">

        {/* SUMMARY */}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

          <div className="mb-3 flex items-center gap-2">

            <span className="text-lg">
              ✨
            </span>

            <h4 className="font-semibold">
              Summary
            </h4>

          </div>

          <p className="text-sm leading-7 text-slate-300">
            {answer.summary}
          </p>

        </div>

        {/* KEY POINTS */}

        {answer.key_points.length >
          0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">

              <span className="text-lg">
                🔑
              </span>

              <h4 className="font-semibold">
                Key Points
              </h4>

            </div>

            <ul className="space-y-2">

              {answer.key_points.map(
                (
                  point,
                  index
                ) => (
                  <li
                    key={index}
                    className="flex gap-3 text-sm leading-6 text-slate-300"
                  >
                    <span className="mt-1 text-blue-400">
                      •
                    </span>

                    <span>
                      {point}
                    </span>
                  </li>
                )
              )}

            </ul>

          </div>
        )}

        {/* RISKS */}

        {answer.risks.length >
          0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">

              <span className="text-lg">
                ⚠️
              </span>

              <h4 className="font-semibold">
                Risks & Limitations
              </h4>

            </div>

            <ul className="space-y-2">

              {answer.risks.map(
                (
                  risk,
                  index
                ) => (
                  <li
                    key={index}
                    className="flex gap-3 text-sm leading-6 text-slate-300"
                  >
                    <span className="mt-1">
                      •
                    </span>

                    <span>
                      {risk}
                    </span>
                  </li>
                )
              )}

            </ul>

          </div>
        )}

        {/* ACTIONS */}

        {answer.actions.length >
          0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">

              <span className="text-lg">
                ✓
              </span>

              <h4 className="font-semibold">
                Suggested Actions
              </h4>

            </div>

            <ul className="space-y-2">

              {answer.actions.map(
                (
                  action,
                  index
                ) => (
                  <li
                    key={index}
                    className="flex gap-3 text-sm leading-6 text-slate-300"
                  >
                    <span className="mt-1 text-green-400">
                      •
                    </span>

                    <span>
                      {action}
                    </span>
                  </li>
                )
              )}

            </ul>

          </div>
        )}

        {/* ACTION BUTTONS */}

        <div className="flex gap-2 pt-1">

          <button
            onClick={() =>
              handleCopy(answer)
            }
            className="rounded-md px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ⧉ Copy
          </button>

          <button
            onClick={
              handleRegenerate
            }
            className="rounded-md px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ↻ Regenerate
          </button>

        </div>

      </div>
    );
  };

  // =========================================
  // UI
  // =========================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      <div className="flex min-h-screen">

        {/* =====================================
            FILE INPUT
        ===================================== */}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={
            handleFileChange
          }
        />

        {/* =====================================
            SIDEBAR
        ===================================== */}

        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-900 md:block">

          <div className="border-b border-white/10 p-5">

            <h1 className="text-lg font-semibold">
              ✦ ResearchAI
            </h1>

            <p className="mt-1 text-xs text-slate-400">
              AI Research Workspace
            </p>

          </div>

          <div className="p-4">

            <button
              onClick={
                handleUploadClick
              }
              disabled={
                isUploading
              }
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {isUploading
                ? "Processing..."
                : "+ Upload document"}
            </button>

          </div>

          <div className="px-4">

            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              Documents
            </p>

            {documents.length ===
            0 ? (
              <div className="rounded-lg px-3 py-2 text-sm text-slate-400">
                📄 No documents yet
              </div>
            ) : (
              <div className="space-y-2">

                {documents.map(
                  (document) => (
                    <div
                      key={
                        document.id
                      }
                      className="rounded-lg border border-white/5 bg-white/[0.03] p-3"
                    >

                      <div className="flex items-start gap-2">

                        <span>
                          📄
                        </span>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm text-slate-200">
                            {
                              document.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">

                            {formatFileSize(
                              document.size
                            )}

                            {document.pageCount
                              ? ` · ${document.pageCount} pages`
                              : ""}

                          </p>

                        </div>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </div>

        </aside>

        {/* =====================================
            MAIN
        ===================================== */}

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* HEADER */}

          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">

            <h2 className="font-medium">
              AI Research
            </h2>

            <button
              onClick={
                handleNewChat
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
            >
              + New chat
            </button>

          </header>

          {/* =================================
              CHAT
          ================================= */}

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">

            {messages.length ===
            0 ? (

              <div className="flex min-h-[60vh] items-center justify-center">

                <div className="max-w-lg text-center">

                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                    ✦
                  </div>

                  <h3 className="text-2xl font-semibold">
                    {documents.length ===
                    0
                      ? "Start your research"
                      : "Your documents are ready"}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-400">

                    {documents.length ===
                    0
                      ? "Upload one or more documents and ask AI questions about their content."
                      : "Ask a question about the documents you uploaded."}

                  </p>

                  <button
                    onClick={
                      handleUploadClick
                    }
                    disabled={
                      isUploading
                    }
                    className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    {isUploading
                      ? "Processing..."
                      : documents.length ===
                        0
                      ? "Upload your first document"
                      : "Upload another document"}
                  </button>

                </div>

              </div>

            ) : (

              <div className="mx-auto max-w-4xl space-y-6">

                {messages.map(
                  (message) => (

                    <div
                      key={
                        message.id
                      }
                      className={
                        message.role ===
                        "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >

                      {message.role ===
                      "user" ? (

                        <div className="max-w-[85%] rounded-2xl bg-blue-600 px-4 py-3 text-sm leading-6">

                          {
                            message.content
                          }

                        </div>

                      ) : (

                        <div className="w-full max-w-[90%] rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5">

                          {message.answer &&
                            renderAnswer(
                              message.answer
                            )}

                        </div>

                      )}

                    </div>

                  )
                )}

                {isAsking && (

                  <div className="flex justify-start">

                    <div className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-sm text-slate-400">

                      <span className="animate-pulse">
                        AI is thinking...
                      </span>

                    </div>

                  </div>

                )}

              </div>

            )}

          </div>

          {/* =================================
              ERROR
          ================================= */}

          {error && (

            <div className="mx-auto w-full max-w-4xl px-4 pb-2">

              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">

                {error}

              </div>

            </div>

          )}

          {/* =================================
              INPUT
          ================================= */}

          <div className="border-t border-white/10 p-3 sm:p-4">

            <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-xl border border-white/10 bg-slate-900 p-2">

              <textarea
                value={
                  question
                }
                onChange={(
                  event
                ) =>
                  setQuestion(
                    event.target
                      .value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  documents.length ===
                  0
                    ? "Upload a document first..."
                    : "Ask something about your documents..."
                }
                disabled={
                  documents.length ===
                    0 ||
                  isAsking
                }
                className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                onClick={
                  handleAskAI
                }
                disabled={
                  documents.length ===
                    0 ||
                  !question.trim() ||
                  isAsking
                }
                className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isAsking
                  ? "..."
                  : "↑"}
              </button>

            </div>

            <p className="mt-2 text-center text-xs text-slate-600">
              AI answers are based on your uploaded
              documents.
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}