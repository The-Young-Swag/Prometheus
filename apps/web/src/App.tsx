import { ChatInput } from "./components/ChatInput";
import { Header } from "./components/Header";
import { MessageList } from "./components/MessageList";
import { useChat } from "./hooks/useChat";
import { useModelHealth } from "./hooks/useModelHealth";

export default function App() {
  const { health } = useModelHealth();
  const { messages, isStreaming, sendMessage, stop, clearMessages } = useChat();

  const isModelReady = health.status === "OK" && health.ollama === "connected";

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <Header
        health={health}
        onClear={clearMessages}
        hasMessages={messages.length > 0}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <MessageList
          messages={messages}
          onPromptSelect={(prompt) => void sendMessage(prompt)}
        />

        <ChatInput
          onSend={(text) => void sendMessage(text)}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={!isModelReady}
        />
      </main>
    </div>
  );
}
