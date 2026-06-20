"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/auth/auth-context";

interface Message {
  id: string;
  role: "user" | "cosmo";
  text: string;
  streaming?: boolean;
}

interface AITutorWidgetProps {
  lessonContext?: string;
  className?: string;
}

export function AITutorWidget({ lessonContext, className }: AITutorWidgetProps) {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "cosmo",
      text: "Hi! I'm Cosmo 🍈 — your AI tutor! Ask me anything about your lessons!",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const kidName = user?.displayName;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    const cosmoMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "cosmo",
      text: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, cosmoMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          lessonContext,
          kidName,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === cosmoMsg.id ? { ...m, text: fullText } : m
                )
              );
            }
          } catch {
            /* noop */
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === cosmoMsg.id ? { ...m, streaming: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === cosmoMsg.id
            ? { ...m, text: "Sorry, I had trouble responding. Try again! 🌟", streaming: false }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, lessonContext, kidName]);

  return (
    <div className={cn("fixed bottom-6 right-6 z-[300] flex flex-col items-end gap-3", className)}>
      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "w-[340px] max-h-[520px] flex flex-col",
              "bg-nb-bg [border:var(--nb-border)] [box-shadow:var(--nb-shadow-lg)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white [border-bottom:var(--nb-border)]">
              <div className="text-2xl ai-float">🍈</div>
              <div className="flex-1">
                <div className="font-display text-[0.75rem]">Cosmo</div>
                <div className="text-[0.65rem] font-semibold text-nb-green">● Đang online</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center [border:var(--nb-border)] bg-nb-pink cursor-pointer [box-shadow:2px_2px_0_var(--nb-black)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                aria-label="Đóng chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 nb-scrollbar" style={{ maxHeight: 340 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] px-3 py-2 text-sm font-medium leading-relaxed",
                    msg.role === "user"
                      ? "self-end bg-nb-black text-white [border:var(--nb-border)] rounded-[16px_16px_4px_16px] [box-shadow:3px_3px_0_var(--nb-orange)]"
                      : "self-start bg-white text-nb-black [border:var(--nb-border)] rounded-[16px_16px_16px_4px] [box-shadow:3px_3px_0_var(--nb-black)]"
                  )}
                >
                  {msg.text}
                  {msg.streaming && (
                    <span className="inline-block w-1 h-4 bg-nb-orange ml-0.5 animate-pulse" />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 bg-white [border-top:var(--nb-border)] flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Hỏi Cosmo bất cứ điều gì..."
                disabled={streaming}
                className="flex-1 px-3 py-2 bg-nb-bg [border:var(--nb-border-thin)] text-sm font-medium outline-none focus:[border:var(--nb-border)] transition-all"
                aria-label="Nội dung tin nhắn"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className={cn(
                  "w-10 h-10 flex items-center justify-center cursor-pointer",
                  "[border:var(--nb-border)] bg-nb-black text-white",
                  "[box-shadow:3px_3px_0_var(--nb-orange)]",
                  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:5px_5px_0_var(--nb-orange)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                  "transition-all duration-150"
                )}
                aria-label="Gửi tin nhắn"
              >
                {streaming ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-16 h-16 rounded-full text-3xl",
          "bg-gradient-to-br from-nb-purple to-nb-blue",
          "[border:4px_solid_var(--nb-black)] [box-shadow:var(--nb-shadow)]",
          "cursor-pointer ai-float",
          "hover:[box-shadow:var(--nb-shadow-lg)] hover:-translate-x-0.5 hover:-translate-y-0.5",
          "transition-all duration-150 flex items-center justify-center"
        )}
        aria-label="Mở gia sư AI Cosmo"
      >
        {open ? <X className="w-6 h-6 text-white" /> : "🍈"}
      </button>
    </div>
  );
}
