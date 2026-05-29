"use client";

/**
 * Client for the local NFC bridge (tagit-nfc-bridge).
 *
 * The bridge runs on the operator's machine and exposes a USB PC/SC reader
 * (ACR1252U) over a localhost WebSocket. It *pushes* card-present events on
 * every tap, so the UI can be fully tap-driven — no "scan" button. This module
 * provides the connection config (localStorage-backed) and a React hook that
 * surfaces live reader/card state plus a request() for RPC (NDEF, later).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { BridgeMessage, BridgeRequest, CardInfo, ResultMessage } from "./nfc-bridge-protocol";

const URL_KEY = "tagit.nfcBridge.url";
const TOKEN_KEY = "tagit.nfcBridge.token";
const DEFAULT_URL = "ws://127.0.0.1:8237";

export interface BridgeConfig {
  url: string;
  token: string;
}

export function getBridgeConfig(): BridgeConfig {
  if (typeof window === "undefined") return { url: DEFAULT_URL, token: "" };
  return {
    url: window.localStorage.getItem(URL_KEY) || DEFAULT_URL,
    token: window.localStorage.getItem(TOKEN_KEY) || "",
  };
}

export function setBridgeConfig(config: Partial<BridgeConfig>): void {
  if (typeof window === "undefined") return;
  if (config.url !== undefined) window.localStorage.setItem(URL_KEY, config.url);
  if (config.token !== undefined) window.localStorage.setItem(TOKEN_KEY, config.token);
}

export interface NfcBridgeState {
  /** WebSocket connected to the bridge process. */
  wsConnected: boolean;
  /** A physical reader is plugged in and recognized by the bridge. */
  readerConnected: boolean;
  readerName: string | null;
  /** Card currently on the antenna (null when removed). */
  card: CardInfo | null;
  bridgeVersion: string | null;
  error: string | null;
  config: BridgeConfig;
  /** True overall: bridge available AND reader plugged in. */
  ready: boolean;
}

/**
 * Distributive Omit — non-distributive `Omit<BridgeRequest, "id">` collapses the
 * union to its common keys (just `type`), which means newly-added request
 * shapes like `personalize-sdm` lose their extra fields. Distributing keeps
 * each variant's own shape.
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type BridgeRequestPayload = DistributiveOmit<BridgeRequest, "id">;

export interface UseNfcBridge extends NfcBridgeState {
  /** Send an RPC request and await the bridge's result payload. */
  request: (req: BridgeRequestPayload) => Promise<unknown>;
  /** Update connection config and reconnect. */
  updateConfig: (config: Partial<BridgeConfig>) => void;
  reconnect: () => void;
}

const RECONNECT_MS = 2500;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Connect to the bridge and track live reader/card state.
 * @param enabled - set false to keep the socket closed (e.g. modal not open).
 */
export function useNfcBridge(enabled = true): UseNfcBridge {
  const [config, setConfig] = useState<BridgeConfig>(() => getBridgeConfig());
  const [state, setState] = useState<NfcBridgeState>(() => ({
    wsConnected: false,
    readerConnected: false,
    readerName: null,
    card: null,
    bridgeVersion: null,
    error: null,
    config: getBridgeConfig(),
    ready: false,
  }));

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<
    Map<
      string,
      {
        resolve: (v: unknown) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());
  const closedByUs = useRef(false);

  const patch = useCallback((p: Partial<NfcBridgeState>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      next.ready = next.wsConnected && next.readerConnected;
      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    const { url, token } = getBridgeConfig();
    if (!token) {
      patch({ error: "No bridge token set", wsConnected: false });
      return;
    }

    closedByUs.current = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      patch({ error: err instanceof Error ? err.message : "bad bridge URL" });
      return;
    }
    wsRef.current = socket;

    socket.onopen = () => patch({ wsConnected: true, error: null });

    socket.onmessage = (event) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      handleMessage(msg);
    };

    socket.onerror = () => {
      patch({ error: "Cannot reach bridge — is tagit-nfc-bridge running?" });
    };

    socket.onclose = () => {
      patch({ wsConnected: false, readerConnected: false, readerName: null, card: null });
      // Reject any in-flight requests.
      for (const [, p] of pendingRef.current) {
        clearTimeout(p.timer);
        p.reject(new Error("bridge disconnected"));
      }
      pendingRef.current.clear();
      if (!closedByUs.current) {
        reconnectRef.current = setTimeout(connect, RECONNECT_MS);
      }
    };

    function handleMessage(msg: BridgeMessage) {
      switch (msg.type) {
        case "hello":
          patch({ bridgeVersion: msg.bridgeVersion });
          break;
        case "reader-status":
          patch({ readerConnected: msg.connected, readerName: msg.readerName });
          break;
        case "card-present":
          patch({ card: msg.card, error: null });
          break;
        case "card-removed":
          patch({ card: null });
          break;
        case "result": {
          const pending = pendingRef.current.get((msg as ResultMessage).id);
          if (pending) {
            clearTimeout(pending.timer);
            pending.resolve((msg as ResultMessage).data);
            pendingRef.current.delete((msg as ResultMessage).id);
          }
          break;
        }
        case "error": {
          if (msg.id) {
            const pending = pendingRef.current.get(msg.id);
            if (pending) {
              clearTimeout(pending.timer);
              pending.reject(new Error(msg.message));
              pendingRef.current.delete(msg.id);
            }
          } else {
            patch({ error: msg.message });
          }
          break;
        }
      }
    }
  }, [patch]);

  const disconnect = useCallback(() => {
    closedByUs.current = true;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const request = useCallback((req: BridgeRequestPayload): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error("bridge not connected"));
        return;
      }
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error("bridge request timed out"));
      }, REQUEST_TIMEOUT_MS);
      pendingRef.current.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ ...req, id }));
    });
  }, []);

  const updateConfig = useCallback(
    (next: Partial<BridgeConfig>) => {
      setBridgeConfig(next);
      const merged = getBridgeConfig();
      setConfig(merged);
      patch({ config: merged });
      disconnect();
      closedByUs.current = false;
      setTimeout(connect, 50);
    },
    [connect, disconnect, patch],
  );

  const reconnect = useCallback(() => {
    disconnect();
    closedByUs.current = false;
    setTimeout(connect, 50);
  }, [connect, disconnect]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, connect]);

  return { ...state, config, request, updateConfig, reconnect };
}
