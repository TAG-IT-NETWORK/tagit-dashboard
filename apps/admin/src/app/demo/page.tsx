"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  MetricCard,
} from "@tagit/ui";
import {
  Play,
  Loader2,
  Radio,
  Database,
  Users,
  Target,
  Presentation,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import { servicesApi } from "@/lib/services-client";
import { mockDemoEvents, type DemoEvent } from "@/lib/mocks/demo";

// ── Types ───────────────────────────────────────────────────────

type DemoMode = "controlled" | "live";

interface AgentEntry {
  name: string;
  category: string;
  score: number | null;
  stage: string;
}

interface LogEntry {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  color: "green" | "amber" | "red" | "blue" | "gray";
}

// ── Pipeline Stages ─────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "crawl", label: "Crawl", icon: Users },
  { key: "qualify", label: "Qualify", icon: Target },
  { key: "pitch", label: "Pitch", icon: Zap },
  { key: "demo", label: "Demo", icon: Presentation },
  { key: "onboard", label: "Onboard", icon: UserCheck },
] as const;

// ── Helpers ─────────────────────────────────────────────────────

function eventToLogEntry(event: DemoEvent, id: number): LogEntry {
  const type = event.type as string;
  const name = (event as Record<string, unknown>).agentName as string | undefined;

  const messageMap: Record<string, string> = {
    "pipeline:start": `Pipeline started (${(event as Record<string, unknown>).candidateCount} candidates)`,
    "agent:discovered": `Discovered: ${name}`,
    "agent:qualified": `Qualified: ${name} (score: ${(event as Record<string, unknown>).score})`,
    "agent:pitched": `Pitched: ${name}`,
    "agent:response": `Response from ${name}: ${(event as Record<string, unknown>).responseType}`,
    "demo:started": `Demo started: ${name}`,
    "demo:completed": `Demo ${(event as Record<string, unknown>).passed ? "passed" : "failed"}: ${name} (${((event as Record<string, unknown>).confidence as number * 100).toFixed(0)}%)`,
    "agent:onboarded": `Onboarded: ${name}`,
    "pipeline:complete": `Pipeline complete! ${(event as Record<string, unknown>).onboarded} onboarded`,
    "pipeline:error": `Error: ${(event as Record<string, unknown>).message}`,
  };

  const colorMap: Record<string, LogEntry["color"]> = {
    "pipeline:start": "blue",
    "agent:discovered": "gray",
    "agent:qualified": "blue",
    "agent:pitched": "amber",
    "agent:response": "amber",
    "demo:started": "amber",
    "demo:completed": (event as Record<string, unknown>).passed ? "green" : "red",
    "agent:onboarded": "green",
    "pipeline:complete": "green",
    "pipeline:error": "red",
  };

  return {
    id,
    type,
    message: messageMap[type] ?? type,
    timestamp: event.timestamp,
    color: colorMap[type] ?? "gray",
  };
}

function eventToActiveStage(type: string): string | null {
  if (type === "agent:discovered") return "crawl";
  if (type === "agent:qualified") return "qualify";
  if (type === "agent:pitched") return "pitch";
  if (type.startsWith("demo:")) return "demo";
  if (type === "agent:onboarded") return "onboard";
  return null;
}

const logColorClasses: Record<LogEntry["color"], string> = {
  green: "text-green-400",
  amber: "text-amber-400",
  red: "text-red-400",
  blue: "text-blue-400",
  gray: "text-gray-400",
};

const logDotClasses: Record<LogEntry["color"], string> = {
  green: "bg-green-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  blue: "bg-blue-400",
  gray: "bg-gray-400",
};

// ── Page Component ──────────────────────────────────────────────

