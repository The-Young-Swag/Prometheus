import type { ModelHealth } from "../types/chat";

interface HeaderProps {
  health: ModelHealth;
  onClear: () => void;
  hasMessages: boolean;
}

export function Header({ health, onClear, hasMessages }: HeaderProps) {
  const isConnected = health.ollama === "connected" && health.status === "OK";

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20">
          🔥
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Prometheus</h1>
          <p className="text-xs text-slate-400">Local-first Personal AI Assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Model connection status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                : "bg-rose-500"
            }`}
          />
          <span className="text-slate-300">
            {isConnected ? health.model ?? "Model Connected" : "Ollama Offline"}
          </span>
        </div>

        {hasMessages && (
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>
    </header>
  );
}
