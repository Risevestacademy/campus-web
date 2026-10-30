// From world's protocol.schema.json, sha256 fca7f26e1a93991cf5d13214952ff07706810c26fbbbf068166cb22779f6247e.
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
    /** @description What to call a space a `spaceKey` names. The same in every cohort. */
    SpaceName: {
      /** @description A drawn space's key, or `_default` for the corridors and grounds. */
      spaceKey: string;
      /** @description What to show for it. The key itself when campus-api has no row for the space yet. */
      name: string;
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
    /** @description Your cohort’s broadcast room, where admins speak to everybody in the campus. Join it beside the call for your space and stay in it wherever you walk. Subscribe to every audio track in it and play it over everything else, with the call for your space carrying on quieter underneath; it cannot be muted. Several admins may speak at once. A broadcast starts and stops as a track is published and unpublished in this room. */
    BroadcastCall: {
      /** @description The media server to connect to. */
      url: string;
      room: string;
      /** @description Lets you join this room only: within a minute if you may speak, ten if you only listen. Join with it straight away. */
      token: string;
      /** @description You are an admin: you may publish your microphone here, and nothing else. Everybody else only listens. */
      canSpeak: boolean;
    };
    /**
     * @description moved: one tile in the direction asked. blocked: the tile is not walkable; they turn to face it without moving. refused: the tile is floor, but in a space they may not enter (designated and not on its list, or locked); they turn to face it without moving, and may ask with `requestEntry`. too_fast: over walking speed; nothing happens, not even the turn.
     * @enum {string}
     */
    MoveOutcome: "moved" | "blocked" | "refused" | "too_fast";
    /**
     * @description arrived: you are one tile from them, in their space, never on their tile. stopped: you sent `stopWalking` or a `move`. refused: a space you may not enter is in the way, theirs or another, and you stopped beside the first one; `mayAsk` says whether asking to enter it would be taken. gone: they left, or were not here. elsewhere: they are online, but connected to another world server, which a walk cannot reach. no_way: no path reaches a tile beside them in their space: walls, a space with no room beside them, or a chase past the step limit. moved_by_staff: staff removed you from a space mid-walk.
     * @enum {string}
     */
    WalkEndReason:
      | "arrived"
      | "stopped"
      | "refused"
      | "gone"
      | "elsewhere"
      | "no_way"
      | "moved_by_staff";
    /**
     * @description admitted: a yes. Their next step into the space is let through; walking away from beside it first lets the yes lapse. declined: a no. withdrawn: the asker withdrew it, or disconnected. walked_away: the asker left the tiles beside the space. nobody_inside: nobody inside can answer any more. not_needed: they may walk in without asking now, as the space was unlocked or its list names them. cancelled: the space no longer takes requests.
     * @enum {string}
     */
    EntryRequestOutcome:
      | "admitted"
      | "declined"
      | "withdrawn"
      | "walked_away"
      | "nobody_inside"
      | "not_needed"
      | "cancelled";
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
    /** @description Ask to enter a space you are refused: a locked one, a designated one whose list does not name you, or one staff removed you from in the last 90 seconds. Only from a tile beside it, only while somebody inside can answer, and one request at a time. Answered by `entryRequested`, to you and to whoever inside can answer; otherwise by a NOT_ALLOWED error saying why. After a no, the same space can be asked again 30 seconds later. Counts as activity. */
    RequestEntryMessage: {
      /** @constant */
      type: "requestEntry";
      spaceKey: string;
    };
    /** @description Withdraw your open request, answered by its `entryRequestEnded`. A `requestId` that is not your open request, as one that has ended, gets a NOT_ALLOWED error. Counts as activity. */
    WithdrawEntryRequestMessage: {
      /** @constant */
      type: "withdrawEntryRequest";
      /** @description This request, not the person asking: asking again gets a new one. Answer and withdraw with it, so a late answer never reaches a newer request. */
      requestId: string;
    };
    /** @description Answer a request to enter the space you are standing in. Anybody inside a locked space may; in a designated space, only somebody its list names, or an admin. The first answer stands: one that comes later, names a request that has ended, or comes from somebody who may not answer, gets a NOT_ALLOWED error. Counts as activity. */
    AnswerEntryRequestMessage: {
      /** @constant */
      type: "answerEntryRequest";
      /** @description This request, not the person asking: asking again gets a new one. Answer and withdraw with it, so a late answer never reaches a newer request. */
      requestId: string;
      admit: boolean;
    };
    /** @description A line of chat to whoever can hear you: everybody in a whole-room space, or the people within its subscribe radius in a proximity space, measured when you send it, without the hysteresis `nearby` keeps, so the two need not match at the edge. Up to 500 characters, trimmed. Answered by the `said` you and they get; five lines at once, then one a second, after which a NOT_ALLOWED error. Never stored. Counts as activity. */
    SayMessage: {
      /** @constant */
      type: "say";
      text: string;
    };
    /** @description Staff only: switch off somebody’s microphone in the call for their space, once; they may switch it back on. An admin may mute anybody in the cohort’s campus; a professor or mentor only somebody in the designated space they stand in, whose list names them. Never an admin, never yourself. Answered by `staffAction`, to you and to them; otherwise by a NOT_ALLOWED error saying why. Counts as activity. */
    MuteMessage: {
      /** @constant */
      type: "mute";
      /** @description Whose microphone to switch off. */
      userId: string;
    };
    /** @description Staff only, the same staff as for `mute`: move somebody out of the space they stand in, to the nearest tile outside it, and keep them out for 90 seconds; they may ask to enter meanwhile. Not from the corridors, nor from a space that takes no requests. Answered by `staffAction`, to you and to them; otherwise by a NOT_ALLOWED error saying why. Counts as activity. */
    RemoveFromSpaceMessage: {
      /** @constant */
      type: "removeFromSpace";
      /** @description Whom to remove from the space they stand in. */
      userId: string;
    };
    /** @description Have the server walk you to somebody, a step per `stepMs`, through the same doors your own steps would be. Each step is a `walking`; the walk ends with one `walkEnded`. Replaces a walk already going. Somebody connected to another world server ends it with `elsewhere`. Yourself is a NOT_ALLOWED error. Counts as activity. */
    GoToMessage: {
      /** @constant */
      type: "goTo";
      /** @description Whom to walk to: in your cohort, on this world server. */
      userId: string;
    };
    /** @description End the walk `goTo` started, answered by `walkEnded` with `stopped`. A `move` ends it too. Counts as activity. */
    StopWalkingMessage: {
      /** @constant */
      type: "stopWalking";
    };
    /** @description Every frame a client may send. */
    ClientMessage:
      | components["schemas"]["PingMessage"]
      | components["schemas"]["MoveMessage"]
      | components["schemas"]["SetStatusMessage"]
      | components["schemas"]["ActiveMessage"]
      | components["schemas"]["SetLockMessage"]
      | components["schemas"]["RequestEntryMessage"]
      | components["schemas"]["WithdrawEntryRequestMessage"]
      | components["schemas"]["AnswerEntryRequestMessage"]
      | components["schemas"]["SayMessage"]
      | components["schemas"]["MuteMessage"]
      | components["schemas"]["RemoveFromSpaceMessage"]
      | components["schemas"]["GoToMessage"]
      | components["schemas"]["StopWalkingMessage"];
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
      /** @description Every space a `spaceKey` can name on this map, `_default` first. */
      spaces: components["schemas"]["SpaceName"][];
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
    /** @description Sent on arrival, and again when you are made or stop being an admin: leave the broadcast room you are in and join this one. Null where there is none to join; when a token could not be made, another comes within a heartbeat. */
    BroadcastMessage: {
      /** @constant */
      type: "broadcast";
      call: components["schemas"]["BroadcastCall"] | null;
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
    /** @description A space was renamed, or campus-api gained or lost a row for one: replaces `snapshot.spaces`. Sent to everybody. */
    SpacesMessage: {
      /** @constant */
      type: "spaces";
      spaces: components["schemas"]["SpaceName"][];
    };
    /** @description Somebody asks to enter a space. Sent to the asker, and to each person inside who may answer, as they become able to: on the request, or on stepping in later. Every one is followed by an `entryRequestEnded` with the same `requestId`. Only answerable while you stand in that space. */
    EntryRequestedMessage: {
      /** @constant */
      type: "entryRequested";
      /** @description This request, not the person asking: asking again gets a new one. Answer and withdraw with it, so a late answer never reaches a newer request. */
      requestId: string;
      /** @description Who is asking. */
      userId: string;
      spaceKey: string;
    };
    /** @description A request to enter is over. Sent to the asker and to everybody who was sent its `entryRequested`. */
    EntryRequestEndedMessage: {
      /** @constant */
      type: "entryRequestEnded";
      /** @description This request, not the person asking: asking again gets a new one. Answer and withdraw with it, so a late answer never reaches a newer request. */
      requestId: string;
      /** @description Who asked. */
      userId: string;
      spaceKey: string;
      outcome: components["schemas"]["EntryRequestOutcome"];
      /** @description Who said yes or no. Null for every other outcome. */
      answeredBy: string | null;
    };
    /** @description A line of chat from somebody who could be heard where you stand when they said it, or your own. World keeps none of it: a line reaches whoever is in earshot at that moment and nobody later. */
    SaidMessage: {
      /** @constant */
      type: "said";
      /** @description Unique to this line. */
      id: string;
      /** @description Who said it. */
      userId: string;
      /** @description The space they said it in, so a meeting’s chat can be kept apart. */
      spaceKey: string;
      text: string;
      /** @description When world relayed it, as an ISO timestamp. */
      at: string;
    };
    /** @description Staff muted somebody or removed them from a space. Sent to the person it was done to and to the staff member who did it. Their cohort sees a removal as a `moved` and a `spaceChanged`. */
    StaffActionMessage: {
      /** @constant */
      type: "staffAction";
      /**
       * @description muted: their microphone was switched off; they may switch it on again. removed: they were moved out of the space and are kept out until `until`.
       * @enum {string}
       */
      action: "muted" | "removed";
      /** @description Whom it was done to. */
      userId: string;
      /** @description The staff member who did it. */
      by: string;
      /** @description The space it was done in. */
      spaceKey: string;
      /** @description For removed: when they may walk back in, as an ISO timestamp. Null for muted. */
      until: string | null;
      /** @description For removed: where they stand now, outside the space. Snap them there. Null for muted. */
      player: components["schemas"]["Player"] | null;
    };
    /** @description The server took a step of your `goTo` walk: where you are now. Only to you; everybody else sees it in `moved`. */
    WalkingMessage: {
      /** @constant */
      type: "walking";
      /** @description Whom you are walking to. */
      userId: string;
      player: components["schemas"]["Player"];
    };
    /** @description Your `goTo` walk is over, and why. Only to you. Not sent when the socket closes. */
    WalkEndedMessage: {
      /** @constant */
      type: "walkEnded";
      /** @description Whom you were walking to. */
      userId: string;
      reason: components["schemas"]["WalkEndReason"];
      /** @description Where you stopped. */
      player: components["schemas"]["Player"];
      /** @description With `refused`, the space you stopped beside. */
      spaceKey: string | null;
      /** @description With `refused`, whether a `requestEntry` for `spaceKey` would be taken from where you stopped. Offer to ask only when true. */
      mayAsk: boolean;
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
      | components["schemas"]["BroadcastMessage"]
      | components["schemas"]["NearbyMessage"]
      | components["schemas"]["LockChangedMessage"]
      | components["schemas"]["LockableSpacesMessage"]
      | components["schemas"]["SpacesMessage"]
      | components["schemas"]["EntryRequestedMessage"]
      | components["schemas"]["EntryRequestEndedMessage"]
      | components["schemas"]["SaidMessage"]
      | components["schemas"]["StaffActionMessage"]
      | components["schemas"]["WalkingMessage"]
      | components["schemas"]["WalkEndedMessage"]
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
export type SpaceName = components["schemas"]["SpaceName"];
export type Call = components["schemas"]["Call"];
export type BroadcastCall = components["schemas"]["BroadcastCall"];
export type MoveOutcome = components["schemas"]["MoveOutcome"];
export type WalkEndReason = components["schemas"]["WalkEndReason"];
export type EntryRequestOutcome = components["schemas"]["EntryRequestOutcome"];
export type PingMessage = components["schemas"]["PingMessage"];
export type MoveMessage = components["schemas"]["MoveMessage"];
export type SetStatusMessage = components["schemas"]["SetStatusMessage"];
export type ActiveMessage = components["schemas"]["ActiveMessage"];
export type SetLockMessage = components["schemas"]["SetLockMessage"];
export type RequestEntryMessage = components["schemas"]["RequestEntryMessage"];
export type WithdrawEntryRequestMessage =
  components["schemas"]["WithdrawEntryRequestMessage"];
export type AnswerEntryRequestMessage =
  components["schemas"]["AnswerEntryRequestMessage"];
export type SayMessage = components["schemas"]["SayMessage"];
export type MuteMessage = components["schemas"]["MuteMessage"];
export type RemoveFromSpaceMessage =
  components["schemas"]["RemoveFromSpaceMessage"];
export type GoToMessage = components["schemas"]["GoToMessage"];
export type StopWalkingMessage = components["schemas"]["StopWalkingMessage"];
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
export type BroadcastMessage = components["schemas"]["BroadcastMessage"];
export type NearbyMessage = components["schemas"]["NearbyMessage"];
export type LockChangedMessage = components["schemas"]["LockChangedMessage"];
export type LockableSpacesMessage =
  components["schemas"]["LockableSpacesMessage"];
export type SpacesMessage = components["schemas"]["SpacesMessage"];
export type EntryRequestedMessage =
  components["schemas"]["EntryRequestedMessage"];
export type EntryRequestEndedMessage =
  components["schemas"]["EntryRequestEndedMessage"];
export type SaidMessage = components["schemas"]["SaidMessage"];
export type StaffActionMessage = components["schemas"]["StaffActionMessage"];
export type WalkingMessage = components["schemas"]["WalkingMessage"];
export type WalkEndedMessage = components["schemas"]["WalkEndedMessage"];
export type ReplacedMessage = components["schemas"]["ReplacedMessage"];
export type MovedMessage = components["schemas"]["MovedMessage"];
export type MoveResultMessage = components["schemas"]["MoveResultMessage"];
export type ErrorMessage = components["schemas"]["ErrorMessage"];
export type ServerMessage = components["schemas"]["ServerMessage"];
export type CloseReason = components["schemas"]["CloseReason"];
export type CloseCode = components["schemas"]["CloseCode"];
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
