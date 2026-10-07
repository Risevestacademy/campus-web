# Frontend Architectural Plan

# Overview

The Campus frontend will use a feature-based architecture that organizes code around product domains rather than technical folders.

The goal is to create a frontend that is:

- Scalable across multiple teams.
- Easy to test and maintain.
- Strictly typed.
- Modular and reusable.
- Suitable for realtime multiplayer interactions.
- Enforced by automated code-quality tooling.

# Technology Stack

| Stack                                     | Responsibility                               |
| :---------------------------------------- | :------------------------------------------- |
| Next.js                                   | Application framework, routine and rendering |
| React                                     | UI library                                   |
| TypeScript                                | Type Safety                                  |
| TailwindCSS                               | Styling and Design system                    |
| Kaplay.js                                 | 2D campus/game runtime                       |
| Motion                                    | UI animations and transitions                |
| Zustand                                   | Shared client-side state                     |
| TanStack Query                            | Server-state fetching, mutations and caching |
| ESLint                                    | Code-quality enforcement                     |
| Prettier                                  | Code formatting                              |
| Husky                                     | Git hooks                                    |
| lint-staged                               | Validate stage files                         |
| Commitlint                                | Commit message Standards                     |
| Vitest, React Testing Library, Playwright | Testing code                                 |

# Architectural Model

root/  
├── app/  
├── core/  
├── features/  
├── shared/  
└── assets/

## app/

Responsible for:

- Next.js routes.
- Layouts.
- Providers.
- Error boundaries.
- Application composition.

## core/

Contains infrastructure that supports multiple features.  
core/  
├── api/  
├── media/  
├── game/  
├── components/  
└── realtime/

## features/

Each feature owns its components, hooks, services, types and state  
features/  
├── auth/  
├── component/  
├── hooks/  
├── services/  
├── schemas/  
├── types/  
├── store/  
└── index.ts

## shared/

shared/  
├──components/  
├── ui/  
├── elements/  
└── layout/  
├── constants/  
├── faqs.ts  
├── variants.ts  
└── navlinks.ts  
├── lib/  
├── cn.ts  
└── db.ts  
└── types/

## assets/

assets/  
├── images/  
├── svgs/  
└── fonts/

#

# Layer Responsibilities

## Components

Responsible for:

- Rendering UI.
- Handling user interaction.
- Calling feature hooks.
- Small local UI state.

Components should not directly:

- Fetch APIs.
- Open WebSocket connections.
- Handle complex business logic.

## Hooks

Hooks connect UI to application behaviour.

Examples:

useClassroom()  
useJoinClassroom()  
useNearbyStudents()  
useCampusPresence()  
useMediaPermissions()

Typical flow:

Component  
↓  
Hook  
↓  
Query / Store  
↓  
Service

## Services

Services communicate with external systems.

Example:

features/classroom/services/classroom.service.ts

Responsibilities:

- API calls.
- Request/response transformation.
- Domain-specific external communication.

Services should remain independent from React.

| export const AuthService \= { signUp: async (values: SignUpValues) \=\> { const response \= await api.post("/auth/signup", values); return response.data; }, signIn: async (values: SignInValues) \=\> {}};AuthService.signUp({ name: "John Doe", email: "john.doe@example.com", password: "password", confirmPassword: "password",}); |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## Store

Feature stores contain a shared client state.

Example:

features/communication/store/

Use Zustand primarily for:

- Ephemeral realtime state.
- Shared UI state.
- Current interactions.
- Nearby users.
- Communication controls.

#

# State Ownership

Different systems should own different types of state.

| State                   | Owner               |
| :---------------------- | :------------------ |
| API/server data         | TanStack Query      |
| Local component state   | useState/useReducer |
| Shared client side      | Zustand             |
| Game-frame state        | Kaplay              |
| Navigation/filter state | URL/Next.js Router  |

Examples:

### TanStack Query

- Student profile.
- Classroom data.
- Notice Board posts.
- Resources.
- Campus configuration.

### Zustand

- Selected participant.
- Nearby user IDs.
- Open panels.
- Media controls.
- Campus session status.

### Kaplay

- Player position.
- Collision.
- Camera.
- Map objects.
- Sprite movement.

A major rule is:

> Do not duplicate the Kaplay frame state inside React or Zustand.

# React and Kaplay Boundary

React and Kaplay should have separate responsibilities.

### React

Controls:

- Panels.
- Dialogs.
- Chat UI.
- Video UI.
- Classroom interface.
- Resources.
- Settings.
- Notifications.

### Kaplay

Controls:

- Character movement.
- Collision.
- Camera.
- Map rendering.
- Sprites.
- Game objects.
- Frame-by-frame updates.

