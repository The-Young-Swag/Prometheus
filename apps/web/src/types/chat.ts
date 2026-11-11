export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ModelHealth {
  status: "OK" | "unavailable" | "error" | "loading";
  ollama: "connected" | "disconnected";
  model?: string;
  availableModels?: string[];
  message?: string;
}
