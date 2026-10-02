import { routePartykitRequest, Server, type Connection } from "partyserver";
import { BOT_NAMES, botAction } from "../game/bots";
import { applyAction, createGame } from "../game/engine";
import { clientMessageSchema, type ServerMessage } from "../game/protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../game/rules";
import type { GameState, Rng } from "../game/types";
import { viewFor } from "../game/view";

interface Env {
  GameRoom: DurableObjectNamespace<GameRoom>;
}

interface ConnState {
  playerId: string | null;
}

interface Stored {
  game: GameState;
  /** rejoin token -> player id. Tokens never leave the server except to their owner. */
  tokens: Record<string, string>;
}

/** Rooms with nobody connected are deleted after this long. */
const ROOM_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** Pause before a bot acts, so humans can follow what happens. */
const BOT_DELAY_MS = 1200;
const ROOM_CODE = /^[A-Z0-9]{4,8}$/;

const secureRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One instance per room code. Holds the only full copy of the game state. */
export class GameRoom extends Server<Env> {
  static options = { hibernate: true };

  private data: Stored = { game: createGame(), tokens: {} };
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  async onStart() {
    const stored = await this.ctx.storage.get<Stored>("data");
    if (stored) this.data = stored;
    this.scheduleBots();
  }

  /** Lets bots make their next move after a short pause. */
  private scheduleBots() {
    if (this.botTimer || !botAction(this.data.game, secureRng)) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const action = botAction(this.data.game, secureRng);
      if (!action) return;
      const result = applyAction(this.data.game, action, secureRng);
      if (!result.ok) return; // should not happen; bots only pick legal moves
      this.data = { ...this.data, game: result.state };
      void this.save();
      this.broadcastState();
      this.scheduleBots();
    }, BOT_DELAY_MS);
  }

  private async save() {
    await this.ctx.storage.put("data", this.data);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  async onAlarm() {
    if ([...this.getConnections()].length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
    this.data = { game: createGame(), tokens: {} };
  }

  private send(conn: Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private playerIdOf(conn: Connection<ConnState>): string | null {
    const id = conn.state?.playerId ?? null;
    return id && this.data.game.players.some((p) => p.id === id) ? id : null;
  }

  /** Sends every connection its own filtered view of the game. */
  private broadcastState(excludeId?: string) {
    const conns = [...this.getConnections<ConnState>()].filter((c) => c.id !== excludeId);
    const connected = new Set(conns.map((c) => this.playerIdOf(c)).filter((id): id is string => !!id));
    for (const conn of conns) {
      this.send(conn, { t: "state", view: viewFor(this.data.game, this.playerIdOf(conn), connected) });
    }
  }

  onConnect(conn: Connection<ConnState>) {
    conn.setState({ playerId: null });
  }

  onClose(conn: Connection<ConnState>) {
    this.broadcastState(conn.id);
  }

  async onMessage(conn: Connection<ConnState>, raw: string | ArrayBuffer | ArrayBufferView) {
    if (typeof raw !== "string" || raw.length > 4096) return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = clientMessageSchema.safeParse(json);
    if (!parsed.success) return this.send(conn, { t: "error", message: "Ungültige Nachricht." });
    const msg = parsed.data;

    if (msg.t === "ping") return this.send(conn, { t: "pong" });

    if (msg.t === "addBots") {
      const game = this.data.game;
      if (this.playerIdOf(conn) !== game.hostId || game.phase.kind !== "lobby") {
        return this.send(conn, { t: "error", message: "Nur der Host kann in der Lobby Bots hinzufügen." });
      }
      // Fill up to the minimum, or add one more if the room is already playable.
      const target = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, game.players.length + 1));
      let next = game;
      for (const botName of BOT_NAMES) {
        if (next.players.length >= target) break;
        const name = `${botName} (Bot)`;
        if (next.players.some((p) => p.name === name)) continue;
        const result = applyAction(next, { type: "join", playerId: randomHex(8), name, bot: true }, secureRng);
        if (result.ok) next = result.state;
      }
      this.data = { ...this.data, game: next };
      await this.save();
      return this.broadcastState();
    }

    if (msg.t === "hello") {
      const known = msg.token ? this.data.tokens[msg.token] : undefined;
      if (known && this.data.game.players.some((p) => p.id === known)) {
        conn.setState({ playerId: known });
        this.send(conn, { t: "welcome", playerId: known, token: msg.token! });
        return this.broadcastState();
      }
      if (!msg.name) {
        this.send(conn, { t: "needName", gameRunning: this.data.game.phase.kind !== "lobby" });
        return this.broadcastState();
      }
      const playerId = randomHex(8);
      const result = applyAction(this.data.game, { type: "join", playerId, name: msg.name }, secureRng);
      if (!result.ok) return this.send(conn, { t: "error", message: result.error });
      const token = randomHex(24);
      this.data = { game: result.state, tokens: { ...this.data.tokens, [token]: playerId } };
      await this.save();
      conn.setState({ playerId });
      this.send(conn, { t: "welcome", playerId, token });
      return this.broadcastState();
    }

    const by = this.playerIdOf(conn);
    if (!by) return this.send(conn, { t: "error", message: "Du bist nicht in diesem Spiel." });
    const result = applyAction(this.data.game, { ...msg.action, by }, secureRng);
    if (!result.ok) return this.send(conn, { t: "error", message: result.error });

    // Players who left or were kicked lose their rejoin token.
    const remaining = new Set(result.state.players.map((p) => p.id));
    const tokens = Object.fromEntries(Object.entries(this.data.tokens).filter(([, id]) => remaining.has(id)));
    this.data = { game: result.state, tokens };
    await this.save();
    this.broadcastState();
    this.scheduleBots();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        onBeforeConnect: (_req, { name }) => {
          if (!ROOM_CODE.test(name)) return new Response("Ungültiger Raumcode", { status: 404 });
        },
        onBeforeRequest: () => new Response("Not found", { status: 404 }),
      })) ?? new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
