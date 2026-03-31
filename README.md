# Sagitine AI CX Agent - Phase 1 HUD

**Sagitine AI CX Agent** is an internal customer service triage system for a premium brand. This repository contains the Phase 1 HUD (Heads-Up Display) implementation, providing real-time notification and categorisation of AI-classified customer emails.

## Project Overview

The Phase 1 HUD delivers a floating notification interface that surfaces customer email triage data in real-time. Built with React 19 and Framer Motion, it provides smooth, animated access to category-level email summaries and metrics.

### Current Implementation (Phase 1)

- **Floating NotificationPill**: Bottom-right anchor showing total email count (12) and urgent indicator
- **NotificationHub (Level 1)**: Category summary view with counts and urgency levels
- **Three-Level Architecture**:
  - Level 1: Category overview (✅ implemented)
  - Level 2: Ticket queue drill-down (planned)
  - Level 3: Resolution console (planned)

### Integration Context

This HUD is the frontend component of a larger system:
- **Orchestration**: Make.com handles email ingestion from Outlook
- **AI Classification**: Claude 3.5 Sonnet categorises incoming emails
- **Database**: Neon (PostgreSQL) with Drizzle ORM
- **Frontend**: React + Vite dashboard (this repository)

## Getting Started

### Prerequisites

- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher

### Installation

```bash
cd sagitine-hud
npm install
```

### Development

Start the Vite development server:

```bash
npm run dev
```

The dashboard will be available at: **http://localhost:5173/**

### Build & Preview

```bash
npm run build          # Production build
npm run preview        # Preview production build
```

## Phase 1 HUD Features

### NotificationPill (Floating Anchor)

**Location**: Bottom-right corner of viewport

**Display**:
- Total email count (e.g., "12")
- Urgent indicator (red dot when urgent emails exist)
- Smooth hover animation (scale 1.05)

**Interaction**: Click to open NotificationHub

### NotificationHub (Level 1)

**Layout**: Modal overlay with backdrop

**Components**:
1. **HubHeader**: Title ("Notifications"), summary metrics, close button (X)
2. **CategoryList**: Scrollable list of email categories
3. **MetricsCard**: Summary statistics (total, urgent, review count)

**Category Display**:
- Damaged/Missing/Faulty: 2 emails
- Shipping/Delivery: 5 emails
- Product Usage: 5 emails
- (Additional categories per schema)

**Per-Category Metrics**:
- Email count
- Urgency level (low/medium/high)
- Average confidence score
- Average age in minutes
- New items indicator

### Interaction Design

**Opening**: Click NotificationPill → 400ms spring animation

**Closing Methods**:
- Click X button (top-right)
- Click backdrop (outside modal)
- Press Escape key

**Animation Physics**:
- Spring stiffness: 300
- Spring damping: 30
- Spring mass: 0.8
- Duration: ~400ms

## Architecture

### Feature-Based Structure

```
src/features/notification-hub/
├── components/
│   ├── NotificationPill.tsx       # Floating anchor button
│   ├── NotificationHub.tsx        # Main modal wrapper
│   ├── HubHeader.tsx              # Title, metrics, close button
│   ├── CategoryList.tsx           # Scrollable category items
│   ├── CategoryItem.tsx           # Individual category display
│   ├── MetricsCard.tsx            # Summary statistics
│   ├── TicketQueue.tsx            # Level 2 (planned)
│   └── ResolutionConsole.tsx      # Level 3 (planned)
├── data/
│   └── mock-data.ts               # Mock data for development
├── types/
│   └── index.ts                   # TypeScript definitions
└── utils/
    └── formatters.ts              # Data formatting utilities
```

### Component Hierarchy

```
App.tsx (state owner)
├── NotificationPill (trigger)
└── NotificationPortal
    └── NotificationHub (modal)
        ├── HubHeader
        ├── CategoryList
        │   └── CategoryItem (mapped)
        └── MetricsCard
```

### State Management

- **No Context API**: State owned by `App.tsx`, passed via props
- **Simple State**: `isOpen` boolean controls hub visibility
- **Portals**: Hub renders via React Portal for z-index isolation

### Data Flow

1. `mock-data.ts` provides `mockHubData` (development)
2. `App.tsx` passes data to `NotificationHub`
3. `NotificationHub` distributes to child components
4. Future: Replace mock data with API calls to `/api/metrics`

## Tech Stack

### Core Framework
- **React 19**: Latest React with concurrent features
- **TypeScript 5.9**: Type safety and developer experience
- **Vite 8**: Lightning-fast bundler and dev server

### UI & Animation
- **Framer Motion 12**: Production-grade animation library
- **Lucide React**: Consistent icon system (24x24, stroke-width 2)
- **Tailwind CSS 4**: Utility-first styling with JIT compilation

### Design System
- **Sagitine Design Tokens**: Custom colour palette and radius system
- **CSS Custom Properties**: Defined in `src/index.css`
- **Tailwind Mapping**: Extended in `tailwind.config.js`

### Database (Future Integration)
- **Neon**: Serverless PostgreSQL
- **Drizzle ORM**: Type-safe database queries
- **@neondatabase/serverless**: Edge-compatible database client

## Design System

### Border Radius

All containers use Sagitine's signature rounded corners:
- Pill: `rounded-[3rem]` (48px)
- Hub: `rounded-[3rem]` (48px)
- Cards: `rounded-[3rem]` (48px)

**Rationale**: No sharp corners—soft, approachable aesthetic

### Colour Palette

