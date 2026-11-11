import { useState, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || isStreaming || disabled) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900/90 p-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="relative flex items-end rounded-2xl bg-slate-800/80 border border-slate-700/80 focus-within:border-orange-500/80 focus-within:ring-1 focus-within:ring-orange-500/50 transition-all p-2 shadow-inner">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Model unavailable..." : "Ask Prometheus... (Press Enter to send, Shift+Enter for newline)"}
            disabled={disabled || isStreaming}
            rows={1}
            className="w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none max-h-36 min-h-[44px]"
          />

          <div className="flex items-center gap-2 pb-1 pr-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span className="w-2 h-2 rounded-sm bg-white" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || disabled}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700/50 disabled:text-slate-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                Send
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-500">
          Prometheus runs locally via Ollama. Responses are generated directly on your machine.
        </p>
      </div>
    </div>
  );
}
