"use client";

import {
  optimisticallySendMessage,
  useUIMessages,
} from "@convex-dev/agent/react";
import { ArrowsClockwise, CircleNotch, Database } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { Fragment, useEffect, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
// ai-elements
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";

// shadcn ui
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "../convex/_generated/api";

const SUGGESTIONS = [
  "Show all users created this week",
  "Count records grouped by status",
  "Find top 10 most active accounts",
  "List tables with their row counts",
];

export function ChatInterface() {
  const [threadId, setThreadId] = useState<string | null>(null);

  const createThread = useMutation((api as any).chat.createChatThread);
  const sendMessage = useMutation(
    (api as any).chat.sendMessage,
  ).withOptimisticUpdate(
    optimisticallySendMessage((api as any).chat.listThreadMessages),
  );

  const messages = useUIMessages(
    (api as any).chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 30 },
  );
  const uiMessages = messages.results;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handlePromptInputSubmit = async (msg: PromptInputMessage) => {
    if (!msg.text?.trim() || sending || !threadId) return;

    const message = msg.text.trim();
    setInput("");
    setSending(true);

    try {
      await sendMessage({ threadId, prompt: message });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleNewThread = async () => {
    localStorage.removeItem("db-query-thread-id");
    const newThreadId = await createThread({});
    localStorage.setItem("db-query-thread-id", newThreadId);
    setThreadId(newThreadId);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (sending || !threadId) return;
    setSending(true);
    try {
      await sendMessage({ threadId, prompt: suggestion });
    } catch (err) {
      console.error("Failed to send suggestion:", err);
    } finally {
      setSending(false);
    }
  };

  const isReady = !!threadId;
  const status = sending ? "submitted" : "ready";

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-screen w-full flex-col bg-background">
        {/* ── Header bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Database weight="duotone" className="size-4 text-primary" />
              <span className="text-sm font-medium">Database Query Agent</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <Badge
              variant={isReady ? "secondary" : "outline"}
              className="gap-1.5"
            >
              {isReady ? (
                <>
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  ready
                </>
              ) : (
                <>
                  <CircleNotch className="size-3 animate-spin" />
                  connecting
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleNewThread}
                    disabled={!isReady}
                  >
                    <ArrowsClockwise className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">New conversation</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Messages ── */}
        <Conversation className="flex-1 min-h-0">
          <ConversationContent>
            {uiMessages.length === 0 && !sending ? (
              <ConversationEmptyState
                icon={
                  <Database weight="duotone" className="size-10 opacity-40" />
                }
                title="Query your database"
                description="Ask questions in plain English — no SQL required"
              ></ConversationEmptyState>
            ) : (
              <>
                {uiMessages.map((msg, index) => (
                  <Fragment key={index}>
                    <Message from={msg.role as "user" | "assistant"}>
                      <MessageContent>
                        <MessageResponse>{messageText(msg)}</MessageResponse>
                      </MessageContent>
                    </Message>
                  </Fragment>
                ))}

                {sending && (
                  <Message from="assistant">
                    <MessageContent>
                      <Shimmer duration={1.5}>Thinking...</Shimmer>
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* ── Input ── */}
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <PromptInput onSubmit={handlePromptInputSubmit} className="w-full">
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your database..."
                disabled={sending || !isReady}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit
                status={status as any}
                disabled={!input.trim() || !isReady}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-1.5 text-[10px] text-muted-foreground/60 pl-0.5">
            Enter to send &middot; Shift+Enter for new line &middot; natural
            language supported
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

function messageText(message: any): string {
  if (typeof message?.text === "string" && message.text.length > 0) {
    return message.text;
  }
  if (typeof message?.content === "string" && message.content.length > 0) {
    return message.content;
  }
  if (Array.isArray(message?.parts)) {
    const text = message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");
    if (text.length > 0) return text;
  }
  return "...";
}
