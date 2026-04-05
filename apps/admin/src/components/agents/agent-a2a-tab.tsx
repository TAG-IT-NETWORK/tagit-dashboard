"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
} from "@tagit/ui";
import {
  Activity,
  Send,
  Clock,
  ChevronDown,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  timestamp: Date;
  request: unknown;
  response: unknown;
  duration: number;
}

export interface AgentA2ATabProps {
  agentId: number;
  agentUri: string;
}

// ── Templates ──────────────────────────────────────────────────────────────────

type TemplateName =
  | "Echo Test"
  | "Query Agent"
  | "Check Reputation"
  | "Check Validation"
  | "Custom";

function buildTemplate(name: TemplateName, agentId: number): string {
  switch (name) {
    case "Echo Test":
      return JSON.stringify(
        {
          method: "message/send",
          params: {
            skill: "sage__echo",
            input: { message: "Hello from dashboard!" },
          },
        },
        null,
        2,
      );
    case "Query Agent":
      return JSON.stringify(
        {
          method: "message/send",
          params: {
            skill: "sage__query_asset",
            input: { agentId },
          },
        },
        null,
        2,
      );
    case "Check Reputation":
      return JSON.stringify(
        {
          method: "message/send",
          params: {
            skill: "sage__check_reputation",
            input: { agentId },
          },
        },
        null,
        2,
      );
    case "Check Validation":
      return JSON.stringify(
        {
          method: "message/send",
          params: {
            skill: "sage__check_validation",
            input: { agentId },
          },
        },
        null,
        2,
      );
    case "Custom":
      return "";
  }
}

const TEMPLATE_NAMES: TemplateName[] = [
  "Echo Test",
  "Query Agent",
  "Check Reputation",
  "Check Validation",
  "Custom",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

interface TemplateDropdownProps {
  selected: TemplateName;
  onSelect: (name: TemplateName) => void;
}

function TemplateDropdown({ selected, onSelect }: TemplateDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {selected}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-popover shadow-md">
          {TEMPLATE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
              onClick={() => {
                onSelect(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HistoryItemProps {
  entry: HistoryEntry;
  index: number;
}

function HistoryItem({ entry, index }: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const responseStr = JSON.stringify(entry.response, null, 2);
  const hasError =
    entry.response !== null &&
    typeof entry.response === "object" &&
    "error" in (entry.response as object);

  return (
    <div className="rounded-lg border text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors rounded-lg"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasError ? (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          )}
          <span className="text-muted-foreground text-xs font-mono shrink-0">#{index + 1}</span>
          <span className="truncate text-xs text-muted-foreground">
            {entry.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="font-mono text-xs">
            {entry.duration}ms
          </Badge>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Request</p>
            <pre className="rounded bg-muted p-3 text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {JSON.stringify(entry.request, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Response</p>
            <pre className="rounded bg-muted p-3 text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {responseStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AgentA2ATab({ agentId, agentUri }: AgentA2ATabProps) {
  const [template, setTemplate] = useState<TemplateName>("Echo Test");
  const [body, setBody] = useState<string>(() => buildTemplate("Echo Test", agentId));
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleTemplateChange = useCallback(
    (name: TemplateName) => {
      setTemplate(name);
      setBody(buildTemplate(name, agentId));
      setParseError(null);
      setLastResponse(null);
    },
    [agentId],
  );

  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    setParseError(null);
    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        setParseError("Invalid JSON");
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!body.trim()) return;

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      setParseError("Invalid JSON — fix the request body before sending.");
      return;
    }

    setLoading(true);
    setLastResponse(null);
    const start = Date.now();

    try {
      const res = await fetch("/api/a2a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentUrl: agentUri || undefined, payload }),
      });

      const data: unknown = await res.json();
      const duration = Date.now() - start;

      setLastResponse(data);
      setHistory((prev) => [
        { timestamp: new Date(), request: payload, response: data, duration },
        ...prev,
      ]);
    } catch (err) {
      const duration = Date.now() - start;
      const errResponse = { error: err instanceof Error ? err.message : "Network error" };
      setLastResponse(errResponse);
      setHistory((prev) => [
        { timestamp: new Date(), request: payload, response: errResponse, duration },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [body, agentUri]);

  const responseStr = lastResponse !== null ? JSON.stringify(lastResponse, null, 2) : null;
  const responseIsError =
    lastResponse !== null &&
    typeof lastResponse === "object" &&
    "error" in (lastResponse as object);

  return (
    <div className="space-y-4">
      {/* Gateway info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            A2A Gateway
          </CardTitle>
          <CardDescription>
            Send Agent-to-Agent protocol messages to this agent via the TAG IT gateway.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Gateway Endpoint</p>
            <code className="text-xs break-all">POST https://api.tagit.network/a2a</code>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Agent URI</p>
            <code className="text-xs break-all">
              {agentUri || <span className="text-muted-foreground italic">not set</span>}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Message composer */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send Message
            </CardTitle>
            <TemplateDropdown selected={template} onSelect={handleTemplateChange} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Request Body (JSON)
            </label>
            <textarea
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder='{"method": "message/send", "params": {...}}'
            />
            {parseError && (
              <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {parseError}
              </p>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={loading || !body.trim() || !!parseError}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Latest response */}
      {responseStr !== null && (
        <Card
          className={
            responseIsError
              ? "border-destructive/50 bg-destructive/5"
              : "border-green-500/30 bg-green-500/5"
          }
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {responseIsError ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded bg-muted p-4 text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap break-all">
              {responseStr}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Message history */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Message History
              </CardTitle>
              <Badge variant="outline" className="font-mono">
                {history.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((entry, i) => (
              <HistoryItem key={i} entry={entry} index={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty history hint */}
      {history.length === 0 && !loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Activity className="h-3.5 w-3.5" />
          Send a message to see history here.
        </div>
      )}
    </div>
  );
}
