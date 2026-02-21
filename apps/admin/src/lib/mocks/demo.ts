// Mock demo event sequence for when services API is unavailable.
// Simulates a full pipeline run with 15 events over ~8 seconds.

export interface DemoEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

const baseTime = Date.now();
function ts(offsetMs: number): string {
  return new Date(baseTime + offsetMs).toISOString();
}

export const mockDemoEvents: DemoEvent[] = [
  { type: "pipeline:start", mode: "demo", candidateCount: 5, timestamp: ts(0) },
  { type: "agent:discovered", agentName: "ShopVerify AI", category: "e-commerce", crawledAgentId: 101, timestamp: ts(400) },
  { type: "agent:discovered", agentName: "SupplyTrace", category: "supply-chain", crawledAgentId: 102, timestamp: ts(600) },
  { type: "agent:discovered", agentName: "LuxAuth Protocol", category: "luxury-fashion", crawledAgentId: 103, timestamp: ts(800) },
  { type: "agent:discovered", agentName: "DeFi Vault Guard", category: "defi-rwa", crawledAgentId: 104, timestamp: ts(1000) },
  { type: "agent:discovered", agentName: "InsureChain", category: "insurance", crawledAgentId: 105, timestamp: ts(1200) },
  { type: "agent:qualified", agentName: "ShopVerify AI", score: 82, timestamp: ts(2000) },
  { type: "agent:qualified", agentName: "SupplyTrace", score: 76, timestamp: ts(2200) },
  { type: "agent:qualified", agentName: "LuxAuth Protocol", score: 91, timestamp: ts(2400) },
  { type: "agent:qualified", agentName: "DeFi Vault Guard", score: 88, timestamp: ts(2600) },
  { type: "agent:pitched", agentName: "ShopVerify AI", category: "e-commerce", timestamp: ts(3000) },
  { type: "agent:pitched", agentName: "SupplyTrace", category: "supply-chain", timestamp: ts(3400) },
  { type: "agent:pitched", agentName: "LuxAuth Protocol", category: "luxury-fashion", timestamp: ts(3800) },
  { type: "agent:pitched", agentName: "DeFi Vault Guard", category: "defi-rwa", timestamp: ts(4200) },
  { type: "agent:response", agentName: "ShopVerify AI", responseType: "accepted", timestamp: ts(4800) },
  { type: "agent:response", agentName: "SupplyTrace", responseType: "accepted", timestamp: ts(5200) },
  { type: "agent:response", agentName: "LuxAuth Protocol", responseType: "declined", timestamp: ts(5600) },
  { type: "agent:response", agentName: "DeFi Vault Guard", responseType: "accepted", timestamp: ts(6000) },
  { type: "demo:started", agentName: "ShopVerify AI", timestamp: ts(6400) },
  { type: "demo:completed", agentName: "ShopVerify AI", passed: true, confidence: 0.95, timestamp: ts(6800) },
  { type: "demo:started", agentName: "SupplyTrace", timestamp: ts(7000) },
  { type: "demo:completed", agentName: "SupplyTrace", passed: true, confidence: 0.87, timestamp: ts(7400) },
  { type: "demo:started", agentName: "DeFi Vault Guard", timestamp: ts(7600) },
  { type: "demo:completed", agentName: "DeFi Vault Guard", passed: true, confidence: 0.92, timestamp: ts(8000) },
  { type: "agent:onboarded", agentName: "ShopVerify AI", category: "e-commerce", timestamp: ts(8200) },
  { type: "agent:onboarded", agentName: "SupplyTrace", category: "supply-chain", timestamp: ts(8600) },
  { type: "agent:onboarded", agentName: "DeFi Vault Guard", category: "defi-rwa", timestamp: ts(9000) },
  { type: "pipeline:complete", pitched: 4, accepted: 3, demosRun: 3, onboarded: 3, timestamp: ts(9200) },
];
