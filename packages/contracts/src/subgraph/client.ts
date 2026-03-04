// Subgraph client for TAGIT

// Access env vars safely without @types/node (Next.js inlines NEXT_PUBLIC_ at build time)
type EnvLike = { process?: { env?: Record<string, string | undefined> } };
const _env = (globalThis as unknown as EnvLike).process?.env;

const DEFAULT_SUBGRAPH_URL =
  _env?.NEXT_PUBLIC_SUBGRAPH_URL ||
  (typeof window !== "undefined" && (window as { __SUBGRAPH_URL__?: string }).__SUBGRAPH_URL__) ||
  "";

export interface SubgraphClientConfig {
  url?: string;
}

export class SubgraphClient {
  private url: string;

  constructor(config?: SubgraphClientConfig) {
    this.url = config?.url || DEFAULT_SUBGRAPH_URL;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph query failed: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }
}

// Singleton instance
let clientInstance: SubgraphClient | null = null;

export function getSubgraphClient(config?: SubgraphClientConfig): SubgraphClient {
  if (!clientInstance || config?.url) {
    clientInstance = new SubgraphClient(config);
  }
  return clientInstance;
}

/** True when a subgraph URL is configured (non-empty) */
export function hasSubgraphUrl(): boolean {
  return DEFAULT_SUBGRAPH_URL !== "";
}

// Check if subgraph is available/deployed
export async function isSubgraphAvailable(): Promise<boolean> {
  if (!hasSubgraphUrl()) return false;
  try {
    const client = getSubgraphClient();
    await client.query<{ _meta: { block: { number: number } } }>(`
      query {
        _meta {
          block {
            number
          }
        }
      }
    `);
    return true;
  } catch {
    return false;
  }
}
