"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@tagit/ui";
import { Building2, Loader2, Plus, RefreshCw } from "lucide-react";

import {
  brandError,
  describeAssign,
  isValidBrandId,
  isWalletOrEmpty,
  parseAssignOutcome,
  parseBrands,
  suggestBrandId,
  type Brand,
  type UnassignedTemplate,
} from "@/lib/brands";

/**
 * /brands — brand records and "create for a brand" (TAP-T16, platform admins
 * only: the middleware and every /api/brand-proxy route check it).
 *
 * Three things happen here:
 *  1. A brand gets a record: name, logo, the wallet its sales are paid to and
 *     the wallet its new items go to.
 *  2. "Create for this brand": from then on the catalog, batches and binding
 *     station work as that brand, and what is made carries it. The banner at
 *     the top of every page says so until it is stopped.
 *  3. Products that were made with no brand can be given to one. A product
 *     that already has a brand is never moved.
 *
 * The services key never reaches the browser; this page talks only to
 * /api/brand-proxy.
 */

interface Envelope {
  ok?: boolean;
  error?: unknown;
  code?: unknown;
  businesses?: unknown;
  templates?: unknown;
  acting?: unknown;
}

/**
 * One request to this app's brand routes. Never rejects: a request that could
 * not be made at all (offline, aborted) comes back as status 0, so every
 * caller handles it the way it handles a refusal and no button is left busy.
 */
