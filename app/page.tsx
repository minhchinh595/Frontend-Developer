"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

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

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const STORAGE_KEY =
  "research-ai-conversations";

const ACTIVE_CONVERSATION_KEY =
  "research-ai-active-conversation";

const DOCUMENTS_STORAGE_KEY =
  "research-ai-documents";

// =========================================
// EMPTY ANSWER
// =========================================

const createEmptyAnswer =
  (): StructuredAnswer => ({
    summary: "",
    key_points: [],
    risks: [],
    actions: [],
  });

// =========================================
// NORMALIZE AI ANSWER
// =========================================

const normalizeAnswer = (
  data: unknown
): StructuredAnswer => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return createEmptyAnswer();
  }

  const parsed =
    data as Record<string, unknown>;

  return {
    summary:
      typeof parsed.summary ===
      "string"
        ? parsed.summary.trim()
        : "",

    key_points:
      Array.isArray(
        parsed.key_points
      )
        ? parsed.key_points.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
        : [],

    risks:
      Array.isArray(
        parsed.risks
      )
        ? parsed.risks.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
        : [],

    actions:
      Array.isArray(
        parsed.actions
      )
        ? parsed.actions.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
        : [],
  };
};

// =========================================
// EXTRACT JSON
// =========================================

const extractJSON = (
  content: string
): unknown => {
  let text =
    content.trim();

  // Remove Markdown JSON block
  if (
    text.startsWith("```")
  ) {
    text = text
      .replace(
        /^```(?:json)?/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();
  }

  // Try complete JSON
  try {
    return JSON.parse(text);
  } catch {
    // Continue
  }

  // Try extracting JSON object
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
      return null;
    }
  }

  return null;
};

// =========================================
// READ STREAMING AI RESPONSE
// =========================================

const readStreamingAIResponse =
  async (
    response: Response,
    onProgress?: (
      text: string
    ) => void
  ): Promise<StructuredAnswer> => {
    if (!response.body) {
      throw new Error(
        "The AI response stream is not available."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let accumulated = "";

    try {
      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          break;
        }

        const chunk =
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        accumulated += chunk;

        onProgress?.(
          accumulated
        );
      }

      // Flush remaining UTF-8 characters
      accumulated +=
        decoder.decode();

      const parsed =
        extractJSON(
          accumulated
        );

      if (!parsed) {
        console.error(
          "Invalid streamed AI response:",
          accumulated
        );

        throw new Error(
          "The AI returned an invalid structured response."
        );
      }

      return normalizeAnswer(
        parsed
      );
    } finally {
      reader.releaseLock();
    }
  };

// =========================================
// HOME
// =========================================

export default function Home() {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    documents,
    setDocuments,
  ] =
    useState<DocumentItem[]>(
      []
    );

  const [
    isUploading,
    setIsUploading,
  ] =
    useState(false);

  const [
    question,
    setQuestion,
  ] =
    useState("");

  const [
    messages,
    setMessages,
  ] =
    useState<Message[]>([]);

  const [
    isAsking,
    setIsAsking,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    conversations,
    setConversations,
  ] =
    useState<Conversation[]>(
      []
    );

  const [
    activeConversationId,
    setActiveConversationId,
  ] =
    useState<
      string | null
    >(null);

  const [
    isStorageLoaded,
    setIsStorageLoaded,
  ] =
    useState(false);

  const [
    streamLength,
    setStreamLength,
  ] =
    useState(0);

  // =========================================
  // LOAD LOCAL STORAGE
  // =========================================

  useEffect(() => {
    try {
      const savedConversations =
        localStorage.getItem(
          STORAGE_KEY
        );

      let parsedConversations:
        Conversation[] = [];

      if (
        savedConversations
      ) {
        try {
          const parsed =
            JSON.parse(
              savedConversations
            );

          if (
            Array.isArray(
              parsed
            )
          ) {
            parsedConversations =
              parsed;

            setConversations(
              parsedConversations
            );
          }
        } catch (error) {
          console.error(
            "Failed to parse conversations:",
            error
          );
        }
      }

      const savedActiveId =
        localStorage.getItem(
          ACTIVE_CONVERSATION_KEY
        );

      if (savedActiveId) {
        const activeConversation =
          parsedConversations.find(
            (
              conversation
            ) =>
              conversation.id ===
              savedActiveId
          );

        if (
          activeConversation
        ) {
          setActiveConversationId(
            activeConversation.id
          );

          setMessages(
            activeConversation.messages
          );
        }
      } else if (
        parsedConversations.length >
        0
      ) {
        const latestConversation =
          parsedConversations[0];

        setActiveConversationId(
          latestConversation.id
        );

        setMessages(
          latestConversation.messages
        );

        localStorage.setItem(
          ACTIVE_CONVERSATION_KEY,
          latestConversation.id
        );
      }

      const savedDocuments =
        localStorage.getItem(
          DOCUMENTS_STORAGE_KEY
        );

      if (
        savedDocuments
      ) {
        try {
          const parsedDocuments =
            JSON.parse(
              savedDocuments
            );

          if (
            Array.isArray(
              parsedDocuments
            )
          ) {
            setDocuments(
              parsedDocuments
            );
          }
        } catch (error) {
          console.error(
            "Failed to parse documents:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Failed to load localStorage data:",
        error
      );
    } finally {
      setIsStorageLoaded(
        true
      );
    }
  }, []);

  // =========================================
  // SAVE CONVERSATIONS
  // =========================================

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          conversations
        )
      );
    } catch (error) {
      console.error(
        "Failed to save conversations:",
        error
      );
    }
  }, [
    conversations,
    isStorageLoaded,
  ]);

  // =========================================
  // SAVE ACTIVE CONVERSATION
  // =========================================

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }

    try {
      if (
        activeConversationId
      ) {
        localStorage.setItem(
          ACTIVE_CONVERSATION_KEY,
          activeConversationId
        );
      } else {
        localStorage.removeItem(
          ACTIVE_CONVERSATION_KEY
        );
      }
    } catch (error) {
      console.error(
        "Failed to save active conversation:",
        error
      );
    }
  }, [
    activeConversationId,
    isStorageLoaded,
  ]);

  // =========================================
  // SAVE DOCUMENTS
  // =========================================

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        DOCUMENTS_STORAGE_KEY,
        JSON.stringify(
          documents
        )
      );
    } catch (error) {
      console.error(
        "Failed to save documents:",
        error
      );
    }
  }, [
    documents,
    isStorageLoaded,
  ]);

  // =========================================
  // UPLOAD CLICK
  // =========================================

  const handleUploadClick =
    () => {
      fileInputRef.current?.click();
    };

  // =========================================
  // UPLOAD FILE
  // =========================================

  const handleFileChange =
    async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const files =
        event.target.files;

      if (
        !files ||
        files.length === 0
      ) {
        return;
      }

      setIsUploading(true);
      setError("");

      try {
        for (
          const file of Array.from(
            files
          )
        ) {
          if (
            file.type !==
            "application/pdf"
          ) {
            setError(
              `${file.name} is not a PDF file.`
            );

            continue;
          }

          if (
            file.size >
            20 *
              1024 *
              1024
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
                  method:
                    "POST",
                  body: formData,
                }
              );

            const data =
              await response.json();

            if (
              !response.ok
            ) {
              setError(
                data.error ||
                  `Failed to process ${file.name}.`
              );

              continue;
            }

            const newDocument:
              DocumentItem =
              {
                id: crypto.randomUUID(),

                name: file.name,

                size: file.size,

                type: file.type,

                content:
                  data.text,

                pageCount:
                  data.pageCount,
              };

            setDocuments(
              (
                current
              ) => [
                ...current,
                newDocument,
              ]
            );
          } catch (
            error
          ) {
            console.error(
              error
            );

            setError(
              `Could not process ${file.name}.`
            );
          }
        }
      } finally {
        setIsUploading(
          false
        );

        event.target.value =
          "";
      }
    };

  // =========================================
  // DELETE DOCUMENT
  // =========================================

  const handleDeleteDocument =
    (
      documentId: string
    ) => {
      if (isAsking) {
        return;
      }

      const documentToDelete =
        documents.find(
          (
            document
          ) =>
            document.id ===
            documentId
        );

      if (
        !documentToDelete
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete "${documentToDelete.name}"?`
        );

      if (!confirmed) {
        return;
      }

      setDocuments(
        (current) =>
          current.filter(
            (
              document
            ) =>
              document.id !==
              documentId
          )
      );

      setError("");
    };

  // =========================================
  // CREATE CONVERSATION
  // =========================================

  const createConversation =
    (
      firstQuestion: string
    ) => {
      const id =
        crypto.randomUUID();

      const title =
        firstQuestion.length >
        40
          ? `${firstQuestion.slice(
              0,
              40
            )}...`
          : firstQuestion;

      const conversation:
        Conversation =
        {
          id,

          title,

          createdAt:
            Date.now(),

          messages: [],
        };

      setConversations(
        (current) => [
          conversation,
          ...current,
        ]
      );

      setActiveConversationId(
        id
      );

      return id;
    };

  // =========================================
  // UPDATE CONVERSATION
  // =========================================

  const updateConversationMessages =
    (
      conversationId: string,
      updatedMessages: Message[]
    ) => {
      setConversations(
        (current) =>
          current.map(
            (
              conversation
            ) =>
              conversation.id ===
              conversationId
                ? {
                    ...conversation,
                    messages:
                      updatedMessages,
                  }
                : conversation
          )
      );
    };

  // =========================================
  // GET AI RESPONSE
  // =========================================

  const requestAI =
    async (
      userQuestion: string,
      onProgress?: (
        length: number
      ) => void
    ) => {
      const response =
        await fetch(
          "/api/chat",
          {
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
                  (
                    document
                  ) => ({
                    name:
                      document.name,

                    content:
                      document.content,
                  })
                ),
            }),
          }
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        let errorMessage =
          "Failed to get AI response.";

        try {
          const errorData =
            JSON.parse(
              errorText
            );

          errorMessage =
            errorData.error ||
            errorMessage;
        } catch {
          errorMessage =
            errorText ||
            errorMessage;
        }

        throw new Error(
          errorMessage
        );
      }

      return readStreamingAIResponse(
        response,
        (text) => {
          onProgress?.(
            text.length
          );
        }
      );
    };

  // =========================================
  // ASK AI
  // =========================================

  const handleAskAI =
    async (
      questionOverride?: string
    ) => {
      const currentQuestion =
        questionOverride ?? question;

      if (
        !currentQuestion.trim()
      ) {
        return;
      }

      if (
        documents.length === 0
      ) {
        setError(
          "Please upload at least one document first."
        );

        return;
      }

      if (isAsking) {
        return;
      }

      setError("");
      setIsAsking(true);
      setStreamLength(0);

      const userQuestion =
        currentQuestion.trim();

      let conversationId =
        activeConversationId;

      if (!conversationId) {
        conversationId =
          createConversation(
            userQuestion
          );
      }

      const userMessage:
        Message = {
        id: crypto.randomUUID(),

        role: "user",

        content:
          userQuestion,
      };

      const updatedMessages =
        [
          ...messages,
          userMessage,
        ];

      setMessages(
        updatedMessages
      );

      setQuestion("");

      const assistantId =
        crypto.randomUUID();

      const assistantMessage:
        Message = {
        id: assistantId,

        role: "assistant",

        answer:
          createEmptyAnswer(),
      };

      const messagesWithAssistant =
        [
          ...updatedMessages,
          assistantMessage,
        ];

      setMessages(
        messagesWithAssistant
      );

      updateConversationMessages(
        conversationId,
        messagesWithAssistant
      );

      try {
        const finalAnswer =
          await requestAI(
            userQuestion,
            (
              length
            ) => {
              setStreamLength(
                length
              );
            }
          );

        const finalMessages =
          messagesWithAssistant.map(
            (
              message
            ) =>
              message.id ===
              assistantId
                ? {
                    ...message,
                    answer:
                      finalAnswer,
                  }
                : message
          );

        setMessages(
          finalMessages
        );

        updateConversationMessages(
          conversationId,
          finalMessages
        );
      } catch (
        error
      ) {
        console.error(
          "AI request failed:",
          error
        );

        setMessages(
          updatedMessages
        );

        updateConversationMessages(
          conversationId,
          updatedMessages
        );

        setError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setIsAsking(false);
        setStreamLength(0);
      }
    };

  // =========================================
  // REGENERATE
  // =========================================

  const handleRegenerate =
    async (
      assistantMessageId: string
    ) => {
      if (isAsking) {
        return;
      }

      const assistantIndex =
        messages.findIndex(
          (
            message
          ) =>
            message.id ===
            assistantMessageId
        );

      if (
        assistantIndex === -1
      ) {
        return;
      }

      let userQuestion =
        "";

      for (
        let index =
          assistantIndex - 1;
        index >= 0;
        index--
      ) {
        if (
          messages[index]
            .role ===
          "user"
        ) {
          userQuestion =
            messages[index]
              .content ||
            "";

          break;
        }
      }

      if (!userQuestion) {
        setError(
          "Could not find the question for this answer."
        );

        return;
      }

      if (
        documents.length === 0
      ) {
        setError(
          "Please upload at least one document first."
        );

        return;
      }

      setError("");
      setIsAsking(true);
      setStreamLength(0);

      const newAssistantId =
        crypto.randomUUID();

      const temporaryMessages =
        messages.map(
          (
            message,
            index
          ) =>
            index ===
            assistantIndex
              ? {
                  id:
                    newAssistantId,

                  role:
                    "assistant" as const,

                  answer:
                    createEmptyAnswer(),
                }
              : message
        );

      setMessages(
        temporaryMessages
      );

      if (
        activeConversationId
      ) {
        updateConversationMessages(
          activeConversationId,
          temporaryMessages
        );
      }

      try {
        const finalAnswer =
          await requestAI(
            userQuestion,
            (
              length
            ) => {
              setStreamLength(
                length
              );
            }
          );

        const finalMessages =
          temporaryMessages.map(
            (
              message
            ) =>
              message.id ===
              newAssistantId
                ? {
                    ...message,
                    answer:
                      finalAnswer,
                  }
                : message
          );

        setMessages(
          finalMessages
        );

        if (
          activeConversationId
        ) {
          updateConversationMessages(
            activeConversationId,
            finalMessages
          );
        }
      } catch (
        error
      ) {
        console.error(
          "Regenerate failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to regenerate answer."
        );
      } finally {
        setIsAsking(false);
        setStreamLength(0);
      }
    };

  // =========================================
  // NEW CHAT
  // =========================================

  const handleNewChat =
    () => {
      if (isAsking) {
        return;
      }

      setMessages([]);
      setQuestion("");
      setError("");
      setActiveConversationId(
        null
      );
    };

  // =========================================
  // SELECT CONVERSATION
  // =========================================

  const handleSelectConversation =
    (
      conversation: Conversation
    ) => {
      if (isAsking) {
        return;
      }

      setActiveConversationId(
        conversation.id
      );

      setMessages(
        conversation.messages
      );

      setQuestion("");
      setError("");
    };

  // =========================================
  // DELETE CONVERSATION
  // =========================================

  const handleDeleteConversation =
    (
      conversationId: string
    ) => {
      if (isAsking) {
        return;
      }

      setConversations(
        (current) =>
          current.filter(
            (
              conversation
            ) =>
              conversation.id !==
              conversationId
          )
      );

      if (
        activeConversationId ===
        conversationId
      ) {
        setActiveConversationId(
          null
        );

        setMessages([]);
        setQuestion("");
        setError("");
      }
    };

  // =========================================
  // ENTER
  // =========================================

  const handleKeyDown =
    (
      event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        handleAskAI();
      }
    };

  // =========================================
  // COPY
  // =========================================

  const handleCopy =
    async (
      answer: StructuredAnswer
    ) => {
      const text = `
SUMMARY

${answer.summary}

KEY POINTS

${
  answer.key_points.length >
  0
    ? answer.key_points
        .map(
          (
            point
          ) =>
            `• ${point}`
        )
        .join("\n")
    : "No key points."
}

RISKS & LIMITATIONS

${
  answer.risks.length >
  0
    ? answer.risks
        .map(
          (
            risk
          ) =>
            `• ${risk}`
        )
        .join("\n")
    : "No risks or limitations."
}

SUGGESTED ACTIONS

${
  answer.actions.length >
  0
    ? answer.actions
        .map(
          (
            action
          ) =>
            `• ${action}`
        )
        .join("\n")
    : "No suggested actions."
}
`;

      try {
        await navigator.clipboard.writeText(
          text.trim()
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setError(
          "Could not copy the answer."
        );
      }
    };

  // =========================================
  // FILE SIZE
  // =========================================

  const formatFileSize =
    (
      bytes: number
    ) => {
      if (
        bytes < 1024
      ) {
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
  // ANSWER UI
  // =========================================

  const renderAnswer =
    (
      answer: StructuredAnswer,
      messageId: string
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

            {answer.summary ? (
              <p className="text-sm leading-7 text-slate-300">
                {
                  answer.summary
                }
              </p>
            ) : (
              <div className="text-sm text-slate-500">
                No summary available.
              </div>
            )}

          </div>

          {/* KEY POINTS */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">
                🔑
              </span>

              <h4 className="font-semibold">
                Key Points
              </h4>
            </div>

            {answer.key_points.length >
            0 ? (
              <ul className="space-y-2">

                {answer.key_points.map(
                  (
                    point,
                    index
                  ) => (
                    <li
                      key={
                        index
                      }
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
            ) : (
              <p className="text-sm text-slate-500">
                No key points available.
              </p>
            )}

          </div>

          {/* RISKS */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">
                ⚠️
              </span>

              <h4 className="font-semibold">
                Risks & Limitations
              </h4>
            </div>

            {answer.risks.length >
            0 ? (
              <ul className="space-y-2">

                {answer.risks.map(
                  (
                    risk,
                    index
                  ) => (
                    <li
                      key={
                        index
                      }
                      className="flex gap-3 text-sm leading-6 text-slate-300"
                    >
                      <span>
                        •
                      </span>

                      <span>
                        {risk}
                      </span>
                    </li>
                  )
                )}

              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No risks or limitations identified.
              </p>
            )}

          </div>

          {/* ACTIONS */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">
                ✓
              </span>

              <h4 className="font-semibold">
                Suggested Actions
              </h4>
            </div>

            {answer.actions.length >
            0 ? (
              <ul className="space-y-2">

                {answer.actions.map(
                  (
                    action,
                    index
                  ) => (
                    <li
                      key={
                        index
                      }
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
            ) : (
              <p className="text-sm text-slate-500">
                No suggested actions.
              </p>
            )}

          </div>

          {/* ACTION BUTTONS */}

          <div className="flex gap-2 pt-1">

            <button
              onClick={() =>
                handleCopy(
                  answer
                )
              }
              disabled={
                isAsking
              }
              className="rounded-md px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              ⧉ Copy
            </button>

            <button
              onClick={() =>
                handleRegenerate(
                  messageId
                )
              }
              disabled={
                isAsking
              }
              className="rounded-md px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
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

        {/* FILE INPUT */}

        <input
          ref={
            fileInputRef
          }
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={
            handleFileChange
          }
        />

        {/* SIDEBAR */}

        <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-slate-900 md:flex md:flex-col">

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
                handleNewChat
              }
              disabled={
                isAsking
              }
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40"
            >
              + New chat
            </button>

          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">

            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              Conversation History
            </p>

            {conversations.length ===
            0 ? (
              <div className="rounded-lg px-3 py-3 text-sm text-slate-500">
                No conversations yet.
              </div>
            ) : (
              <div className="space-y-1">

                {conversations.map(
                  (
                    conversation
                  ) => (
                    <div
                      key={
                        conversation.id
                      }
                      className={`group flex items-center gap-1 rounded-lg transition ${
                        activeConversationId ===
                        conversation.id
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                    >

                      <button
                        onClick={() =>
                          handleSelectConversation(
                            conversation
                          )
                        }
                        disabled={
                          isAsking
                        }
                        className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-40"
                      >

                        <p className="truncate text-sm text-slate-200">
                          {
                            conversation.title
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          {
                            conversation
                              .messages
                              .length
                          }{" "}
                          messages
                        </p>

                      </button>

                      <button
                        onClick={() =>
                          handleDeleteConversation(
                            conversation.id
                          )
                        }
                        disabled={
                          isAsking
                        }
                        className="mr-2 rounded p-1 text-xs text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20"
                        title="Delete conversation"
                      >
                        ×
                      </button>

                    </div>
                  )
                )}

              </div>
            )}

          </div>

          {/* DOCUMENTS */}

          <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-white/10 p-4">

            <button
              onClick={
                handleUploadClick
              }
              disabled={
                isUploading ||
                isAsking
              }
              className="mb-4 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {isUploading
                ? "Processing..."
                : "+ Upload document"}
            </button>

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
                  (
                    document
                  ) => (
                    <div
                      key={
                        document.id
                      }
                      className="group rounded-lg border border-white/5 bg-white/[0.03] p-3"
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

                        <button
                          onClick={() =>
                            handleDeleteDocument(
                              document.id
                            )
                          }
                          disabled={
                            isAsking
                          }
                          title="Delete document"
                          className="shrink-0 rounded p-1 text-xs text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20"
                        >
                          ×
                        </button>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </div>

        </aside>

        {/* MAIN */}

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* HEADER */}

          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-5">

            <div>

              <h2 className="font-medium">
                AI Research
              </h2>

              <p className="hidden text-xs text-slate-500 sm:block">
                Research from your uploaded documents
              </p>

            </div>

            <div className="flex items-center gap-2">

              <button
                onClick={
                  handleUploadClick
                }
                disabled={
                  isUploading ||
                  isAsking
                }
                className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5 disabled:opacity-50 md:hidden"
              >
                {isUploading
                  ? "..."
                  : "📄"}
              </button>

              <button
                onClick={
                  handleNewChat
                }
                disabled={
                  isAsking
                }
                className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5 disabled:opacity-40"
              >
                + New chat
              </button>

            </div>

          </header>

          {/* MOBILE DOCUMENTS */}

          {documents.length >
            0 && (
            <div className="border-b border-white/10 px-4 py-3 md:hidden">

              <div className="flex gap-2 overflow-x-auto">

                {documents.map(
                  (
                    document
                  ) => (
                    <div
                      key={
                        document.id
                      }
                      className="group flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                    >

                      <span>
                        📄
                      </span>

                      <span className="max-w-40 truncate text-xs text-slate-300">
                        {
                          document.name
                        }
                      </span>

                      <button
                        onClick={() =>
                          handleDeleteDocument(
                            document.id
                          )
                        }
                        disabled={
                          isAsking
                        }
                        title="Delete document"
                        className="ml-1 rounded px-1 text-xs text-slate-500 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-20"
                      >
                        ×
                      </button>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* CHAT */}

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
                      isUploading ||
                      isAsking
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
                  (
                    message
                  ) => (

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
                              message.answer,
                              message.id
                            )}

                        </div>

                      )}

                    </div>
                  )
                )}

                {isAsking && (

                  <div className="flex justify-start">

                    <div className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-sm text-slate-400">

                      <div className="flex items-center gap-2">

                        <span className="animate-pulse">
                          ✦
                        </span>

                        <span>
                          AI is researching...
                        </span>

                      </div>

                      {streamLength >
                        0 && (
                        <p className="mt-2 text-xs text-slate-600">
                          Receiving AI response...
                        </p>
                      )}

                    </div>

                  </div>
                )}

              </div>
            )}

          </div>

          {/* ERROR */}

          {error && (

            <div className="mx-auto w-full max-w-4xl px-4 pb-2">

              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>

            </div>
          )}

          {/* INPUT */}

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
                onClick={() =>
                  handleAskAI()
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
              AI answers are based on your uploaded documents.
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}