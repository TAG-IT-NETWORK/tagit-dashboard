// Subgraph client for TAGIT

// Default subgraph URL - can be overridden via environment variable
// For Goldsky: https://api.goldsky.com/api/public/project_XXX/subgraphs/tagit/v1/gn
// For The Graph: https://api.thegraph.com/subgraphs/name/tagit/tagit-core
const DEFAULT_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_placeholder/subgraphs/tagit/v1/gn";

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

// Check if subgraph is available/deployed
export async function isSubgraphAvailable(): Promise<boolean> {
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
