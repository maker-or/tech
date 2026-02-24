'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useState, useRef, useEffect } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { PaperPlaneRight, Database } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';

export function ChatInterface() {
  // Use a hardcoded generic userId for this minimal example
  const userId = 'anonymous_user_1';

  // Create or load a thread
  const [threadId, setThreadId] = useState<Id<'threads'> | null>(null);

  const createThread = useMutation(api.threads.createThread);
  const messages = useQuery(
    api.threads.getMessages,
    threadId ? { threadId } : 'skip',
  );
  const sendMessage = useAction(api.chat.sendMessage);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize a thread when component mounts if none exists
  useEffect(() => {
    const initThread = async () => {
      const newThreadId = await createThread({
        userId,
        title: 'Database Query Chat',
      });
      setThreadId(newThreadId);
    };
    initThread();
  }, [createThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !threadId) return;

    const message = input.trim();
    setInput('');
    setSending(true);

    try {
      await sendMessage({ threadId, message });
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-3xl mx-auto shadow-2xl rounded-2xl overflow-hidden border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">
              Database Query Agent
            </h2>
            <p className="text-xs text-zinc-400">
              Ask questions in natural language
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950 custom-scrollbar">
        {(!messages || messages.length === 0) && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
            <Database className="w-12 h-12 opacity-20" />
            <p>No messages yet. Start querying your database!</p>
          </div>
        )}
        {messages?.map((msg, i) => (
          <div
            key={i}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-zinc-800/80 text-zinc-200 rounded-bl-sm border border-zinc-700/50'
              }`}
            >
              <div className="text-xs font-medium mb-1 opacity-70">
                {msg.role === 'user' ? 'You' : 'Query Agent'}
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex w-full justify-start">
            <div className="max-w-[80%] rounded-2xl p-4 bg-zinc-800/80 text-zinc-200 rounded-bl-sm border border-zinc-700/50">
              <div className="flex gap-1.5 items-center h-5">
                <span
                  className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g. Get me all users created last week..."
            disabled={sending || !threadId}
            className="w-full pl-4 pr-12 py-6 rounded-xl bg-zinc-950 border-zinc-700 focus-visible:ring-emerald-500/50 text-zinc-100 placeholder:text-zinc-600 shadow-inner"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim() || !threadId}
            className="absolute right-1.5 w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
          >
            <PaperPlaneRight weight="fill" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
