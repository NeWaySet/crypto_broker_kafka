import { useEffect } from "react";
import type { Message } from "../types";

interface KeyboardShortcutsOptions {
  selectedMessageId: string | null;
  messages: Message[];
  currentUserId?: string;
  onCloseTransientUi: () => void;
  onEditOwnMessage: (messageId: string) => void;
}

export function useKeyboardShortcuts({
  selectedMessageId,
  messages,
  currentUserId,
  onCloseTransientUi,
  onEditOwnMessage,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;

      if (command && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-chat-search]")?.focus();
      }

      if (event.key === "Escape") {
        onCloseTransientUi();
      }

      if (command && event.key.toLowerCase() === "e" && selectedMessageId) {
        const message = messages.find((item) => item.id === selectedMessageId);
        if (message && message.senderId === currentUserId) onEditOwnMessage(message.id);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentUserId, messages, onCloseTransientUi, onEditOwnMessage, selectedMessageId]);
}
