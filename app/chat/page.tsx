import { ChatInterface } from '@/components/chat-interface';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950 -z-10"></div>

      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Query your Database
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Natural language interface for complex database queries. Just ask,
            and the agent will fetch exactly what you need.
          </p>
        </div>

        <ChatInterface />
      </div>
    </div>
  );
}