async function call(path: string, init?: RequestInit): Promise<{ status: number; body: Envelope }> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    const body = ((await res.json().catch(() => null)) ?? {}) as Envelope;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const FIELD = "space-y-1.5";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  // null: the list could not be loaded. That is not the same as "none".
  const [unassigned, setUnassigned] = useState<UnassignedTemplate[] | null>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // New brand
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, free, who] = await Promise.all([
        call("/api/brand-proxy"),
        call("/api/brand-proxy/unassigned"),
        call("/api/brand-proxy/acting"),
      ]);
      if (list.status !== 200 || list.body.ok !== true) {
        setError(brandError(list.body.error, list.status));
        setBrands([]);
      } else {
        setBrands(parseBrands(list.body.businesses));
      }
      setUnassigned(
        free.status === 200 && free.body.ok === true && Array.isArray(free.body.templates)
          ? (free.body.templates as UnassignedTemplate[])
          : null,
      );
      setActing(typeof who.body.acting === "string" ? who.body.acting : null);
    } catch {
      setError(brandError(undefined, 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const newId = idTouched ? id : suggestBrandId(name);
  const canCreate = name.trim().length > 0 && isValidBrandId(newId) && busy === null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);
    const res = await call("/api/brand-proxy", json("POST", { id: newId, name: name.trim() }));
    if (res.status !== 201 || res.body.ok !== true) {
      setError(brandError(res.body.error, res.status));
    } else {
      setName("");
      setId("");
      setIdTouched(false);
      setNotice([`${name.trim()} was added.`]);
      await load();
    }
    setBusy(null);
  }

  async function save(brand: Brand, patch: Record<string, string | null>) {
    setBusy(`save:${brand.id}`);
    setError(null);
    setNotice(null);
    const res = await call(`/api/brand-proxy/${encodeURIComponent(brand.id)}`, json("PUT", patch));
    if (res.status !== 200 || res.body.ok !== true)
      setError(brandError(res.body.error, res.status));
    else setNotice([`${brand.name} was saved.`]);
    await load();
    setBusy(null);
  }

  async function act(businessId: string | null) {
    setBusy(`act:${businessId ?? "stop"}`);
    setError(null);
    const res = await call("/api/brand-proxy/acting", json("POST", { businessId }));
    if (res.status !== 200 || res.body.ok !== true) {
      setError(brandError(res.body.error, res.status));
      setBusy(null);
      return;
    }
    // The banner and every other page read the choice on the server: load afresh.
    window.location.reload();
  }

  /** True when the products were handed over; false when it was called off or failed. */
  async function give(brand: Brand, templateIds: string[]): Promise<boolean> {
    if (templateIds.length === 0) return false;
    const names = (unassigned ?? []).filter((t) => templateIds.includes(t.id)).map((t) => t.name);
    if (
      !window.confirm(
        `Give ${names.join(", ")} to ${brand.name}? Every item made from ${names.length === 1 ? "it" : "them"} moves too. This cannot be undone here.`,
      )
    ) {
      return false;
    }
    setBusy(`give:${brand.id}`);
    setError(null);
    setNotice(null);
    const res = await call(
      `/api/brand-proxy/${encodeURIComponent(brand.id)}/assign`,
      json("POST", { templateIds }),
    );
    const outcome = parseAssignOutcome(res.body);
    if (res.status !== 200 || !outcome) setError(brandError(res.body.error, res.status));
    else setNotice(describeAssign(outcome, brand.name));
    await load();
    setBusy(null);
    return res.status === 200 && outcome !== null;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            Brands
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The brands on the platform. Choose one to create products for it, or give it products
            that were made with no brand.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm px-4 py-3"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 text-sm px-4 py-3 space-y-1"
          data-brand-notice
        >
          {notice.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a brand
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void create(e)}
            className="grid gap-4 sm:grid-cols-[2fr,2fr,auto] items-end"
          >
            <div className={FIELD}>
              <Label htmlFor="brand-name">Brand name</Label>
              <Input
                id="brand-name"
                required
                maxLength={120}
                placeholder="Aurora Skin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className={FIELD}>
              <Label htmlFor="brand-id">Brand ID</Label>
              <Input
                id="brand-id"
                required
                placeholder="aurora-skin"
                value={newId}
                aria-invalid={newId !== "" && !isValidBrandId(newId)}
                aria-describedby="brand-id-help"
                onChange={(e) => {
                  setIdTouched(true);
                  setId(e.target.value);
                }}
              />
            </div>
            <Button type="submit" disabled={!canCreate}>
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Add"
              )}
            </Button>
            <p id="brand-id-help" className="text-xs text-muted-foreground sm:col-span-3">
              The ID is permanent. Lowercase letters, digits and hyphens, 2 to 63 characters.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Cards stay on the page while it refreshes: what is typed in them is kept. */}
      {loading && brands.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
          Loading brands…
        </div>
      ) : brands.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No brands yet. Add the first one above.
        </p>
      ) : (
        brands.map((brand) => (
          <BrandCard
            // The card keeps what is typed in it. When the record itself
            // changes (a save, or an edit made elsewhere), a new key starts
            // the card again from the record, so stale text can never be
            // saved over fresh data.
            key={JSON.stringify([
              brand.id,
              brand.name,
              brand.logoUrl,
              brand.treasuryWallet,
              brand.defaultMintRecipient,
            ])}
            brand={brand}
            acting={acting === brand.id}
            unassigned={unassigned}
            busy={busy}
            onSave={(patch) => void save(brand, patch)}
            onAct={(on) => void act(on ? brand.id : null)}
            onGive={(ids) => give(brand, ids)}
          />
        ))
      )}
    </div>
  );
}

