import { useState } from "react";
import type { ChatMessage } from "../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} my-3`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm ${
          isUser
            ? "bg-orange-600 text-white rounded-br-none"
            : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-none"
        }`}
      >
        <div className="flex items-center justify-between gap-4 mb-1 text-xs opacity-70">
          <span className="font-semibold">{isUser ? "You" : "Prometheus"}</span>
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && !message.content && (
            <span className="inline-flex gap-1 items-center py-1">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
            </span>
          )}
        </div>

        {!isUser && message.content && (
          <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
