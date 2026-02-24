'use client';

import {
  optimisticallySendMessage,
  useUIMessages,
} from '@convex-dev/agent/react';
import {
  Database,
  PaperPlaneRight,
  Terminal,
  CircleNotch,
  Robot,
  User,
  Sparkle,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../convex/_generated/api';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from './ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from './ui/input-group';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export function ChatInterface() {
  const [threadId, setThreadId] = useState<string | null>(null);

  const createThread = useMutation((api as any).chat.createChatThread);
  const sendMessage = useMutation((api as any).chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage((api as any).chat.listThreadMessages),
  );

  const messages = useUIMessages(
    (api as any).chat.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 30 },
  );
  const uiMessages = messages.results;

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initThread = async () => {
      const existing = localStorage.getItem('db-query-thread-id');
      if (existing) {
        setThreadId(existing);
        return;
      }

      const newThreadId = await createThread({});
      localStorage.setItem('db-query-thread-id', newThreadId);
      setThreadId(newThreadId);
    };

    void initThread();
  }, [createThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !threadId) return;

    const message = input.trim();
    setInput('');
    setSending(true);

    try {
      await sendMessage({ threadId, prompt: message });
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  const handleNewThread = async () => {
    localStorage.removeItem('db-query-thread-id');
    const newThreadId = await createThread({});
    localStorage.setItem('db-query-thread-id', newThreadId);
    setThreadId(newThreadId);
  };

  const isReady = !!threadId;

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-screen w-full flex-col bg-background">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Database weight="duotone" className="size-4 text-primary" />
              <span className="text-sm font-medium">Database Query Agent</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant={isReady ? 'secondary' : 'outline'} className="gap-1">
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

        {/* Messages area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-0 px-0">
            {uiMessages.length === 0 ? (
              <EmptyState />
            ) : (
              uiMessages.map((msg, index) => (
                <MessageRow
                  key={index}
                  role={msg.role}
                  text={messageText(msg)}
                  isLast={index === uiMessages.length - 1}
                />
              ))
            )}

            {sending && <ThinkingRow />}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Input footer */}
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <form onSubmit={handleSend}>
            <InputGroup className="h-auto rounded-none">
              <InputGroupAddon align="inline-start">
                <Terminal weight="duotone" className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your database..."
                disabled={sending || !isReady}
                className="py-2.5 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend(e as any);
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  disabled={sending || !input.trim() || !isReady}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground data-[disabled=false]:hover:text-foreground disabled:opacity-40"
                >
                  {sending ? (
                    <CircleNotch className="size-3.5 animate-spin" />
                  ) : (
                    <PaperPlaneRight weight="fill" className="size-3.5" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="mt-1.5 text-[10px] text-muted-foreground/60 pl-0.5">
              Press Enter to send &middot; natural language queries supported
            </p>
          </form>
        </div>
      </div>
    </TooltipProvider>
  );
}

function EmptyState() {
  const suggestions = [
    'Show all users created in the last 7 days',
    'Count records grouped by status',
    'Find the top 10 most active accounts',
    'List tables with row counts',
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-8 py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center border bg-muted">
          <Database weight="duotone" className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Query your database</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ask questions in plain English — no SQL required
          </p>
        </div>
      </div>

      <div className="w-full max-w-lg">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
          Try asking
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {suggestions.map((s) => (
            <div
              key={s}
              className="flex items-start gap-2 border bg-muted/30 px-3 py-2 text-left"
            >
              <Sparkle weight="duotone" className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  role,
  text,
  isLast,
}: {
  role: string;
  text: string;
  isLast: boolean;
}) {
  const isUser = role === 'user';

  return (
    <div
      className={`group flex gap-0 border-b transition-colors ${
        isUser
          ? 'bg-muted/20 hover:bg-muted/30'
          : 'bg-background hover:bg-muted/10'
      }`}
    >
      {/* Role gutter */}
      <div className="flex w-[52px] shrink-0 flex-col items-center pt-3.5 pb-3">
        <div
          className={`flex size-6 items-center justify-center border ${
            isUser
              ? 'border-border bg-background text-foreground'
              : 'border-primary/30 bg-primary/5 text-primary'
          }`}
        >
          {isUser ? (
            <User weight="fill" className="size-3" />
          ) : (
            <Robot weight="duotone" className="size-3" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 px-2 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {isUser ? 'You' : 'Agent'}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-xs/relaxed text-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex gap-0 border-b bg-background">
      {/* Role gutter */}
      <div className="flex w-[52px] shrink-0 flex-col items-center pt-3.5 pb-3">
        <div className="flex size-6 items-center justify-center border border-primary/30 bg-primary/5 text-primary">
          <Robot weight="duotone" className="size-3" />
        </div>
      </div>

      {/* Thinking indicator */}
      <div className="min-w-0 flex-1 px-2 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Agent
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

function messageText(message: any) {
  if (typeof message?.text === 'string' && message.text.length > 0) {
    return message.text;
  }

  if (typeof message?.content === 'string' && message.content.length > 0) {
    return message.content;
  }

  if (Array.isArray(message?.parts)) {
    const text = message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
    if (text.length > 0) return text;
  }

  return '...';
}
