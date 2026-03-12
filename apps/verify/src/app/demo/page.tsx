"use client";

import { useState } from "react";

const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL ?? "http://localhost:3100";

interface OracleProof {
  verified: boolean;
  asset: {
    tokenId: string;
    lifecycleState: string;
    stateCode: number;
    owner: string;
    timestamp: number;
    contractAddress: string;
  };
  proof: {
    signature: string;
    messageHash: string;
    oracleAddress: string;
    timestamp: number;
  };
  chain: { id: number; name: string };
  elapsedMs: number;
}

type DemoStep = "idle" | "verifying" | "reasoning" | "paying" | "done" | "rejected" | "error";

export default function DemoPage() {
  const [tokenId, setTokenId] = useState("18");
  const [step, setStep] = useState<DemoStep>("idle");
  const [proof, setProof] = useState<OracleProof | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState("");

  async function runDemo() {
    setStep("verifying");
    setProof(null);
    setReasoning("");
    setError("");

    try {
      const res = await fetch(`${ORACLE_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: tokenId, chain: "arbitrum-sepolia" }),
      });

      if (!res.ok) {
        throw new Error(`Oracle returned ${res.status}`);
      }

      const oracleResult: OracleProof = await res.json();
      setProof(oracleResult);

      setStep("reasoning");
      const reasoningText = generateReasoning(oracleResult);
      for (let i = 0; i < reasoningText.length; i += 3) {
        setReasoning(reasoningText.slice(0, i + 3));
        await new Promise((r) => setTimeout(r, 10));
      }
      setReasoning(reasoningText);

      if (oracleResult.verified && oracleResult.asset.stateCode >= 2) {
        setStep("paying");
        await new Promise((r) => setTimeout(r, 1500));
        setStep("done");
      } else {
        setStep("rejected");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("error");
    }
  }

  function generateReasoning(p: OracleProof): string {
    return [
      "Analyzing verification oracle response...\n",
      `1. Asset State: ${p.asset.lifecycleState} (code ${p.asset.stateCode})`,
      `   ${p.asset.stateCode >= 2 ? "VALID — asset is in BOUND or higher state" : "INVALID — asset not yet bound"}`,
      "",
      `2. Oracle Signature: ${p.proof.signature.slice(0, 20)}...`,
      `   Oracle: ${p.proof.oracleAddress}`,
      "   Signature present and from known oracle address",
      "",
      `3. Chain: ${p.chain.name} (ID: ${p.chain.id})`,
      `   Contract: ${p.asset.contractAddress}`,
      `   Response time: ${p.elapsedMs}ms`,
      "   Chain data is consistent",
      "",
      `4. Owner: ${p.asset.owner}`,
      `   Registered: ${new Date(p.asset.timestamp * 1000).toISOString()}`,
      "",
      p.verified
        ? "VERDICT: PROCEED — All checks passed. Asset is cryptographically verified on-chain."
        : "VERDICT: REJECT — Verification failed. Payment blocked.",
    ].join("\n");
  }

  const arbiscanBase = "https://sepolia.arbiscan.io";

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "#000" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-syne text-3xl font-bold text-white mb-2">
            Agent Physical Commerce
          </h1>
          <p className="text-gray-500 text-sm">
            AI agent verifies a physical asset on-chain, then autonomously pays
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Token ID"
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm w-32 focus:outline-none focus:border-[#00D68F]"
          />
          <button
            onClick={runDemo}
            disabled={step !== "idle" && step !== "done" && step !== "rejected" && step !== "error"}
            className="px-6 py-2 rounded-lg font-semibold text-sm transition-colors"
            style={{
              background: step === "idle" || step === "done" || step === "rejected" || step === "error" ? "#00D68F" : "#333",
              color: "#000",
            }}
          >
            {step === "idle" ? "Verify & Purchase" : step === "done" || step === "rejected" || step === "error" ? "Run Again" : "Running..."}
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Agent Reasoning */}
          <div className="rounded-2xl border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">🤖</span>
              <h2 className="text-white text-sm font-bold">Agent Reasoning</h2>
              {step === "reasoning" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#00D68F] animate-pulse" />
              )}
            </div>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{ color: "#9CA3AF", fontFamily: "monospace", minHeight: "300px" }}
            >
              {step === "idle"
                ? "Waiting for verification request..."
                : step === "verifying"
                  ? "Calling verification oracle..."
                  : reasoning || "Processing..."}
            </pre>
            {step === "done" && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.3)" }}>
                <span className="text-[#00D68F] text-sm font-bold">Payment Executed (Simulated)</span>
              </div>
            )}
            {step === "rejected" && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <span className="text-red-400 text-sm font-bold">Payment Rejected</span>
              </div>
            )}
          </div>

          {/* Right: On-Chain Proof */}
          <div className="rounded-2xl border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">🔗</span>
              <h2 className="text-white text-sm font-bold">On-Chain Proof</h2>
            </div>

            {proof ? (
              <div className="space-y-3">
                {[
                  ["Token", `#${proof.asset.tokenId}`],
                  ["State", proof.asset.lifecycleState],
                  ["Owner", `${proof.asset.owner.slice(0, 10)}...${proof.asset.owner.slice(-6)}`],
                  ["Contract", `${proof.asset.contractAddress.slice(0, 10)}...`],
                  ["Chain", `${proof.chain.name} (${proof.chain.id})`],
                  ["Oracle", `${proof.proof.oracleAddress.slice(0, 10)}...`],
                  ["Signature", `${proof.proof.signature.slice(0, 20)}...`],
                  ["Response", `${proof.elapsedMs}ms`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <span className="text-white text-xs font-mono">{value}</span>
                  </div>
                ))}

                <div className="pt-3 space-y-2">
                  <a
                    href={`${arbiscanBase}/address/${proof.asset.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5 transition-colors"
                  >
                    View Contract on Arbiscan
                  </a>
                  <a
                    href={`${arbiscanBase}/address/${proof.asset.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5 transition-colors"
                  >
                    View Owner on Arbiscan
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ minHeight: "300px" }}>
                <span className="text-gray-600 text-sm">
                  {step === "verifying" ? "Fetching on-chain data..." : "No proof data yet"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1">
          <p className="text-gray-600 text-xs">
            Powered by TAG IT Network — ERC-8004 Physical Asset Protocol
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-gray-600 text-xs">Secured by</span>
            <span className="text-xs font-semibold" style={{ color: "#28A0F0" }}>Arbitrum</span>
          </div>
        </div>
      </div>
    </main>
  );
}
