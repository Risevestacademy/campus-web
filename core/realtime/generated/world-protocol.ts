export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /**
     * @description One tile in screen terms: up is y - 1, right is x + 1.
     * @enum {string}
     */
    Direction: "up" | "down" | "left" | "right";
    /** @description Somebody on the map, as the server has them. Positions are tiles, never pixels. */
    Player: {
      userId: string;
      /** @description Tile column, from 0 at the left edge. */
      x: number;
      /** @description Tile row, from 0 at the top edge. */
      y: number;
      facing: components["schemas"]["Direction"];
    };
    /** @description Somebody on the map and what to draw for them. A later change to their sprite or name arrives as an `appearance` message. */
    Avatar: {
      userId: string;
      /** @description Tile column, from 0 at the left edge. */
      x: number;
      /** @description Tile row, from 0 at the top edge. */
      y: number;
      facing: components["schemas"]["Direction"];
      /** @description The name to show beside them. Null when they have set none. */
      displayName: string | null;
      /** @description Which character to draw them as. Null when they have picked none; draw the default then, and for a key you have no sprite for. */
      spriteKey: string | null;
    };
    /**
     * @description moved: one tile in the direction asked. blocked: the tile is not walkable; they turn to face it without moving. too_fast: over walking speed; nothing happens, not even the turn.
     * @enum {string}
     */
    MoveOutcome: "moved" | "blocked" | "too_fast";
    /** @description Answered with `pong`. */
    PingMessage: {
      /** @constant */
      type: "ping";
    };
    /** @description One step. Always answered with a `moveResult`. */
    MoveMessage: {
      /** @constant */
      type: "move";
      /** @description Which way, never where to: the server works out the tile. */
      direction: components["schemas"]["Direction"];
      /** @description The client's own counter, echoed on the `moveResult` so it can match the answer to the step it already drew. */
      seq: number;
    };
    /** @description Every frame a client may send. */
    ClientMessage:
      | components["schemas"]["PingMessage"]
      | components["schemas"]["MoveMessage"];
    /** @description First frame on a socket that was let in. */
    WelcomeMessage: {
      /** @constant */
      type: "welcome";
      userId: string;
      connectionId: string;
      heartbeatSeconds: number;
      /** @description Walking speed: one tile per this many milliseconds. Animate a step over this long, and send no faster, or moves come back `too_fast`. */
      stepMs: number;
      /** @description How often `moved` arrives while anybody is moving. */
      tickMs: number;
      /** @description The name to show beside them. Null when they have set none. */
      displayName: string | null;
      /** @description Which character to draw them as. Null when they have picked none; draw the default then, and for a key you have no sprite for. */
      spriteKey: string | null;
    };
    /** @description The answer to a `ping`. */
    PongMessage: {
      /** @constant */
      type: "pong";
    };
    /** @description Sent once, right after `welcome`: the map, and everybody in your cohort on it, you included. Nobody from another cohort is ever in it. */
    SnapshotMessage: {
      /** @constant */
      type: "snapshot";
      map: {
        /** @description Which published map this is. With `version`, what to load: the server enforces exactly that one. */
        id: string;
        /** @description The published version the server loaded. Load this version, not the current one: a map published since would have walls the server does not. */
        version: string;
        /** @description In tiles. */
        width: number;
        /** @description In tiles. */
        height: number;
      };
      players: components["schemas"]["Avatar"][];
    };
    /** @description Somebody arrived in your cohort. Not sent when a socket is replaced within the same cohort, because the avatar never left. */
    JoinedMessage: {
      /** @constant */
      type: "joined";
      player: components["schemas"]["Avatar"];
    };
    /** @description Somebody in your cohort changed their sprite or display name, you included: draw them with these from now on. Sent as soon as they save the change. */
    AppearanceMessage: {
      /** @constant */
      type: "appearance";
      userId: string;
      /** @description The name to show beside them. Null when they have set none. */
      displayName: string | null;
      /** @description Which character to draw them as. Null when they have picked none; draw the default then, and for a key you have no sprite for. */
      spriteKey: string | null;
    };
    /** @description Somebody's socket in your cohort closed. Entering another cohort is not leaving this one. */
    LeftMessage: {
      /** @constant */
      type: "left";
      userId: string;
    };
    /** @description This account opened this cohort's campus somewhere else — another device or tab — and that connection has taken its place. Being in another cohort never causes this. The socket closes immediately afterwards with 4000 `entered_elsewhere`. Do NOT reconnect: the two connections would replace each other for as long as both stayed open. Show that they are in this campus elsewhere, and reconnect only when they ask to come back here. */
    ReplacedMessage: {
      /** @constant */
      type: "replaced";
    };
    /** @description Everybody in your cohort who moved or turned since the last tick, once each, as they stand now: two steps inside one tick arrive as the second, so an entry can be more than one tile from where they were. Sent once per tick, and not at all when nobody moved. You are never in your own `moved` frame — your `moveResult` already says where you ended up. */
    MovedMessage: {
      /** @constant */
      type: "moved";
      players: components["schemas"]["Player"][];
    };
    /** @description The answer to one admitted `move`. `player` is where the server has them; on anything but `moved`, the client snaps back to it. */
    MoveResultMessage: {
      /** @constant */
      type: "moveResult";
      seq: number;
      outcome: components["schemas"]["MoveOutcome"];
      player: components["schemas"]["Player"];
    };
    /** @description UNAUTHORIZED comes just before the socket closes with 1008, `message` being the reason. BAD_MESSAGE leaves the socket open. */
    ErrorMessage: {
      /** @constant */
      type: "error";
      /** @enum {string} */
      code: "UNAUTHORIZED" | "BAD_MESSAGE";
      message: string;
    };
    /** @description Every frame the server may send. */
    ServerMessage:
      | components["schemas"]["WelcomeMessage"]
      | components["schemas"]["PongMessage"]
      | components["schemas"]["SnapshotMessage"]
      | components["schemas"]["JoinedMessage"]
      | components["schemas"]["AppearanceMessage"]
      | components["schemas"]["LeftMessage"]
      | components["schemas"]["ReplacedMessage"]
      | components["schemas"]["MovedMessage"]
      | components["schemas"]["MoveResultMessage"]
      | components["schemas"]["ErrorMessage"];
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type Direction = components["schemas"]["Direction"];
export type Player = components["schemas"]["Player"];
export type Avatar = components["schemas"]["Avatar"];
export type MoveOutcome = components["schemas"]["MoveOutcome"];
export type PingMessage = components["schemas"]["PingMessage"];
export type MoveMessage = components["schemas"]["MoveMessage"];
export type ClientMessage = components["schemas"]["ClientMessage"];
export type WelcomeMessage = components["schemas"]["WelcomeMessage"];
export type PongMessage = components["schemas"]["PongMessage"];
export type SnapshotMessage = components["schemas"]["SnapshotMessage"];
export type JoinedMessage = components["schemas"]["JoinedMessage"];
export type AppearanceMessage = components["schemas"]["AppearanceMessage"];
export type LeftMessage = components["schemas"]["LeftMessage"];
export type ReplacedMessage = components["schemas"]["ReplacedMessage"];
export type MovedMessage = components["schemas"]["MovedMessage"];
export type MoveResultMessage = components["schemas"]["MoveResultMessage"];
export type ErrorMessage = components["schemas"]["ErrorMessage"];
export type ServerMessage = components["schemas"]["ServerMessage"];
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
