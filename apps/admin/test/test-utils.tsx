import React, { type ReactNode, type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";

// Mock providers wrapper for testing components that need context
function TestProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Custom render function that wraps components in necessary providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Override render with custom render
export { customRender as render };

// Helper to wait for loading states
export async function waitForLoadingToFinish() {
  // Wait a tick for state updates
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Helper to create mock functions with typed return values
export function createMockFn<T>(returnValue: T) {
  return vi.fn().mockReturnValue(returnValue);
}

// Helper to create mock async functions
export function createMockAsyncFn<T>(returnValue: T) {
  return vi.fn().mockResolvedValue(returnValue);
}

// Helper for testing form submissions
export async function fillAndSubmitForm(
  user: ReturnType<typeof import("@testing-library/user-event").default.setup>,
  fields: Record<string, string>,
  submitButtonText: string
) {
  const { getByRole, getByLabelText } = await import("@testing-library/react");

  for (const [label, value] of Object.entries(fields)) {
    const input = getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
  }

  const submitButton = getByRole("button", { name: submitButtonText });
  await user.click(submitButton);
}

// Mock data generators
export function generateMockAddress(seed: number = 0): `0x${string}` {
  return `0x${(seed + 1).toString(16).padStart(40, "0")}` as `0x${string}`;
}

export function generateMockTxHash(seed: number = 0): `0x${string}` {
  return `0x${(seed + 1).toString(16).padStart(64, "0")}` as `0x${string}`;
}

export function generateMockAsset(id: number) {
  return {
    id: BigInt(id),
    owner: generateMockAddress(id),
    state: id % 7,
    tagId: `0x${"a".repeat(64)}`,
    metadataURI: `ipfs://QmTest${id}`,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * id),
    updatedAt: BigInt(Math.floor(Date.now() / 1000)),
  };
}

// Test ID helpers
export const testIds = {
  metricCard: (name: string) => `metric-${name.toLowerCase().replace(/\s+/g, "-")}`,
  stateBadge: (state: number) => `state-badge-${state}`,
  addressBadge: "address-badge",
  resolutionBadge: "resolution-badge",
  voteBar: "vote-bar",
  loadingSkeleton: "loading-skeleton",
};
