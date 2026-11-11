import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  onPromptSelect: (prompt: string) => void;
}

export function MessageList({ messages, onPromptSelect }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-3xl mb-4 shadow-inner">
          🔥
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Welcome to Prometheus</h2>
        <p className="text-sm text-slate-400 max-w-md mb-8">
          Your personal local-first AI assistant powered by your local Ollama runtime. Try asking a question to get started.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg text-left">
          {[
            "Explain what an API is in simple terms.",
            "Write a Python script to find prime numbers.",
            "How does local LLM inference work on a GPU?",
            "Suggest 3 high-impact habits for software engineers.",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-orange-500/50 text-xs text-slate-300 hover:text-white transition-all text-left"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
      <div className="max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
