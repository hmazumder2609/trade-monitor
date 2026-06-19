import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, Trash2, Zap, TrendingUp, BarChart2, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { onSymbol: (sym: string) => void }

const PROMPTS = [
  "What's the macro outlook for Q2 2026?",
  "Analyze NVDA: bull vs bear case",
  "Explain yield curve inversion impact",
  "Compare FAANG valuations",
  "What does VIX > 25 signal?",
  "Top sectors to watch in rate-cut environment",
];

function MessageBubble({ msg }: { msg: { role: string; content: string } }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? "order-2" : "order-1"}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="w-3 h-3 text-[hsl(38,95%,55%)]" />
            <span className="font-terminal text-[9px] text-[hsl(38,95%,55%)] tracking-widest">BLMTRM AI</span>
          </div>
        )}
        <div className={`px-4 py-3 ${
          isUser
            ? "bg-[hsl(38,95%,50%)/15%] border border-[hsl(38,95%,50%)/30%] text-foreground"
            : "bg-[#0d0d0d] border border-border text-foreground"
        }`}>
          <div className="font-terminal text-xs leading-relaxed whitespace-pre-wrap break-words">
            {msg.content}
          </div>
        </div>
        {isUser && (
          <div className="flex justify-end mt-0.5">
            <span className="font-terminal text-[8px] text-muted-foreground">YOU</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentPanel({ onSymbol }: Props) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/chat"],
    queryFn: async () => {
      const res = await fetch("/api/chat");
      return res.json();
    },
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/chat");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat"] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const sendMessage = async (msg: string) => {
    if (!msg.trim() || isStreaming) return;
    setInput("");
    setIsStreaming(true);
    setStreaming("");

    // Optimistic add user message
    qc.setQueryData(["/api/chat"], (old: any[] = []) => [
      ...old,
      { id: Date.now(), role: "user", content: msg, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setStreaming(fullText);
              }
              if (data.done) {
                setStreaming("");
                setIsStreaming(false);
                qc.invalidateQueries({ queryKey: ["/api/chat"] });
              }
            } catch {}
          }
        }
      }
    } catch {
      setIsStreaming(false);
      setStreaming("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#070707] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[hsl(38,95%,55%)]" />
          <span className="panel-label">BLMTRM AI AGENT</span>
          <span className="font-terminal text-[8px] text-muted-foreground border border-border px-1.5 py-0.5">CLAUDE SONNET</span>
        </div>
        <button
          onClick={() => clearMut.mutate()}
          className="flex items-center gap-1.5 font-terminal text-[9px] text-muted-foreground hover:text-[hsl(0,100%,68%)] transition-colors"
          data-testid="clear-chat"
        >
          <Trash2 className="w-3 h-3" /> CLEAR
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-border" />)}
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="flex flex-col items-center gap-3">
              <Bot className="w-12 h-12 text-[hsl(38,95%,50%)/30%]" />
              <div className="font-terminal text-sm text-muted-foreground text-center">
                AUTONOMOUS FINANCIAL INTELLIGENCE
              </div>
              <div className="font-terminal text-[10px] text-muted-foreground/60 text-center max-w-sm">
                Ask about markets, analyze stocks, get macro insights, compare valuations, or discuss trading strategies.
              </div>
            </div>

            {/* Quick prompts */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="text-left px-3 py-2 border border-border hover:border-[hsl(38,95%,50%)/50%] hover:bg-[hsl(38,95%,50%)/8%] font-terminal text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`prompt-${i}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m: any) => <MessageBubble key={m.id} msg={m} />)}
            {streaming && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="w-3 h-3 text-[hsl(38,95%,55%)]" />
                    <span className="font-terminal text-[9px] text-[hsl(38,95%,55%)] tracking-widest">BLMTRM AI</span>
                    <span className="font-terminal text-[8px] text-muted-foreground animate-pulse">▌</span>
                  </div>
                  <div className="bg-[#0d0d0d] border border-border px-4 py-3">
                    <div className="font-terminal text-xs leading-relaxed whitespace-pre-wrap">{streaming}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-[#070707] p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="font-terminal text-[10px] text-[hsl(38,95%,55%)] shrink-0">&gt;</span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="ASK ABOUT MARKETS, STOCKS, MACRO..."
            disabled={isStreaming}
            className="flex-1 bg-transparent font-terminal text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
            data-testid="agent-input"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="shrink-0 p-1.5 border border-border hover:border-[hsl(38,95%,50%)/50%] hover:text-[hsl(38,95%,55%)] text-muted-foreground disabled:opacity-30 transition-colors"
            data-testid="agent-send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="font-terminal text-[8px] text-muted-foreground/60">SHIFT+ENTER NEW LINE · ENTER SEND</span>
        </div>
      </div>
    </div>
  );
}
