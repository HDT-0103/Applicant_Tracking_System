---
name: frontend-nextjs-workspace
description: Next.js 15 frontend architecture — split-screen ATS workspace, Google OAuth 2.0 login, Recharts radar metrics, Careers portal, and real-time WebSockets
version: 2.0.0
author: SmartATS Frontend Engineering Team
tech_stack:
  - Next.js 15 (App Router)
  - React 19
  - TypeScript 5+
  - Recharts
  - Lucide React Icons
  - Pure CSS Modules & Tokens
when_to_use:
  - "build or modify Next.js 15 App Router pages and components"
  - "implement split-screen candidate review workspace"
  - "integrate React OAuth login flow and AuthGuard route protection"
  - "render radar charts, timeline components, or upload zones"
  - "connect WebSocket real-time enrichment state to React UI"
---

# Frontend: Next.js 15 ATS Workspace Architecture

## 1. Overview & UI Design System

The SmartATS frontend is built with Next.js 15, React 19, and TypeScript. It features a high-density, split-screen workspace allowing recruiters to view candidate original PDF documents side-by-side with AI-driven skill matrices, radar charts, and career trajectory timelines.

### Design System & Theme Tokens (`src/frontend/lib/shared.ts`)
```typescript
export const D = {
  ink: "#111827",       // Primary text
  muted: "#6b7280",     // Secondary text
  dim: "#9ca3af",       // Subdued text
  line: "#e5e7eb",       // Border color
  canvas: "#ffffff",     // Card background
  surface: "#f9fafb",    // Page background
  blue: "#4f46e5",       // Accent primary (Indigo/Blue)
  mint: "#10b981",       // Success / Enriched green
  amber: "#f59e0b",      // Warning / Processing
  red: "#dc2626",        // Danger / Reject
  purple: "#6366f1",     // Education / Secondary accent
};
```

---

## 2. Directory Structure

```
src/frontend/
├── app/
│   ├── layout.tsx              # Root HTML & body wrapper
│   ├── providers.tsx           # AuthProvider + AuthGuard + WorkspaceProvider
│   ├── page.tsx                # Dashboard Home Page (Recent candidates)
│   ├── login/page.tsx          # Google OAuth Login view
│   ├── careers/page.tsx        # Public Job Portal & CV upload
│   └── candidate-profile/
│       ├── page.tsx            # Classic view
│       └── enriched/page.tsx   # Enriched split-screen workspace
├── components/
│   ├── AppHeader.tsx           # Global top navigation bar
│   ├── LeftSidebar.tsx         # App navigation sidebar
│   ├── AiAnalyticsWorkspace.tsx# Split-panel PDF + Radar chart view
│   ├── AuthGuard.tsx           # Route protection guard
│   └── FallbackDataWizard.tsx  # Manual data entry fallback UI
├── contexts/
│   ├── AuthContext.tsx         # User authentication, tokens, roles
│   └── WorkspaceContext.tsx    # Active candidate UUID, sync state, WebSocket listener
└── services/
    └── httpClient.ts           # Fetch wrapper with auto JWT token refresh
```

---

## 3. Core Component Hierarchy & State Flow

```
[Providers (providers.tsx)]
   │
   ├── [AuthGuard] (Redirects to /login if unauthenticated)
   │     │
   │     └── [WorkspaceProvider] (Holds active candidate UUID & state)
   │           │
   │           ├── [AppHeader] (Role badge, Search, User Avatar)
   │           │
   │           └── [Enriched Candidate Profile Page]
   │                 │
   │                 ├── [LeftPanel]: Original PDF Preview + Toolbar
   │                 │
   │                 └── [RightPanel]:
   │                       ├── [ProfileHeader]: Name, Score, Badges
   │                       ├── [EnrichedRadar]: Recharts 5-axis Radar Chart
   │                       ├── [CareerTimeline]: Verified LinkedIn trajectory
   │                       └── [DecisionBar]: Approve / Reject / Flag actions
```

---

## 4. HTTP Client & Automatic Token Refresh

`src/frontend/services/httpClient.ts` automatically attaches `Authorization: Bearer <access_token>` from `localStorage` (`smartats_access_token`). 

When a `401 Unauthorized` response is received:
1. Calls `/api/auth/refresh` sending `smartats_refresh_token`.
2. On success, stores new access token and retries original request transparently.
3. On failure, clears tokens and redirects to `/login`.

---

## 5. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when modifying Next.js pages, React components, CSS styles, Recharts radar charts, AuthContext, or httpClient logic.

### What Problems Does This Skill Solve?
Provides a high-performance, responsive UI for candidate evaluation, manages frontend state, handles OAuth sessions, and renders live WebSocket updates.

### Dependent Modules & Required Skills:
- `backend-api-standards` (Defines REST & WS endpoints)
- `security-governance` (Provides JWT token storage & role standards)
- `cv-analysis-semantic-ranking` (Provides radar score payload schemas)

### Which Files Should AI Modify vs Never Modify?
- **Modify**: Files in `src/frontend/app/`, `src/frontend/components/`, `src/frontend/contexts/`.
- **Never Modify**: Do NOT introduce Tailwind CSS unless explicitly requested by user; SmartATS strictly uses Vanilla CSS & Design Tokens (`D`).

### Common Anti-Patterns & Implementation Mistakes:
- **Direct Fetch Usage**: Never use raw `window.fetch` without auth headers; always use `api.get()` / `api.post()` from `httpClient.ts`.
- **Memory Leak in WebSockets**: Always close WebSocket connections inside `useEffect` cleanup return function.
