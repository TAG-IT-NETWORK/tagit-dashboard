import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the actual module logic by importing directly
// chains.ts uses `process.env` which we can control in tests

describe("chains config — Base Sepolia integration", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // Restore env after each test
    Object.keys(process.env).forEach((k) => delete process.env[k]);
    Object.assign(process.env, ORIGINAL_ENV);
    vi.resetModules();
  });

  it("supportedChains includes Base Sepolia (id 84532)", async () => {
    const { supportedChains } = await import("@tagit/config");
    const ids = supportedChains.map((c) => c.id);
    expect(ids).toContain(84532);
  });

  it("supportedChains has exactly 3 entries", async () => {
    const { supportedChains } = await import("@tagit/config");
    expect(supportedChains).toHaveLength(3);
  });

  it("explorerUrls includes Base Sepolia explorer", async () => {
    const { explorerUrls } = await import("@tagit/config");
    expect(explorerUrls[84532]).toBe("https://sepolia.basescan.org");
  });

  it("getPrimaryChainId returns Base Sepolia when env is base_sepolia", async () => {
    process.env.NEXT_PUBLIC_PRIMARY_CHAIN = "base_sepolia";
    const { getPrimaryChainId } = await import("@tagit/config");
    expect(getPrimaryChainId()).toBe(84532);
  });

  it("getPrimaryChainId defaults to Arbitrum Sepolia when env is unset", async () => {
    delete process.env.NEXT_PUBLIC_PRIMARY_CHAIN;
    const { getPrimaryChainId } = await import("@tagit/config");
    expect(getPrimaryChainId()).toBe(421614);
  });

  it("getMirrorChainId returns a non-primary chain", async () => {
    const { getPrimaryChainId, getMirrorChainId } = await import("@tagit/config");
    expect(getMirrorChainId()).not.toBe(getPrimaryChainId());
  });

  it("getChainRole returns primary for primary chain", async () => {
    process.env.NEXT_PUBLIC_PRIMARY_CHAIN = "base_sepolia";
    const { getChainRole } = await import("@tagit/config");
    expect(getChainRole(84532)).toBe("primary");
  });

  it("getChainRole returns mirror for non-primary chains", async () => {
    process.env.NEXT_PUBLIC_PRIMARY_CHAIN = "base_sepolia";
    const { getChainRole } = await import("@tagit/config");
    expect(getChainRole(421614)).toBe("mirror");
    expect(getChainRole(11155420)).toBe("mirror");
  });

  it("getExplorerUrl returns Base Sepolia URL for chain 84532", async () => {
    const { getExplorerUrl } = await import("@tagit/config");
    expect(getExplorerUrl(84532)).toBe("https://sepolia.basescan.org");
  });
});

describe("contract addresses — Base Sepolia", () => {
  it("getContractsForChain returns addresses object for Base Sepolia", async () => {
    const { getContractsForChain, BASE_SEPOLIA_CHAIN_ID } = await import("@tagit/contracts");
    const addrs = getContractsForChain(BASE_SEPOLIA_CHAIN_ID);
    expect(addrs).toBeDefined();
    expect(addrs).toHaveProperty("TAGITCore");
    expect(addrs).toHaveProperty("TAGITAccess");
    expect(addrs).toHaveProperty("CCIPAdapter");
  });

  it("BASE_SEPOLIA_CHAIN_ID is 84532", async () => {
    const { BASE_SEPOLIA_CHAIN_ID } = await import("@tagit/contracts");
    expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
  });

  it("startBlocksByChain includes Base Sepolia entry", async () => {
    const { startBlocksByChain, BASE_SEPOLIA_CHAIN_ID } = await import("@tagit/contracts");
    expect(startBlocksByChain[BASE_SEPOLIA_CHAIN_ID]).toBeDefined();
  });
});
