// From world's protocol.schema.json, sha256 344e8003491d35f1bde0f61fef6988b6e4efe809ebeb8036af0cfeb8f0456a0c.
// Find the campus-server commit: git show <ref>:apps/world/protocol.schema.json | shasum -a 256

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
    /**
     * @description Whether somebody can be approached. available: the default. busy: they would rather not be. away: not at the keyboard — chosen, or set for them by the server once they have done nothing for `awayAfterSeconds`, and cleared when they do something again. Lasts as long as their connection.
     * @enum {string}
     */
    Status: "available" | "busy" | "away";
    /** @description Somebody on the map and what to draw for them. A later change to their sprite or name arrives as an `appearance` message, to their status as a `statusChanged`, and to their space as a `spaceChanged`. */
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
      status: components["schemas"]["Status"];
      /** @description The space they are standing in: a drawn space's key, or `_default` for the corridors and grounds. */
      spaceKey: string;
    };
    /** @description The audio call for the space you are standing in. A participant’s identity starts with their user id and a colon. */
    Call: {
      /** @description The media server to connect to. */
      url: string;
      room: string;
      /** @description Lets you join this room only, for about ten minutes. */
      token: string;
      /**
       * @description room: subscribe to everybody in it. proximity: subscribe only to the people the latest `nearby` names.
       * @enum {string}
       */
      hearing: "room" | "proximity";
      /** @description In tiles, for proximity: fade a voice to nothing across this distance. */
      audibleRadius: number;
      /** @description In tiles, for proximity: how far `nearby` reaches. */
      subscribeRadius: number;
    };
    /**
     * @description moved: one tile in the direction asked. blocked: the tile is not walkable; they turn to face it without moving. refused: the tile is floor, but in a space they may not enter (designated and not on its list, or locked); they turn to face it without moving. too_fast: over walking speed; nothing happens, not even the turn.
     * @enum {string}
     */
    MoveOutcome: "moved" | "blocked" | "refused" | "too_fast";
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
    /** @description Choose your status. Answered, if it changes what your cohort sees, by the `statusChanged` everybody in it gets, you included. Counts as activity. */
    SetStatusMessage: {
      /** @constant */
      type: "setStatus";
      status: components["schemas"]["Status"];
    };
    /** @description The person did something the server cannot see — a key, a click, a word in a call. Keeps them from going away while idle, and brings them back if they had. A `move` or `setStatus` counts already; a `ping` does not. No answer. */
    ActiveMessage: {
      /** @constant */
      type: "active";
    };
    /** @description Lock or unlock the space you are standing in, if `lockableSpaces` names it. Anybody inside may, guests included. Answered, if it changes anything, by the `lockChanged` everybody in your cohort gets, you included; in a space that cannot be locked, by a NOT_ALLOWED error. Counts as activity. */
    SetLockMessage: {
      /** @constant */
      type: "setLock";
      locked: boolean;
    };
    /** @description Every frame a client may send. */
    ClientMessage:
      | components["schemas"]["PingMessage"]
      | components["schemas"]["MoveMessage"]
      | components["schemas"]["SetStatusMessage"]
      | components["schemas"]["ActiveMessage"]
      | components["schemas"]["SetLockMessage"];
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
      /** @description How long you may do nothing before the server shows you away. Send `active` well within it while the person is there. 0 when this deployment never does. */
      awayAfterSeconds: number;
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
      /** @description The spaces whoever stands inside may lock. No other space can be, nor the corridors. The same in every cohort. */
      lockableSpaces: string[];
      /** @description The spaces locked in your cohort right now. */
      lockedSpaces: string[];
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
    /** @description Somebody in your cohort's status changed: chosen, or set to away while idle and back again. Sent to everybody in the cohort, you included when it is yours. */
    StatusChangedMessage: {
      /** @constant */
      type: "statusChanged";
      userId: string;
      status: components["schemas"]["Status"];
    };
    /** @description Somebody in your cohort stepped into another space. Sent to everybody in the cohort, you included when it is you, the moment the step is taken: it can arrive before the `moved` that shows the step. */
    SpaceChangedMessage: {
      /** @constant */
      type: "spaceChanged";
      userId: string;
      /** @description The space they are standing in: a drawn space's key, or `_default` for the corridors and grounds. */
      spaceKey: string;
    };
    /** @description Sent on arrival and each time you step into another space: leave the call you are in and join this one. Null where there is no call to join. */
    CallMessage: {
      /** @constant */
      type: "call";
      call: components["schemas"]["Call"] | null;
    };
    /** @description In a proximity space, who is close enough to hear, each time that changes: subscribe to their audio and drop everybody else’s. Can arrive before the `call` it applies to. */
    NearbyMessage: {
      /** @constant */
      type: "nearby";
      userIds: string[];
    };
    /** @description A space in your cohort was locked or unlocked. While it is locked, a step into it is refused, admins excepted. Sent to everybody in the cohort, you included. */
    LockChangedMessage: {
      /** @constant */
      type: "lockChanged";
      spaceKey: string;
      locked: boolean;
      /** @description Who locked or unlocked it. Null when the lock ended on its own: the last person inside left, or the space can no longer be locked. */
      userId: string | null;
    };
    /** @description Which spaces can be locked changed, because an admin changed a space: replaces the list from `snapshot`. */
    LockableSpacesMessage: {
      /** @constant */
      type: "lockableSpaces";
      spaceKeys: string[];
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
    /** @description UNAUTHORIZED comes just before the socket closes with 1008, `message` being the reason. BAD_MESSAGE leaves the socket open. NOT_ALLOWED answers a message the server understood but will not act on, and leaves the socket open. */
    ErrorMessage: {
      /** @constant */
      type: "error";
      /** @enum {string} */
      code: "UNAUTHORIZED" | "BAD_MESSAGE" | "NOT_ALLOWED";
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
      | components["schemas"]["StatusChangedMessage"]
      | components["schemas"]["SpaceChangedMessage"]
      | components["schemas"]["CallMessage"]
      | components["schemas"]["NearbyMessage"]
      | components["schemas"]["LockChangedMessage"]
      | components["schemas"]["LockableSpacesMessage"]
      | components["schemas"]["ReplacedMessage"]
      | components["schemas"]["MovedMessage"]
      | components["schemas"]["MoveResultMessage"]
      | components["schemas"]["ErrorMessage"];
    /** @description The reason world gives when it closes the socket, read from the close event. Each says which code comes with it and what to do. A 1008 reason this list does not have should be treated as "stop": never retry a refusal you do not understand. */
    CloseReason:
      | "no_token"
      | "token_not_usable"
      | "session_expired"
      | "session_ended"
      | "session_revoked"
      | "wrong_scope"
      | "account_suspended"
      | "account_gone"
      | "origin_not_allowed"
      | "no_cohort"
      | "not_a_member"
      | "rate_limited"
      | "entered_elsewhere"
      | "server shutting down"
      | "internal_error";
    /** @description The close codes world sends. Two more reach a client without world sending them: 1006, from the browser, when the connection is lost, a heartbeat is missed or the client reads too slowly (reconnect with backoff); and 1009, from the socket library, for a frame over the size limit (client bug; reconnect). */
    CloseCode: 1001 | 1008 | 1011 | 4000;
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type Direction = components["schemas"]["Direction"];
export type Player = components["schemas"]["Player"];
export type Status = components["schemas"]["Status"];
export type Avatar = components["schemas"]["Avatar"];
export type Call = components["schemas"]["Call"];
export type MoveOutcome = components["schemas"]["MoveOutcome"];
export type PingMessage = components["schemas"]["PingMessage"];
export type MoveMessage = components["schemas"]["MoveMessage"];
export type SetStatusMessage = components["schemas"]["SetStatusMessage"];
export type ActiveMessage = components["schemas"]["ActiveMessage"];
export type SetLockMessage = components["schemas"]["SetLockMessage"];
export type ClientMessage = components["schemas"]["ClientMessage"];
export type WelcomeMessage = components["schemas"]["WelcomeMessage"];
export type PongMessage = components["schemas"]["PongMessage"];
export type SnapshotMessage = components["schemas"]["SnapshotMessage"];
export type JoinedMessage = components["schemas"]["JoinedMessage"];
export type AppearanceMessage = components["schemas"]["AppearanceMessage"];
export type LeftMessage = components["schemas"]["LeftMessage"];
export type StatusChangedMessage =
  components["schemas"]["StatusChangedMessage"];
export type SpaceChangedMessage = components["schemas"]["SpaceChangedMessage"];
export type CallMessage = components["schemas"]["CallMessage"];
export type NearbyMessage = components["schemas"]["NearbyMessage"];
export type LockChangedMessage = components["schemas"]["LockChangedMessage"];
export type LockableSpacesMessage =
  components["schemas"]["LockableSpacesMessage"];
export type ReplacedMessage = components["schemas"]["ReplacedMessage"];
export type MovedMessage = components["schemas"]["MovedMessage"];
export type MoveResultMessage = components["schemas"]["MoveResultMessage"];
export type ErrorMessage = components["schemas"]["ErrorMessage"];
export type ServerMessage = components["schemas"]["ServerMessage"];
export type CloseReason = components["schemas"]["CloseReason"];
export type CloseCode = components["schemas"]["CloseCode"];
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
