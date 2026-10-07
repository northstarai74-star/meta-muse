"use client";

import * as React from "react";
import { Send, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CommandMessage = {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export function ChatCommandBar() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<CommandMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: CommandMessage = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      const assistantMessage: CommandMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: data.message || "No response received",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: CommandMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to send command"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Floating button to open chat */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg hover:bg-accent/90 transition-all"
        aria-label="Open command chat"
        title="Cmd+K"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat window */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-0 right-0 z-50 h-[600px] w-full max-w-md rounded-t-2xl border-l border-t bg-surface shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-4">
              <h2 className="font-semibold">Command Chat</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-surface-2"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-muted">
                  <div>
                    <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Start typing a command...</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.type === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs rounded-lg px-3 py-2 text-sm",
                        msg.type === "user"
                          ? "bg-accent text-accent-fg"
                          : "bg-surface-2 text-fg"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="bg-surface-2 text-fg rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a command..."
                  className="flex-1 rounded-xl border bg-bg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="rounded-xl bg-accent px-3 py-2 text-accent-fg hover:bg-accent/90 disabled:opacity-50 transition-all"
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
