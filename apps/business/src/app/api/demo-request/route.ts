import { NextResponse, type NextRequest } from "next/server";

/*
 * Lead capture for the public marketing landing (RequestAccessForm).
 *
 * Sinks, tried in order — the lead is stored if AT LEAST ONE succeeds:
 *   1. LEADS_WEBHOOK_URL   — generic JSON POST (Zapier/Make/etc.). Slack incoming
 *                            webhooks (hooks.slack.com) get a {text} payload instead.
 *   2. NOTION_API_KEY + NOTION_LEADS_PARENT_PAGE_ID — creates a child page under
 *                            the given Notion page (page must be shared with the
 *                            integration). No database schema coupling.
 *
 * With no sink configured: in dev the lead is logged and accepted (local demos,
 * e2e); in production the route fails closed with 503 so the form can tell the
 * visitor to email us instead of silently discarding the lead.
 */

const WEBHOOK_URL = process.env.LEADS_WEBHOOK_URL ?? "";
const NOTION_API_KEY = process.env.NOTION_API_KEY ?? "";
const NOTION_PARENT_PAGE_ID = process.env.NOTION_LEADS_PARENT_PAGE_ID ?? "";

const MAX_FIELD_LENGTH = 200;
const EMAIL_RE = /.+@.+\..+/;

interface Lead {
  name: string;
  email: string;
  company: string;
  receivedAt: string;
  source: string;
}

async function sendToWebhook(lead: Lead): Promise<boolean> {
  if (!WEBHOOK_URL) return false;
  const isSlack = new URL(WEBHOOK_URL).hostname === "hooks.slack.com";
  const payload = isSlack
    ? {
        text: `New demo request — ${lead.company}\nName: ${lead.name}\nEmail: ${lead.email}\nSource: ${lead.source}`,
      }
    : { type: "request-access", ...lead };
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return res.ok;
}

async function sendToNotion(lead: Lead): Promise<boolean> {
  if (!NOTION_API_KEY || !NOTION_PARENT_PAGE_ID) return false;
  const paragraph = (text: string) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  });
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      authorization: `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      parent: { page_id: NOTION_PARENT_PAGE_ID },
      properties: {
        title: {
          title: [{ type: "text", text: { content: `Lead — ${lead.company} (${lead.name})` } }],
        },
      },
      children: [
        paragraph(`Name: ${lead.name}`),
        paragraph(`Email: ${lead.email}`),
        paragraph(`Company: ${lead.company}`),
        paragraph(`Received: ${lead.receivedAt}`),
        paragraph(`Source: ${lead.source}`),
      ],
    }),
    cache: "no-store",
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; company?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // Honeypot: real users never see the "website" field. Pretend success so bots
  // don't learn they were filtered.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";

  if (!name || !company || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "name, valid email, and company are required" },
      { status: 400 },
    );
  }
  if ([name, email, company].some((v) => v.length > MAX_FIELD_LENGTH)) {
    return NextResponse.json({ ok: false, error: "field too long" }, { status: 400 });
  }

  const lead: Lead = {
    name,
    email,
    company,
    receivedAt: new Date().toISOString(),
    source: "pro.tagit.network landing",
  };

  const sinkConfigured = Boolean(WEBHOOK_URL || (NOTION_API_KEY && NOTION_PARENT_PAGE_ID));
  let stored = false;

  if (sinkConfigured) {
    const results = await Promise.allSettled([sendToWebhook(lead), sendToNotion(lead)]);
    stored = results.some((r) => r.status === "fulfilled" && r.value === true);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error(
          `[lead] sink error: ${r.reason instanceof Error ? r.reason.message : r.reason}`,
        );
      }
    }
  }

  // Last-resort durability: the lead always lands in the server log.
  console.info(`[lead] ${JSON.stringify(lead)} stored=${stored} sinkConfigured=${sinkConfigured}`);

  if (stored) {
    return NextResponse.json({ ok: true });
  }
  if (!sinkConfigured && process.env.NODE_ENV !== "production") {
    // Local dev / e2e: accept and log so the funnel is testable without secrets.
    return NextResponse.json({ ok: true, stored: "log-only" });
  }
  return NextResponse.json(
    { ok: false, error: sinkConfigured ? "lead sinks unreachable" : "lead capture not configured" },
    { status: sinkConfigured ? 502 : 503 },
  );
}