React should never control the game loop.

Bad:

game.onUpdate(() \=\> {  
setPlayerPosition(player.pos);  
});

This can trigger React renders every frame.

Instead:

Keyboard  
↓  
Kaplay movement  
↓  
Player position  
↓  
Throttled realtime publisher

# Campus Session

A dedicated campus-session feature should coordinate the overall campus runtime.

features/campus-session/

It coordinates:

Campus Session  
│  
├── Campus World  
├── Presence  
├── Proximity  
├── Communication  
├── Avatar  
└── Classroom

Recommended lifecycle:

Idle  
↓  
Loading Campus  
↓  
Requesting Media Permission  
↓  
Connecting Realtime  
↓  
Initializing Game  
↓  
Spawning Player  
↓  
Ready  
↓  
Disconnecting

Represent this lifecycle with a single status instead of many unrelated boolean states.

#

# Realtime Architecture

Realtime communication belongs in:

core/realtime/

Example:

realtime-client.ts  
realtime-events.ts  
realtime.types.ts

Features should not directly depend on a WebSocket provider.

Instead:

Feature  
↓  
Realtime Client  
↓  
WebSocket Provider

Possible events:

campus:user:joined  
campus:user:left

presence:update

proximity:entered  
proximity:left

desk:occupied  
desk:vacated

classroom:joined  
classroom:left

chat:message

All realtime payloads should have TypeScript contracts.

#

# Multiplayer Movement

Local movement may run at approximately 60 FPS, but network updates should not.

Recommended flow:

Kaplay movement  
↓  
Local player coordinates  
↓  
Throttle  
↓  
10-20 updates/sec  
↓  
Realtime server

Remote players should use interpolation:

Server position  
↓  
Target position  
↓  
Interpolation  
↓  
Smooth remote movement

This reduces network traffic while maintaining smooth animation.

#

# Presence and Proximity

## Presence

Responsible for:

- Connected students.
- Join/leave events.
- Remote user information.
- Online/offline status.
- Position snapshots.

Suggested storage:

Record\<UserId, ParticipantPresence\>

instead of repeatedly searching large arrays.

## Proximity

Responsible for determining which users or objects are within interaction range.

Player positions  
↓  
Proximity engine  
↓  
Nearby participants  
↓  
Communication

Proximity should not directly manage calls.

It should expose information such as:

type NearbyParticipant \= {  
userId: string;  
distance: number;  
};

Other features can respond to proximity events.

# Audio and Video

Communication belongs in:

features/communication/

Infrastructure belongs in:

core/media/

Architecture:

Communication Feature  
↓  
Media Adapter  
↓  
WebRTC / Media Provider

The application should initialize the camera and microphone when the student enters campus after permission is granted.

Enter Campus  
↓  
Request Camera/Microphone  
↓  
Initialize Media  
↓  
Connect Realtime  
↓  
Spawn Player

Media streams should not constantly restart when users enter or leave proximity.

Proximity should primarily determine:

- Who is audible?
- Who is visible?
- Which streams should be subscribed to.

# Feature Domains

Initial frontend domains should include:

| Domain          | Purpose                                                 |
| :-------------- | :------------------------------------------------------ |
| Authentication  | Login, logout and session handling                      |
| Campus Session  | Coordinates initialization and lifecycle                |
| Campus World    | Kaplay maps, scenes, collisions and interactive objects |
| Avatar          | Player appearance and customization                     |
| Presence        | Connected users and realtime presence                   |
| Proximity       | Spatial interaction logic                               |
| Commuication    | Audio, video and chat                                   |
| Classroom       | Classroom data and sessions                             |
| Desk            | Seat assignment, occupancy and student interactions     |
| Notice Wall     | Campus Announcements                                    |
| Resource Centre | Learning resources and files                            |
| Stage           | Events and campus-wide sessions                         |
| Games           | Social/game activities                                  |
| Profile         | Student profile and portfolio                           |

#

#

# API Architecture

Shared HTTP transport belongs in `core/api/client/`. It contains the generated
Campus API contract, one client factory, direct server composition, and the
policy-enforcing browser proxy.

Feature endpoints remain within their features.

Example:

features/classroom/services/classroom.service.ts

Application flows:

Server Component → Feature gateway → Direct server client → Campus API

Client island → Feature gateway → Browser client → Next proxy → Campus API

Realtime client → Authorized WebSocket/WebRTC provider

Do not add a Next-owned endpoint when the operation belongs to Campus API.
Dedicated Next Route Handlers require a concrete frontend-owned HTTP contract.

# Import Rules

Allowed:

app → features  
app → core  
app → shared

features → core  
features → shared

