"use client";

import {
  optimisticallySendMessage,
  useUIMessages,
} from "@convex-dev/agent/react";
import {
  ArrowsClockwise,
  CircleNotch,
  Gear,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";

import { api } from "../convex/_generated/api";

export function ChatInterface() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createThread = useMutation(api.chat.createChatThread);
  const sendMessage = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as unknown as any).chat.sendMessage,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages),
  );

  const messages = useUIMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as unknown as any).chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 30 },
  );
  const uiMessages = messages.results;
  const hasMessages = uiMessages.length > 0 || sending;

  useEffect(() => {
    const initThread = async () => {
      const existing = localStorage.getItem("db-query-thread-id");
      if (existing) {
        setThreadId(existing);
        return;
      }
      const newThreadId = await createThread({});
      localStorage.setItem("db-query-thread-id", newThreadId);
      setThreadId(newThreadId);
    };
    void initThread();
  }, [createThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [uiMessages, sending]);

  const handleSend = async () => {
    if (!input.trim() || sending || !threadId) return;
    const message = input.trim();
    setInput("");
    setSending(true);
    try {
      await sendMessage({ threadId, prompt: message });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleNewThread = async () => {
    localStorage.removeItem("db-query-thread-id");
    const newThreadId = await createThread({});
    localStorage.setItem("db-query-thread-id", newThreadId);
    setThreadId(newThreadId);
  };

  const isReady = !!threadId;

  // ── Empty / landing state ──────────────────────────────────────────────────
  if (!hasMessages) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center font-mono">
        {/* Title */}
        <div className="mb-10 select-none">
          <h1 className="text-[5.5rem] leading-none font-black tracking-tighter">
            <span className="text-zinc-600">AUTO</span>
            <span className="text-zinc-300">NET</span>
          </h1>
        </div>

        {/* Input card */}
        <div className="w-full max-w-[620px] px-4">
          <div
            className="relative bg-[#1c1c1c] border-l-[3px] border-l-orange-500 border-t border-r border-b border-t-zinc-800 border-r-zinc-800 border-b-zinc-800"
            style={{ borderRadius: "2px" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={'Ask anything... "Query the database"'}
              disabled={sending || !isReady}
              rows={2}
              className="w-full bg-transparent resize-none px-4 pt-3 pb-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none font-mono"
              autoFocus
            />

            {/* Bottom row */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNewThread}
                  disabled={!isReady}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
                  title="New conversation"
                >
                  <Gear weight="duotone" className="size-4" />
                </button>
                <span className="text-orange-500 text-xs">build</span>
                <span className="text-zinc-400 text-xs">Convex Agent</span>
                {!isReady && (
                  <span className="flex items-center gap-1 text-zinc-600 text-xs">
                    <CircleNotch className="size-3 animate-spin" />
                    connecting
                  </span>
                )}
              </div>

              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || !isReady || sending}
                className="text-zinc-500 hover:text-orange-400 transition-colors disabled:opacity-30"
              >
                <PaperPlaneRight weight="fill" className="size-4" />
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-2 text-right text-[11px] text-zinc-600 font-mono pr-0.5">
            <span className="text-zinc-400 font-semibold">enter</span>{" "}
            send&nbsp;&nbsp;
            <span className="text-zinc-400 font-semibold">
              shift+enter
            </span>{" "}
            newline&nbsp;&nbsp;
            <span className="text-zinc-400 font-semibold">ctrl+r</span> reset
          </div>
        </div>

        {/* Tip */}
        <div className="mt-10 text-[13px] font-mono text-zinc-500">
          <span className="text-orange-500">● </span>
          <span className="text-orange-400">Tip</span>
          <span className="text-zinc-500">
            {" "}
            Ask in plain English — no SQL required
          </span>
        </div>
      </div>
    );
  }

  // ── Active chat state ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col font-mono">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black tracking-tighter leading-none">
            <span className="text-zinc-600">AUTO</span>
            <span className="text-zinc-300">NET</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {!isReady && (
            <span className="flex items-center gap-1 text-zinc-600 text-xs">
              <CircleNotch className="size-3 animate-spin" />
              connecting
            </span>
          )}
          <button
            onClick={handleNewThread}
            disabled={!isReady}
            title="New conversation"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs border border-zinc-800 hover:border-zinc-600 px-2 py-1 disabled:opacity-40"
            style={{ borderRadius: "2px" }}
          >
            <ArrowsClockwise className="size-3" />
            new
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {uiMessages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] text-zinc-600 px-1">
                {isUser ? "you" : "autonet"}
              </span>
              <div
                className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed border ${
                  isUser
                    ? "bg-zinc-900 border-zinc-700 text-zinc-200 border-l-[3px] border-l-orange-500"
                    : "bg-[#161616] border-zinc-800 text-zinc-300 border-l-[3px] border-l-zinc-600"
                }`}
                style={{ borderRadius: "2px" }}
              >
                <MessageResponse className="text-[13px] [&_pre]:rounded-sm [&_code]:font-mono [&_p]:leading-relaxed [&_p:last-child]:mb-0">
                  {messageText(msg)}
                </MessageResponse>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] text-zinc-600 px-1">autonet</span>
            <div
              className="bg-[#161616] border border-zinc-800 border-l-[3px] border-l-zinc-600 px-3 py-2"
              style={{ borderRadius: "2px" }}
            >
              <span className="text-zinc-500 text-[13px] animate-pulse">
                thinking...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
        <div
          className="relative bg-[#1c1c1c] border-l-[3px] border-l-orange-500 border-t border-r border-b border-zinc-800"
          style={{ borderRadius: "2px" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'Ask anything... "Query the database"'}
            disabled={sending || !isReady}
            rows={2}
            className="w-full bg-transparent resize-none px-4 pt-3 pb-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none font-mono"
          />

          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <Gear weight="duotone" className="size-4 text-zinc-600" />
              <span className="text-orange-500 text-xs">build</span>
              <span className="text-zinc-500 text-xs">Convex Agent</span>
            </div>

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || !isReady || sending}
              className="text-zinc-500 hover:text-orange-400 transition-colors disabled:opacity-30"
            >
              <PaperPlaneRight weight="fill" className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-1.5 text-right text-[10px] text-zinc-700 font-mono">
          <span className="text-zinc-600">enter</span> send&nbsp;&nbsp;
          <span className="text-zinc-600">shift+enter</span> newline
        </div>
      </div>
    </div>
  );
}

interface MessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  role?: string;
  text?: string;
  content?: string;
  parts?: MessagePart[];
}

function messageText(message: UIMessage): string {
  if (typeof message?.text === "string" && message.text.length > 0) {
    return message.text;
  }
  if (typeof message?.content === "string" && message.content.length > 0) {
    return message.content;
  }
  if (Array.isArray(message?.parts)) {
    const text = message.parts
      .filter((part: MessagePart) => part.type === "text")
      .map((part: MessagePart) => part.text ?? "")
      .join("\n");
    if (text.length > 0) return text;
  }
  return "...";
}
