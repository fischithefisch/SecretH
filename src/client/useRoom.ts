import { PartySocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientAction, ClientMessage, SeatClaim, ServerMessage } from "../game/protocol";
import type { PlayerView } from "../game/view";

const tokenKey = (room: string) => `sh:token:${room}`;
export const NAME_KEY = "sh:name";

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: rejoining after a reload won't work, the game still does.
  }
}

export type ConnectionStatus = "connecting" | "open" | "reconnecting";

export interface RoomState {
  status: ConnectionStatus;
  view: PlayerView | null;
  /** Server asked for a name (we have no valid seat in this room). */
  needName: { gameRunning: boolean } | null;
  error: { message: string; at: number } | null;
  /** Seat requests from other devices (only sent to players in the game). */
  claims: SeatClaim[];
  /** Seat this device asked to take over, waiting for approval. */
  pendingClaim: string | null;
  join: (name: string) => void;
  claimSeat: (playerId: string) => void;
  resolveClaim: (claimId: string, allow: boolean) => void;
  replaceWithBot: (playerId: string) => void;
  act: (action: ClientAction) => void;
  addBots: () => void;
  forgetSeat: () => void;
}

/**
 * Keeps a websocket to the room alive. iOS Safari silently kills sockets when
 * the phone locks or the app goes to the background, so on every return to the
 * foreground we ping and force a reconnect if the server doesn't answer.
 */
export function useRoom(room: string): RoomState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [view, setView] = useState<PlayerView | null>(null);
  const [needName, setNeedName] = useState<RoomState["needName"]>(null);
  const [error, setError] = useState<RoomState["error"]>(null);
  const [claims, setClaims] = useState<SeatClaim[]>([]);
  const [pendingClaim, setPendingClaim] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const pendingName = useRef<string | null>(null);
  const lastPong = useRef(Date.now());

  const sendRaw = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    const socket = new PartySocket({
      host: location.host,
      party: "game-room",
      room,
      maxReconnectionDelay: 4000,
      minReconnectionDelay: 300,
    });
    socketRef.current = socket;

    const hello = () => {
      const token = storageGet(tokenKey(room)) ?? undefined;
      sendRaw({ t: "hello", token, name: pendingName.current ?? undefined });
    };

    const onOpen = () => {
      setStatus("open");
      lastPong.current = Date.now();
      hello();
    };
    const onClose = () => setStatus((s) => (s === "connecting" ? s : "reconnecting"));
    const onMessage = (event: MessageEvent) => {
      lastPong.current = Date.now();
      const msg = JSON.parse(event.data as string) as ServerMessage;
      switch (msg.t) {
        case "welcome":
          storageSet(tokenKey(room), msg.token);
          pendingName.current = null;
          setNeedName(null);
          setPendingClaim(null);
          break;
        case "needName":
          storageSet(tokenKey(room), null);
          setNeedName({ gameRunning: msg.gameRunning });
          break;
        case "state":
          setView(msg.view);
          setClaims(msg.claims);
          break;
        case "claimPending":
          setPendingClaim(msg.playerId);
          break;
        case "claimDenied":
          setPendingClaim(null);
          setError({ message: "Die Anfrage wurde abgelehnt.", at: Date.now() });
          break;
        case "error":
          pendingName.current = null;
          setError({ message: msg.message, at: Date.now() });
          break;
        case "pong":
          break;
      }
    };
    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("message", onMessage);

    // Check that the connection is really alive whenever the app comes back.
    let checkTimer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const sentAt = Date.now();
      sendRaw({ t: "ping" });
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        if (lastPong.current < sentAt) {
          setStatus("reconnecting");
          socket.reconnect();
        }
      }, 2500);
    };
    const heartbeat = setInterval(check, 25_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);

    return () => {
      clearInterval(heartbeat);
      clearTimeout(checkTimer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", check);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("message", onMessage);
      socket.close();
      socketRef.current = null;
    };
  }, [room, sendRaw]);

  const join = useCallback(
    (name: string) => {
      pendingName.current = name;
      storageSet(NAME_KEY, name);
      // When closed, the hello in onOpen will carry the pending name.
      if (socketRef.current?.readyState === WebSocket.OPEN) sendRaw({ t: "hello", name });
    },
    [sendRaw],
  );

  const act = useCallback((action: ClientAction) => sendRaw({ t: "action", action }), [sendRaw]);

  const addBots = useCallback(() => sendRaw({ t: "addBots" }), [sendRaw]);
  const claimSeat = useCallback((playerId: string) => sendRaw({ t: "claimSeat", playerId }), [sendRaw]);
  const resolveClaim = useCallback(
    (claimId: string, allow: boolean) => sendRaw({ t: "resolveClaim", claimId, allow }),
    [sendRaw],
  );
  const replaceWithBot = useCallback((playerId: string) => sendRaw({ t: "replaceWithBot", playerId }), [sendRaw]);

  const forgetSeat = useCallback(() => storageSet(tokenKey(room), null), [room]);

  return {
    status,
    view,
    needName,
    error,
    claims,
    pendingClaim,
    join,
    claimSeat,
    resolveClaim,
    replaceWithBot,
    act,
    addBots,
    forgetSeat,
  };
}

/** Keeps the screen on during a game (iOS 16.4+, home-screen apps since 18.4). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
      } catch {
        // Not allowed (e.g. low power mode) – the game works without it.
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [active]);
}
