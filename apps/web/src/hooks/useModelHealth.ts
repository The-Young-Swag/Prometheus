import { useCallback, useEffect, useState } from "react";
import type { ModelHealth } from "../types/chat";

export function useModelHealth() {
  const [health, setHealth] = useState<ModelHealth>({
    status: "loading",
    ollama: "disconnected",
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/health/model");
      const data = (await response.json()) as ModelHealth;
      setHealth(data);
    } catch (error) {
      setHealth({
        status: "unavailable",
        ollama: "disconnected",
        message: error instanceof Error ? error.message : "Failed to reach server",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return {
    health,
    isLoading,
    checkHealth,
  };
}
