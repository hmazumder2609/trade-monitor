import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface SourceStatus {
  name: string;
  url: string;
  ok: boolean;
  latency: number;
  statusCode: number;
}

interface SourceTestResult {
  ok: boolean;
  statusCode: number;
  body: string;
}

function useApiHealth() {
  return useQuery<{ ok: boolean; latency: number }>({
    queryKey: ["/api/health"],
    queryFn: async () => {
      const start = Date.now();
      try {
        const res = await fetch("/api/finance/tick?symbols=SPY", { signal: AbortSignal.timeout(5000) });
        return { ok: res.ok, latency: Date.now() - start };
      } catch {
        return { ok: false, latency: Date.now() - start };
      }
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

function useNewsSources() {
  return useQuery<SourceStatus[]>({
    queryKey: ["/api/finance/news/sources"],
    queryFn: async () => {
      const res = await fetch("/api/finance/news/sources", { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export default function StatusBar() {
  const { data: health } = useApiHealth();
  const { data: sources = [] } = useNewsSources();
  const [clock, setClock] = useState(() => new Date());
  const [testingSource, setTestingSource] = useState<SourceStatus | null>(null);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!testingSource) setTestResult(null);
  }, [testingSource]);

  const handleSourceClick = async (source: SourceStatus) => {
    setTestingSource(source);
    setTestResult(null);
    setTestLoading(true);
    try {
      const res = await fetch(`/api/finance/news/source-test?url=${encodeURIComponent(source.url)}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        setTestResult({ ok: false, statusCode: res.status, body: await res.text() });
      } else {
        setTestResult(await res.json());
      }
    } catch (e) {
      setTestResult({ ok: false, statusCode: 0, body: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestLoading(false);
    }
  };

  const timeStr = clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <>
      <footer className="flex items-center justify-between h-6 px-3 bg-gradient-to-b from-[#0a0a0a] to-[#070707] border-t border-border/40 shrink-0 font-terminal text-[9px] tracking-[0.12em] shadow-[0_-1px_2px_rgba(0,0,0,0.3)] relative z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${health?.ok ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]"}`} />
            <span className={health?.ok ? "text-green-400/90" : "text-red-400/90"}>
              {health?.ok ? "LIVE" : "DOWN"}
            </span>
          </div>

          <span className="text-muted-foreground/30">|</span>

          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
            {sources.map((source) => {
              const ledColor = source.ok
                ? "bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.3)]"
                : source.statusCode > 0
                  ? "bg-yellow-500 shadow-[0_0_3px_rgba(234,179,8,0.3)]"
                  : "bg-red-500 shadow-[0_0_3px_rgba(239,68,68,0.3)]";
              return (
                <button
                  key={source.name}
                  onClick={() => handleSourceClick(source)}
                  className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground/80 transition-colors cursor-pointer shrink-0"
                  title={`${source.name} — ${source.ok ? `${source.latency}ms` : source.statusCode > 0 ? `HTTP ${source.statusCode}` : "UNREACHABLE"}`}
                >
                  <span className={`w-1 h-1 rounded-full shrink-0 ${ledColor}`} />
                  <span className="tracking-[0.1em]">{source.name.toUpperCase()}</span>
                </button>
              );
            })}
          </div>

          <span className="text-muted-foreground/30">|</span>

          {health?.latency != null && (
            <span className="text-muted-foreground/40 tabular-nums shrink-0">{health.latency}ms</span>
          )}
        </div>
        <div className="text-muted-foreground/60 tabular-nums tracking-wide shrink-0 ml-3">{timeStr}</div>
      </footer>

      {testingSource && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8" onClick={() => setTestingSource(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-[#0a0a0a] border border-border/50 rounded-sm shadow-2xl w-[600px] max-h-[320px] flex flex-col font-terminal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-[0.15em] text-muted-foreground">SOURCE TEST</span>
                <span className="text-[10px] tracking-[0.1em] text-foreground/80">{testingSource.name.toUpperCase()}</span>
                {testResult && (
                  <span className={`text-[9px] px-1.5 py-0.5 ${testResult.ok ? "text-green-400/80 bg-green-500/10" : "text-red-400/80 bg-red-500/10"}`}>
                    {testResult.ok ? `${testResult.statusCode} OK` : testResult.statusCode > 0 ? `HTTP ${testResult.statusCode}` : "FAIL"}
                  </span>
                )}
              </div>
              <button onClick={() => setTestingSource(null)} className="text-muted-foreground/50 hover:text-foreground text-xs leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {testLoading ? (
                <div className="flex items-center justify-center h-20">
                  <span className="text-[10px] tracking-[0.15em] text-muted-foreground/60 animate-pulse">FETCHING...</span>
                </div>
              ) : testResult ? (
                <pre className="text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all m-0">{testResult.body || "(empty response)"}</pre>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