function BrandCard({
  brand,
  acting,
  unassigned,
  busy,
  onSave,
  onAct,
  onGive,
}: {
  brand: Brand;
  acting: boolean;
  /** null when the list could not be loaded. */
  unassigned: UnassignedTemplate[] | null;
  busy: string | null;
  onSave: (patch: Record<string, string | null>) => void;
  onAct: (on: boolean) => void;
  /** Resolves true when the products were handed over. */
  onGive: (templateIds: string[]) => Promise<boolean>;
}) {
  const [name, setName] = useState(brand.name);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? "");
  const [treasury, setTreasury] = useState(brand.treasuryWallet ?? "");
  const [recipient, setRecipient] = useState(brand.defaultMintRecipient ?? "");
  const [picked, setPicked] = useState<string[]>([]);

  const changed =
    name.trim() !== brand.name ||
    logoUrl.trim() !== (brand.logoUrl ?? "") ||
    treasury.trim() !== (brand.treasuryWallet ?? "") ||
    recipient.trim() !== (brand.defaultMintRecipient ?? "");
  const valid =
    name.trim().length > 0 && isWalletOrEmpty(treasury.trim()) && isWalletOrEmpty(recipient.trim());
  const idle = busy === null;
  const fieldId = (field: string) => `brand-${brand.id}-${field}`;

  return (
    <Card data-brand={brand.id}>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          {brand.name}
          <span className="text-xs font-normal text-muted-foreground font-mono">{brand.id}</span>
          {acting && <Badge>Creating for this brand</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor={fieldId("name")}>Brand name</Label>
            <Input
              id={fieldId("name")}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor={fieldId("logo")}>Logo address (from the media library)</Label>
            <Input
              id={fieldId("logo")}
              placeholder="https://media.tagit.network/…"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor={fieldId("treasury")}>Wallet that receives the brand&apos;s sales</Label>
            <Input
              id={fieldId("treasury")}
              placeholder="0x…"
              className="font-mono"
              value={treasury}
              aria-invalid={!isWalletOrEmpty(treasury.trim())}
              onChange={(e) => setTreasury(e.target.value)}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor={fieldId("recipient")}>
              Wallet that receives the brand&apos;s new items
            </Label>
            <Input
              id={fieldId("recipient")}
              placeholder="0x…"
              className="font-mono"
              value={recipient}
              aria-invalid={!isWalletOrEmpty(recipient.trim())}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The two wallets are kept on the brand&apos;s record. Sales and new items do not use them
          yet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!changed || !valid || !idle}
            onClick={() =>
              onSave({
                name: name.trim(),
                logoUrl: logoUrl.trim() || null,
                treasuryWallet: treasury.trim() || null,
                defaultMintRecipient: recipient.trim() || null,
              })
            }
          >
            {busy === `save:${brand.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              "Save"
            )}
          </Button>
          <Button
            size="sm"
            variant={acting ? "outline" : "secondary"}
            disabled={!idle}
            onClick={() => onAct(!acting)}
            data-act-for={brand.id}
          >
            {acting ? "Stop creating for this brand" : "Create for this brand"}
          </Button>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-medium">Give products that have no brand</h3>
          {unassigned === null ? (
            <p role="alert" className="text-sm text-destructive" data-unassigned-failed>
              Could not load the products that have no brand. Press Refresh to try again.
            </p>
          ) : unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every product already has a brand.</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {unassigned.map((template) => {
                  const boxId = `give-${brand.id}-${template.id}`;
                  return (
                    <li key={template.id} className="flex items-center gap-2 text-sm">
                      <input
                        id={boxId}
                        type="checkbox"
                        className="h-4 w-4"
                        checked={picked.includes(template.id)}
                        onChange={(e) =>
                          setPicked((now) =>
                            e.target.checked
                              ? [...now, template.id]
                              : now.filter((t) => t !== template.id),
                          )
                        }
                      />
                      <label htmlFor={boxId}>
                        {template.name}
                        {template.sku ? (
                          <span className="text-muted-foreground"> · {template.sku}</span>
                        ) : null}
                        <span className="text-muted-foreground"> · {template.status}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <Button
                size="sm"
                variant="outline"
                disabled={picked.length === 0 || !idle}
                onClick={() => {
                  // The ticks are kept when the admin answers no, or it fails.
                  void onGive(picked).then((given) => {
                    if (given) setPicked([]);
                  });
                }}
                data-give-to={brand.id}
              >
                {busy === `give:${brand.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  `Give to ${brand.name}`
                )}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