**Surfaces** (zinc grays):
- Background: `zinc-50` (#fafafa)
- Card background: `zinc-100` (#f4f4f5)
- Border: `zinc-200` (#e4e4e7)
- Text primary: `zinc-900` (#18181b)
- Text secondary: `zinc-500` (#71717a)

**Accents**:
- Primary: Black (`#000000`)
- Tertiary: Burnt orange/rust (Sagitine brand)
- Urgent indicator: Red (`#ef4444`)

**Typography**:
- Tight tracking on headings (`tracking-tight`)
- No generic font stacks (custom web fonts planned)

### Animation System

**Spring Physics** (Framer Motion):
```javascript
const springConfig = {
  stiffness: 300,
  damping: 30,
  mass: 0.8
};
```

**Entrance Animations**:
- Hub fade-in: `initial: { opacity: 0 }`, `animate: { opacity: 1 }`
- Scale effect: `initial: { scale: 0.95 }`, `animate: { scale: 1 }`

**Duration**: ~400ms for all transitions

**Accessibility**:
- `prefers-reduced-motion` media query respected
- No strobe effects or flashing content
- Focus indicators on interactive elements

## Development Notes

### Mock Data

**Location**: `src/features/notification-hub/data/mock-data.ts`

**Structure**:
```typescript
export const mockHubData: HubData = {
  categories: [
    {
      id: "damaged_missing_faulty",
      label: "Damaged / Missing / Faulty",
      shortLabel: "Damaged/Missing/Faulty",
      count: 2,
      urgency: "high",
      hasNew: true,
      avgConfidence: 0.92,
      avgAgeMinutes: 15
    },
    // ... additional categories
  ],
  metrics: {
    totalOpen: 12,
    urgentCount: 3,
    reviewCount: 5,
    avgResponseTimeMinutes: 45,
    avgConfidence: 0.88,
    criticality: "ELEVATED"
  },
  queueByCategory: {},
  consoleByTicketId: {},
  lastUpdatedAt: "2026-03-31T12:00:00Z"
};
```

### Type Definitions

**Location**: `src/features/notification-hub/types/index.ts`

**Key Types**:
- `HubView`: Union type for navigation levels (`LEVEL_1_HUB`, `LEVEL_2_QUEUE`, `LEVEL_3_CONSOLE`)
- `CategorySummaryItem`: Category-level email summary
- `QueueTicketItem`: Individual ticket in queue
- `ResolutionConsoleData`: Full ticket details for resolution
- `HubMetrics`: Aggregate statistics
- `HubData`: Top-level data container

### Design Tokens

**CSS Custom Properties** (`src/index.css`):
```css
:root {
  --sagitine-primary: #000000;
  --sagitine-tertiary: /* burnt orange/rust */;
  --sagitine-radius-sm: rounded-[2rem];
  --sagitine-radius-md: rounded-[3rem];
  --sagitine-radius-lg: rounded-[4rem];
  /* ... additional tokens */
}
```

**Tailwind Mapping** (`tailwind.config.js`):
```javascript
export default {
  theme: {
    extend: {
      colors: {
        sagitine: {
          primary: 'var(--sagitine-primary)',
          tertiary: 'var(--sagitine-tertiary)',
        }
      },
      borderRadius: {
        '3rem': '3rem',
        '4rem': '4rem',
      }
    }
  }
}
```

## Future Enhancements

### Level 2: Ticket Queue (Planned)

**Purpose**: Drill-down into individual categories to view email queue

**Features**:
- List view of all emails in selected category
- Sort by urgency, confidence, age
- Filter by status (new, triaged, drafted, review required)
- Click email to open Level 3 console

### Level 3: Resolution Console (Planned)

**Purpose**: Full email context and response drafting

**Features**:
- Original email message display
- AI-generated summary and classification
- Recommended response draft
- Edit and approve response
- Send to customer via Outlook integration

### Real API Integration (Planned)

**Replace mock data with live database**:
1. Fetch from `/api/metrics` endpoint
2. Implement polling with `useSagitineSync` hook
3. Optimistic UI updates for instant feedback
4. Error handling and retry logic

**Database Schema** (existing):
- `inbound_emails`: Raw email data from Outlook
- `triage_results`: AI classification, urgency score, draft response
- `gold_responses`: Approved response templates

## Australian English Convention

**All user-facing text uses Australian English spelling**:
- `colour` (not `color`)
- `optimise` (not `optimize`)
- `organise` (not `organize`)
- `emphasise` (not `emphasize`)

## Deployment Checklist

Before deploying to production:

1. **Environment Variables**: Ensure all `.env` vars are configured
2. **Build Verification**: Run `npm run build` and check for errors
3. **Bundle Size**: Use Vite's visualiser to identify bloated dependencies
4. **Performance**: Test on 3G connections and low-end devices
5. **Accessibility**: Verify keyboard navigation and screen reader support
6. **Browser Support**: Test on Chrome, Firefox, Safari, Edge (last 2 versions)
7. **Analytics**: Integrate tracking for user interactions (optional)

## Architecture References

- [CLAUDE.md](../CLAUDE.md) — Complete project guidance and ruleset
- [SAGITINE_ARCHITECTURE.md](../SAGITINE_ARCHITECTURE.md) — System overview
- [GEMINI.md](../GEMINI.md) — Complete design system
- [GEMINI_DEPLOY.md](../GEMINI_DEPLOY.md) — Production hardening checklist
- [🚀 The Gemini Project Runbook.md](../🚀 The Gemini Project Runbook.md) — Build sequence

## License

Internal tool for Sagitine Customer Service. All rights reserved.
