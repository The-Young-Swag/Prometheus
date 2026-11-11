import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "../types/chat";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isStreaming) {
        return;
      }

      setError(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(errorData?.message ?? `Server returned HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body received from server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg,
            ),
          );
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
          ),
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User aborted the stream intentionally
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false, content: msg.content + " [Stopped]" }
                : msg,
            ),
          );
        } else {
          const errorMessage = err instanceof Error ? err.message : "Failed to generate response";
          setError(errorMessage);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    content: `⚠️ Error: ${errorMessage}`,
                  }
                : msg,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming],
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    if (isStreaming) {
      stop();
    }
    setMessages([]);
    setError(null);
  }, [isStreaming, stop]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stop,
    clearMessages,
  };
}
