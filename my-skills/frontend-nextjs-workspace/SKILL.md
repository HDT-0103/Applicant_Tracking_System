---
name: frontend-nextjs-workspace
description: Next.js 15 frontend with split-screen ATS workspace, Google OAuth login, analytics dashboard, and careers portal
version: 1.0.0
tech_stack:
  - Next.js 15
  - React 19
  - TypeScript
  - Recharts
  - Lucide React
  - Google OAuth (@react-oauth/google)
when_to_use:
  - "set up the frontend ATS workspace"
  - "implement split-screen CV viewing and AI analysis"
  - "configure Google OAuth login flow"
  - "build careers portal with job listings and CV upload"
  - "render radar chart and skill matrix UI"
  - "handle WebSocket real-time data display"
---

# Frontend: Next.js 15 ATS Workspace

## Overview

The SmartATS frontend is a Next.js 15 application with React 19, TypeScript, and pure CSS styling. It provides a split-screen workspace for reviewing candidates: left panel shows the original PDF, right panel shows AI-generated analysis with skill radar charts and career timeline.

## Page Structure

```
app/
├── layout.tsx                  # Root layout with Providers wrapper
├── page.tsx                    # Dashboard home page
├── providers.tsx               # GoogleOAuthProvider + AuthProvider + AuthGuard + WorkspaceProvider
├── globals.css                 # All styles (no Tailwind — pure CSS modules)
├── login/page.tsx              # Google OAuth login page
├── careers/page.tsx            # Public careers portal with job listings + CV upload
├── candidate-profile/
│   └── (split screen)          # Split-panel: PDF + AI analytics
└── ai-agent-prompt/
    └── page.tsx                # AI agent prompt interface
```

## Component Tree

```
Providers
└── AuthGuard
    └── WorkspaceProvider
        ├── Login (when unauthenticated)
        └── AppShell (when authenticated)
            ├── AppHeader (top bar: branding, user avatar, logout)
            └── Split Screen
                ├── LeftSidebar (navigation)
                ├── LeftPanel
                │   ├── PdfToolbar (page nav, zoom, download)
                │   └── PDF iframe
                └── RightPanel
                    ├── ProfileHeader (name, title, affinity score)
                    ├── MetaTags (location, experience, education)
                    ├── AffinitySection (score + breakdown bars)
                    ├── SkillSection (radar chart + skill cards)
                    ├── CareerSection (timeline)
                    └── DecisionBar (approve/reject/flag/share)
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppHeader` | `components/AppHeader.tsx` | Top bar with branding, user info, logout |
| `LeftSidebar` | `components/LeftSidebar.tsx` | Navigation sidebar with links |
| `IdleUploadZone` | `components/IdleUploadZone.tsx` | Drag-and-drop PDF upload when no candidate selected |
| `PdfToolbar` | `components/PdfToolbar.tsx` | PDF page navigation controls |
| `ProfileHeader` | `components/ProfileHeader.tsx` | Candidate name, title, badges |
| `AiAnalyticsWorkspace` | `components/AiAnalyticsWorkspace.tsx` | Full analytics view with radar chart, timeline, decision bar |
| `FallbackDataWizard` | `components/FallbackDataWizard.tsx` | Manual data entry for failed parsing |
| `Login` | `components/Login.tsx` | Google OAuth login card |
| `AuthGuard` | `components/AuthGuard.tsx` | Route protection by auth state |
| `SkeletonLoadingSpinner` | `components/SkeletonLoadingSpinner.tsx` | Loading skeleton |
| `RunSyncButton` | `components/RunSyncButton.tsx` | Trigger enrichment sync |

## Contexts

| Context | File | State Management |
|---------|------|-----------------|
| `AuthContext` | `contexts/AuthContext.tsx` | User, tokens, login/logout, loading state |
| `WorkspaceContext` | `contexts/WorkspaceContext.tsx` | Selected candidate UUID, enrichment data, WebSocket handler |

## Services

| Service | File | Purpose |
|---------|------|---------|
| `httpClient.ts` | `services/httpClient.ts` | Axios-like fetch wrapper with auth headers, token refresh |
| `mockAnalyticsService.ts` | `services/mockAnalyticsService.ts` | Mock data when backend unavailable |

## Design System

All styles are in `app/globals.css` using CSS custom properties and class-based selectors. The design uses a clean, minimal palette:

```
Colors: ink (#111827), muted (#6b7280), line (#e5e7eb),
        canvas (#fff), surface (#f9fafb),
        blue (#4f46e5), purple (#6366f1), mint (#10b981),
        amber (#f59e0b), red (#dc2626), dim (#9ca3af)
```

Shared constants are defined in `lib/shared.tsx` as the `D` object.

## Careers Portal

The public careers page (`app/careers/page.tsx`) allows external candidates to:
1. Browse open positions (loaded from `/job_postings.json`)
2. Select a job and fill in personal details
3. Upload their CV (PDF only)
4. Submit → triggers ingestion → redirects to enriched profile view

## WebSocket Integration

```typescript
// In WorkspaceContext or component
useEffect(() => {
  if (!candidateUuid) return;
  const ws = new WebSocket(
    `${process.env.NEXT_PUBLIC_WS_URL}/api/enrichment/ws/v1/analysis/${candidateUuid}`
  );
  ws.onmessage = (event) => {
    const { status, data } = JSON.parse(event.data);
    if (status === 'ENRICHED') {
      setEnrichedProfile(data);
      setEnrichmentStatus('ENRICHED');
    }
  };
  return () => ws.close();
}, [candidateUuid]);
```