export default function DemoPage() {
  const [mode, setMode] = useState<DemoMode>("controlled");
  const [running, setRunning] = useState(false);
  const [useMock, setUseMock] = useState(false);

  // Metrics
  const [discovered, setDiscovered] = useState(0);
  const [qualified, setQualified] = useState(0);
  const [pitched, setPitched] = useState(0);
  const [demosRun, setDemosRun] = useState(0);
  const [onboarded, setOnboarded] = useState(0);

  // Pipeline stage tracking
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [activeStage, setActiveStage] = useState<string | null>(null);

  // Activity log
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Agent scores table
  const [agents, setAgents] = useState<Map<string, AgentEntry>>(new Map());

  // Timing
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Date.now() - startTimeRef.current);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [running]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const processEvent = useCallback((event: DemoEvent) => {
    const type = event.type as string;
    const name = (event as Record<string, unknown>).agentName as string | undefined;

    // Update metrics
    if (type === "agent:discovered") setDiscovered((c) => c + 1);
    if (type === "agent:qualified") setQualified((c) => c + 1);
    if (type === "agent:pitched") setPitched((c) => c + 1);
    if (type === "demo:completed") setDemosRun((c) => c + 1);
    if (type === "agent:onboarded") setOnboarded((c) => c + 1);

    // Update pipeline stages
    const stage = eventToActiveStage(type);
    if (stage) {
      setActiveStage(stage);
      setCompletedStages((prev) => {
        const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === stage);
        const next = new Set(prev);
        for (let i = 0; i < stageIdx; i++) {
          next.add(PIPELINE_STAGES[i]!.key);
        }
        return next;
      });
    }
    if (type === "pipeline:complete") {
      setCompletedStages(new Set(PIPELINE_STAGES.map((s) => s.key)));
      setActiveStage(null);
    }

    // Update agent table
    if (name) {
      setAgents((prev) => {
        const next = new Map(prev);
        const existing = next.get(name) ?? { name, category: "", score: null, stage: "discovered" };

        if (type === "agent:discovered") {
          existing.category = (event as Record<string, unknown>).category as string;
          existing.stage = "discovered";
        }
        if (type === "agent:qualified") {
          existing.score = (event as Record<string, unknown>).score as number;
          existing.stage = "qualified";
        }
        if (type === "agent:pitched") existing.stage = "pitched";
        if (type === "agent:response") {
          existing.stage = (event as Record<string, unknown>).responseType as string;
        }
        if (type === "demo:started") existing.stage = "demo running";
        if (type === "demo:completed") {
          existing.stage = (event as Record<string, unknown>).passed ? "demo passed" : "demo failed";
        }
        if (type === "agent:onboarded") existing.stage = "onboarded";

        next.set(name, existing);
        return next;
      });
    }

    // Add to log
    const logEntry = eventToLogEntry(event, ++logIdRef.current);
    setLogs((prev) => [...prev, logEntry]);

    // End pipeline
    if (type === "pipeline:complete" || type === "pipeline:error") {
      setRunning(false);
    }
  }, []);

  const resetState = useCallback(() => {
    setDiscovered(0);
    setQualified(0);
    setPitched(0);
    setDemosRun(0);
    setOnboarded(0);
    setCompletedStages(new Set());
    setActiveStage(null);
    setLogs([]);
    setAgents(new Map());
    setElapsed(0);
    logIdRef.current = 0;
  }, []);

  const startDemo = useCallback(async () => {
    resetState();
    setRunning(true);
    startTimeRef.current = Date.now();

    // Try SSE first
    const eventsUrl = servicesApi.getDemoEventsUrl();
    let sseConnected = false;

    try {
      const es = new EventSource(eventsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          es.close();
          reject(new Error("SSE timeout"));
        }, 3000);

        es.addEventListener("connected", () => {
          clearTimeout(timeout);
          sseConnected = true;
          setUseMock(false);
          resolve();
        });

        es.onerror = () => {
          clearTimeout(timeout);
          es.close();
          reject(new Error("SSE connection failed"));
        };
      });

      if (sseConnected) {
        // Subscribe to all event types
        const eventTypes = [
          "pipeline:start", "agent:discovered", "agent:qualified",
          "agent:pitched", "agent:response", "demo:started",
          "demo:completed", "agent:onboarded", "pipeline:complete",
          "pipeline:error",
        ];
        for (const eventType of eventTypes) {
          es.addEventListener(eventType, (e: MessageEvent) => {
            const event = JSON.parse(e.data) as DemoEvent;
            processEvent(event);
          });
        }

        // Trigger pipeline run
        await servicesApi.runDemoPipeline(5);

        // Cleanup on unmount handled by running state
        return;
      }
    } catch {
      // SSE failed, fall through to mock mode
    }

    // Mock mode fallback
    setUseMock(true);
    const baseTime = Date.now();

    for (let i = 0; i < mockDemoEvents.length; i++) {
      const event = mockDemoEvents[i]!;
      const eventTime = new Date(event.timestamp).getTime();
      const firstEventTime = new Date(mockDemoEvents[0]!.timestamp).getTime();
      const delay = eventTime - firstEventTime;

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          processEvent({ ...event, timestamp: new Date(baseTime + delay).toISOString() });
          resolve();
        }, delay - (i > 0 ? new Date(mockDemoEvents[i - 1]!.timestamp).getTime() - firstEventTime : 0));
      });
    }
  }, [processEvent, resetState]);

  const formatElapsed = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}.${Math.floor((ms % 1000) / 100)}s`;
  };

  const passCount = logs.filter((l) => l.color === "green").length;
  const failCount = logs.filter((l) => l.color === "red").length;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Presentation className="h-6 w-6" />
            Demo Mission Control
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Real-time pipeline demo for investors &amp; partners</span>
            {useMock ? (
              <Badge variant="secondary" className="text-xs">
                Mock Data
              </Badge>
            ) : running ? (
              <Badge variant="outline" className="text-xs gap-1 text-green-400 border-green-500/20">
                <Radio className="h-3 w-3 animate-pulse" />
                Live SSE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <Database className="h-3 w-3" />
                Ready
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "controlled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("controlled")}
              disabled={running}
            >
              Controlled
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("live")}
              disabled={running}
            >
              Live
            </button>
          </div>
          <Button onClick={startDemo} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start Demo
          </Button>
        </div>
      </div>

      {/* ── Metrics Row ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          title="Discovered"
          value={discovered}
          icon={<Users className="h-5 w-5" />}
          loading={false}
        />
        <MetricCard
          title="Qualified"
          value={qualified}
          icon={<Target className="h-5 w-5" />}
          loading={false}
        />
        <MetricCard
          title="Pitched"
          value={pitched}
          icon={<Zap className="h-5 w-5" />}
          loading={false}
        />
        <MetricCard
          title="Demos Run"
          value={demosRun}
          icon={<Presentation className="h-5 w-5" />}
          loading={false}
        />
        <MetricCard
          title="Onboarded"
          value={onboarded}
          icon={<UserCheck className="h-5 w-5" />}
          loading={false}
        />
      </div>

      {/* ── Pipeline Stepper ────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {PIPELINE_STAGES.map((stage, i) => {
              const isCompleted = completedStages.has(stage.key);
              const isActive = activeStage === stage.key;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? "bg-green-500/20 text-green-400 ring-2 ring-green-500/40"
                          : isActive
                            ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/40 animate-pulse"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isCompleted
                          ? "text-green-400"
                          : isActive
                            ? "text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${
                        isCompleted ? "bg-green-500/40" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Two-Column Grid ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Activity Log
            </CardTitle>
            <CardDescription>
              {logs.length} events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] overflow-y-auto space-y-1 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Click &quot;Start Demo&quot; to begin
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 py-1 ${logColorClasses[log.color]}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${logDotClasses[log.color]}`} />
                    <span className="text-muted-foreground text-xs flex-shrink-0 w-20">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Right: Agent Scores Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Scores
            </CardTitle>
            <CardDescription>
              {agents.size} agents discovered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] overflow-y-auto">
              {agents.size === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Waiting for pipeline events...
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Score</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(agents.values()).map((agent) => (
                      <tr key={agent.name} className="border-b last:border-0">
                        <td className="px-3 py-2 text-sm font-medium">{agent.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {agent.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {agent.score != null ? (
                            <span
                              className={`font-mono font-bold text-sm ${
                                agent.score >= 70
                                  ? "text-green-400"
                                  : agent.score >= 50
                                    ? "text-amber-400"
                                    : "text-red-400"
                              }`}
                            >
                              {agent.score}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              agent.stage === "onboarded"
                                ? "bg-green-500/10 text-green-400 border-green-500/20"
                                : agent.stage === "declined" || agent.stage === "demo failed"
                                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : agent.stage === "demo running"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {agent.stage}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Elapsed: {formatElapsed(elapsed)}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-400" />
            {passCount} passed
          </span>
          {failCount > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-400" />
              {failCount} failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {useMock && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Running with mock data (services offline)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
