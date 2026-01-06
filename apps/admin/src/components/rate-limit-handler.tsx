"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, Button } from "@tagit/ui";
import { AlertCircle, RefreshCw, Clock } from "lucide-react";

interface RateLimitState {
  isRateLimited: boolean;
  retryAfter: number | null;
  lastError: string | null;
}

interface RateLimitContextValue extends RateLimitState {
  setRateLimited: (retryAfter?: number) => void;
  clearRateLimit: () => void;
  handleError: (error: unknown) => boolean;
}

const RateLimitContext = createContext<RateLimitContextValue | null>(null);

/**
 * Provider for rate limit state management across the app
 */
export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: null,
    lastError: null,
  });

  const setRateLimited = useCallback((retryAfter?: number) => {
    setState({
      isRateLimited: true,
      retryAfter: retryAfter || 60,
      lastError: "Too many requests. Please wait before trying again.",
    });

    // Auto-clear after retryAfter seconds
    if (retryAfter) {
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isRateLimited: false,
          retryAfter: null,
        }));
      }, retryAfter * 1000);
    }
  }, []);

  const clearRateLimit = useCallback(() => {
    setState({
      isRateLimited: false,
      retryAfter: null,
      lastError: null,
    });
  }, []);

  const handleError = useCallback((error: unknown): boolean => {
    const errorString = error instanceof Error ? error.message : String(error);
    const lowerError = errorString.toLowerCase();

    // Check for rate limit indicators
    if (
      lowerError.includes("429") ||
      lowerError.includes("rate limit") ||
      lowerError.includes("too many requests") ||
      lowerError.includes("exceeded") ||
      lowerError.includes("throttle")
    ) {
      // Try to extract retry-after
      const retryMatch = errorString.match(/retry[- ]?after[:\s]*(\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60;

      setRateLimited(retryAfter);
      return true;
    }

    return false;
  }, [setRateLimited]);

  return (
    <RateLimitContext.Provider
      value={{
        ...state,
        setRateLimited,
        clearRateLimit,
        handleError,
      }}
    >
      {children}
    </RateLimitContext.Provider>
  );
}

/**
 * Hook to access rate limit state
 */
export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (!context) {
    // Return default values if not wrapped in provider
    return {
      isRateLimited: false,
      retryAfter: null,
      lastError: null,
      setRateLimited: () => {},
      clearRateLimit: () => {},
      handleError: () => false,
    };
  }
  return context;
}

/**
 * Banner component shown when rate limited
 */
export function RateLimitBanner() {
  const { isRateLimited, retryAfter, clearRateLimit } = useRateLimit();

  if (!isRateLimited) return null;

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/10 mb-4">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700">Rate Limited</p>
              <p className="text-sm text-yellow-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Too many requests. Please wait {retryAfter} seconds before trying again.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearRateLimit}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * HOC for wrapping async functions with rate limit handling
 */
export function withRateLimitHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  onRateLimit: () => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      if (
        errorString.includes("429") ||
        errorString.toLowerCase().includes("rate limit")
      ) {
        onRateLimit();
      }
      throw error;
    }
  }) as T;
}

/**
 * Utility to create exponential backoff delays
 */
export function getBackoffDelay(attempt: number, baseMs: number = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorString = lastError.message.toLowerCase();

      // Only retry on rate limit or temporary errors
      if (
        !errorString.includes("429") &&
        !errorString.includes("rate limit") &&
        !errorString.includes("timeout") &&
        !errorString.includes("network")
      ) {
        throw lastError;
      }

      if (attempt < maxAttempts - 1) {
        const delay = getBackoffDelay(attempt, baseDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