core → shared

Not allowed:

shared → features  
core → features  
features → app  
shared → app

Feature internals should also remain private.

Preferred:

import { ClassroomPanel } from "@/features/classroom";

Avoid:

import { ClassroomPanel }  
from "@/features/classroom/components/classroom-panel";

Each feature exposes its public API through index.ts

# Shared Components

Only generic components belong in:

shared/components/ui/

Examples:

button.tsx  
dialog.tsx  
input.tsx  
select.tsx  
tabs.tsx  
tooltip.tsx  
toast.tsx  
spinner.tsx  
avatar.tsx

Feature-specific components remain in their domains.

Examples:

classroom-card.tsx → classroom  
student-desk.tsx → desk  
notice-card.tsx → notice-board  
resource-viewer.tsx → resource-centre

**Rule**: If a component understands a Campus business concept, it belongs to a feature.

# Code Quality

ESLint should enforce:

- TypeScript best practices.
- React Hooks rules.
- Accessibility.
- Unused imports.
- Import ordering.
- Feature boundaries.
- Restricted deep imports.
- Limited console usage.
- No floating promises.
- Discouraged any.

Prettier handles formatting.

# Git Quality Workflow

Use Husky for Git hooks.

### Pre-commit

git commit  
↓  
Husky  
↓  
lint-staged  
↓  
ESLint \+ Prettier

### Commit message

Husky  
↓  
Commitlint

Use Conventional Commits.

Examples:

feat(classroom): add session joining

fix(media): restore microphone after reconnect

refactor(presence): normalize participant state

test(desk): add occupancy tests

chore(tooling): configure husky

Recommended types:

feat  
fix  
refactor  
perf  
test  
docs  
style  
build  
ci  
chore  
revert

# Pull Request Quality Gates

Every PR should pass:

ESLint  
↓  
Formatting  
↓  
TypeScript  
↓  
Unit Tests  
↓  
Production Build  
↓  
E2E (where applicable)

Recommended scripts:

{  
"scripts": {  
"lint": "...",  
"lint:fix": "...",  
"format": "...",  
"format:check": "...",  
"typecheck": "tsc \--noEmit",  
"test": "...",  
"test:e2e": "...",  
"build": "next build"  
}  
}

The main branch should be protected from direct pushes.

#

# Testing Strategy (Pending)

### Unit Tests

Test:

- Proximity calculations.
- Position interpolation.
- Stores.
- Services.
- Utility functions.
- Permission logic.
- Business rules.

### Component Tests

Test user behaviour using React Testing Library.

### API Integration Tests

Use MSW to mock backend responses.

### End-to-End Tests

Playwright should cover core flows:

Login  
→ Enter Campus  
→ Spawn Player

Move Player  
→ Enter Proximity  
→ Start Communication

Approach Desk  
→ Sit  
→ Join Classroom

Open Notice Board  
→ Read Announcement

Enter Resource Centre  
→ Open Resource

# Performance Principles

Performance must be treated as an architectural requirement.

### Game

- Avoid React updates every frame.
- Keep game state inside Kaplay.
- Throttle network position updates.
- Interpolate remote movement.
- Dynamically load Kaplay only on Campus routes.

### Media

Do not subscribe to every student's video.

For example:

100 students online

should not mean:

100 active video streams

Only participants within the relevant proximity or room should have active media subscriptions.

### Cleanup

When leaving Campus:

- Destroy game listeners.
- Disconnect realtime subscriptions.
- Remove timers.
- Dispose unused game resources.
- Release media resources where required.

# Core Architectural Rules

The frontend team should follow these rules consistently:

1. Organize business logic by **feature domain**.
2. Components should not make direct API calls.
3. TanStack Query owns the server state.
4. Zustand owns shared client state.
5. Kaplay owns high-frequency game state.
6. React must not control the game loop.
7. Realtime communication must go through a centralized realtime client.
8. Media providers must be accessed through an adapter.
9. Features expose public APIs through `index.ts`.
10. Cross-feature deep imports are prohibited.
11. Shared code must remain domain-independent.
12. All PRs must pass lint, format, typecheck, tests and build checks.
13. Husky and Commitlint enforce repository standards locally.
14. Realtime and API payloads must have typed contracts.
15. Performance, cleanup and reconnection must be designed from the beginning.

The final architecture can be summarized as:

Next.js App  
↓  
Feature Domains  
↓  
Hooks / Query / Stores / Services  
↓  
Core Infrastructure  
↓  
Backend / Realtime / Media / Kaplay

This architecture allows Campus by Rise to remain modular as the product grows while giving frontend engineers clear ownership boundaries for features, state, realtime behaviour and infrastructure.
