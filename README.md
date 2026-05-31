# Weekly Ledger — Personal Finance Tracker

A self-hosted personal finance app that connects to your bank via [Plaid](https://plaid.com), automatically categorises transactions, and gives you a clear weekly view of your spending. All data stays on your own machine.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Feature Guide](#feature-guide)
8. [Transaction Processing Pipeline](#transaction-processing-pipeline)
9. [Goal Projection Algorithm](#goal-projection-algorithm)
10. [Configuration](#configuration)
11. [Installation](#installation)
12. [How-To Guides](#how-to-guides)
13. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Clone
git clone https://github.com/liamsoule-personal/personal-finance.git
cd personal-finance

# macOS / Linux
chmod +x launcher.sh && ./launcher.sh

# Windows — right-click launcher.ps1 → "Run with PowerShell"
```

The launcher installs all dependencies, runs migrations, starts the server, and opens `http://localhost:8000` in your browser. On first launch a setup wizard walks you through connecting Plaid.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│   ┌───────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│   │ Dashboard │  │ All Transactions │  │     Goals       │  │
│   └───────────┘  └──────────────────┘  └─────────────────┘  │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │           React 18 + Vite SPA  (port 5173 dev)       │   │
│   └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │  HTTP/JSON  (/api/*)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│           FastAPI  ·  uvicorn  ·  port 8000                  │
│                                                              │
│  src/api/main.py  —  all route handlers                      │
│                                                              │
│  ┌─────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐  │
│  │  accounts   │ │ ingestion  │ │ analytics  │ │  goals  │  │
│  │  service    │ │  service   │ │  service   │ │ service │  │
│  └──────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────┬────┘  │
│         │              │              │              │       │
│  ┌──────┴──────────────┴──────────────┴──────────────┴────┐  │
│  │              SQLAlchemy ORM  ·  src/storage/           │  │
│  └────────────────────────────┬─────────────────────────-─┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │
               ┌────────────────┴─────────────────┐
               │                                  │
      ┌────────▼──────────┐            ┌───────────▼──────────┐
      │  data/ledger.db   │            │     Plaid API         │
      │  SQLite database  │            │  (plaid.com)          │
      └───────────────────┘            └──────────────────────┘
```

### Request Lifecycle

```
Browser  ──►  GET /api/analytics/week
                      │
              main.py: analytics_week()
                      │
              analytics_svc.week_summary(db, week_start)
                      │
              SQLAlchemy query → SQLite → Python objects
                      │
              JSON response  ──►  Browser renders charts
```

### Plaid Sync Lifecycle

```
User clicks "Sync"
        │
POST /api/sync  ──►  ingestion_svc.sync_all_items(db)
                              │
                   for each PlaidItem:
                              │
                   Plaid transactions_sync API  (paginated cursor)
                              │
                   ┌──────────┴──────────┐
                   │                     │
              New txn?              Existing txn?
                   │                     │
          classify_auto_exclude()    update mutable fields
          compute_spend_amount()     (preserve user overrides)
          apply_rules_to()
          INSERT transactions
                   │
          run_cc_payment_pair_detector()
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite | SPA served by FastAPI |
| **Backend** | FastAPI, Uvicorn | REST API, serves built SPA |
| **ORM** | SQLAlchemy 2 | Database abstraction |
| **Migrations** | Alembic | Schema versioning |
| **Database** | SQLite | Local file-based storage |
| **Bank data** | Plaid API (`plaid-python`) | Transaction ingestion |
| **Config** | pydantic-settings | `.env` → typed settings |
| **Runtime** | uv | Fast Python venv + package install |
| **Frontend build** | Vite + npm | Bundles React into `src/web/static/` |

---

## Directory Structure

```
personal-finance/
│
├── launcher.sh          # macOS/Linux: installs deps, migrates, starts server
├── launcher.ps1         # Windows equivalent
├── stop.sh              # macOS/Linux: stops the server
├── stop.ps1             # Windows equivalent
│
├── .env                 # Local credentials (git-ignored)
├── .env.example         # Template — copied to .env on first run
├── requirements.txt     # Python dependencies
│
├── alembic.ini          # Alembic config
├── alembic/
│   ├── env.py           # Reads DATABASE_URL from env
│   └── versions/
│       ├── 001_initial_schema.py   # plaid_items, accounts, transactions, rules, sync_log
│       └── 002_goals.py            # goals table
│
├── src/
│   ├── config.py                   # Settings (pydantic-settings, reads .env)
│   │
│   ├── storage/
│   │   ├── database.py             # SQLAlchemy engine + session factory
│   │   └── models.py               # ORM models: PlaidItem, Account, Transaction,
│   │                               #   CategorizationRule, SyncLog, Goal
│   │
│   ├── api/
│   │   ├── main.py                 # FastAPI app, all route handlers, lifespan
│   │   └── schemas.py              # Pydantic request/response models
│   │
│   ├── accounts/
│   │   └── service.py              # Plaid link token, token exchange, account list
│   │
│   ├── ingestion/
│   │   └── service.py              # Plaid transactions_sync, upsert logic
│   │
│   ├── transactions/
│   │   └── service.py              # CRUD, auto-exclusion, spend normalisation,
│   │                               #   CC payment pair detection
│   │
│   ├── analytics/
│   │   └── service.py              # week_summary, category_breakdown, daily_totals
│   │
│   ├── categorization/
│   │   └── service.py              # Rule CRUD, pattern matching, apply_rules_to
│   │
│   └── goals/
│       └── service.py              # Goal CRUD, day-of-week weighted projection
│
├── web/                            # React frontend source
│   ├── package.json
│   ├── vite.config.js              # proxies /api → :8000 in dev mode
│   └── src/
│       ├── App.jsx                 # Router, setup/auth gate
│       ├── main.jsx
│       ├── index.css
│       │
│       ├── pages/
│       │   ├── Setup.jsx           # First-run: Plaid credentials + desktop shortcut
│       │   ├── Onboarding.jsx      # Connect bank via Plaid Link
│       │   ├── Dashboard.jsx       # Weekly spending overview
│       │   ├── AllTransactions.jsx # Full transaction history
│       │   └── Goals.jsx           # Spending goal management
│       │
│       ├── components/
│       │   ├── Sidebar.jsx         # Navigation, week calendar, sync button
│       │   ├── TransactionTable.jsx# Sortable/searchable table with status column
│       │   ├── CategoryDonut.jsx   # Spending-by-category donut chart
│       │   ├── DailyBar.jsx        # Daily spend bar chart
│       │   ├── KpiCard.jsx         # Summary metric card
│       │   ├── ReclassifyModal.jsx # Category override modal
│       │   └── ContextMenu.jsx     # Right-click menu on transactions
│       │
│       ├── hooks/
│       │   ├── useWeek.js          # Week navigation state (prev/next/today)
│       │   └── useTransactions.js  # Fetch + optimistic update for transactions
│       │
│       └── lib/
│           ├── api.js              # Typed fetch wrapper (get/post/patch/delete)
│           └── categories.js       # Primary & detailed category constants + helpers
│
└── data/
    └── ledger.db                   # SQLite database (git-ignored)
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌───────────────────────┐
│  plaid_items │ 1───< │   accounts   │ 1───< │     transactions      │
│──────────────│       │──────────────│       │───────────────────────│
│ id (PK)      │       │ id (PK)      │       │ id (PK)               │
│ plaid_item_id│       │ plaid_item_id│       │ plaid_transaction_id  │
│ access_token │       │ plaid_acct_id│       │ account_id (FK)       │
│ institution  │       │ name         │       │ date                  │
│ cursor       │       │ type         │       │ amount                │
│ last_synced  │       │ subtype      │       │ spend_amount          │
│ status       │       │ mask         │       │ description           │
└──────────────┘       │ is_active    │       │ merchant_name         │
        │              └──────────────┘       │ pending               │
        │                                     │ plaid_primary_category│
        │ 1───<  sync_log                     │ plaid_detailed_categ. │
                                              │ user_primary_category │
                                              │ user_detailed_categ.  │
                                              │ user_excluded         │
                                              │ user_included         │
                                              │ auto_excluded_reason  │
                                              │ paired_txn_id (self)  │
                                              └───────────────────────┘

┌───────────────────────────┐     ┌───────────────────────┐
│    categorization_rules   │     │         goals         │
│───────────────────────────│     │───────────────────────│
│ id (PK)                   │     │ id (PK)               │
│ pattern                   │     │ name                  │
│ pattern_type              │     │ type  (weekly|categ.) │
│ target_detailed_category  │     │ category              │
│ match_count               │     │ weekly_limit          │
│ last_applied_at           │     │ created_at            │
└───────────────────────────┘     └───────────────────────┘
```

### Table Reference

#### `plaid_items`
One row per connected institution. Stores the Plaid `access_token` and pagination `cursor` for the transactions sync API.

| Column | Type | Notes |
|---|---|---|
| `status` | string | `active` \| `requires_relink` \| `error` |
| `cursor` | string | Plaid sync cursor; NULL on first sync |
| `last_synced_at` | datetime | Updated after each successful sync |

#### `accounts`
One row per bank account within an item. Savings accounts are excluded at link time.

| Column | Type | Notes |
|---|---|---|
| `type` | string | `depository` \| `credit` |
| `subtype` | string | `checking` \| `credit card` \| etc. |
| `is_active` | bool | User can toggle off to hide from analytics |

#### `transactions`
Core table. Two category columns each: Plaid-supplied (immutable) and user-override (editable).

| Column | Type | Notes |
|---|---|---|
| `amount` | decimal | Raw Plaid amount |
| `spend_amount` | decimal | Normalised: positive = spending |
| `auto_excluded_reason` | string | `cc_payment` \| `transfer_zelle` \| `transfer_internal` \| `income` \| `refund` \| NULL |
| `user_excluded` | bool | Manual exclude by user |
| `user_included` | bool | Override auto-exclusion |
| `paired_txn_id` | FK(self) | Links matching CC payment debit + credit |

**Inclusion logic** (used everywhere):
```
is_included = NOT user_excluded
              AND (user_included OR auto_excluded_reason IS NULL)
```

#### `categorization_rules`
Ordered rules applied to each new transaction on ingest. First match wins.

| `pattern_type` | Behaviour |
|---|---|
| `exact` | `field == pattern` |
| `contains` | `pattern.lower() in field.lower()` |
| `starts_with` | `field.lower().startswith(pattern.lower())` |

Matched against `merchant_name` first, then `description`.

#### `goals`

| Column | Type | Notes |
|---|---|---|
| `type` | string | `weekly` (all spend) \| `category` (one category) |
| `category` | string | Primary category key, e.g. `FOOD_AND_DRINK`; NULL for weekly goals |
| `weekly_limit` | decimal | Spending limit in dollars |

---

## API Reference

All endpoints are prefixed `/api`. The SPA is served at `/`.

### Setup & Configuration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/setup/status` | Returns `{"configured": bool}` — whether real Plaid credentials are saved |
| `POST` | `/api/setup/credentials` | Save Plaid credentials to `.env` and reload settings in-process |
| `POST` | `/api/setup/create-shortcut` | Create a Desktop shortcut (macOS: `.command`, Windows: `.lnk`) |
| `GET` | `/api/health` | Liveness check — returns `{"status": "ok"}` |

**`POST /api/setup/credentials` body:**
```json
{
  "client_id": "abc123",
  "secret": "xyz789",
  "plaid_env": "development"
}
```

### Plaid Integration

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/plaid/link-token` | Create a Plaid Link token (pass `account_id` for update/re-link mode) |
| `POST` | `/api/plaid/exchange-token` | Exchange a public token for an access token; triggers background sync |

### Accounts

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts with institution name and item status |
| `PATCH` | `/api/accounts/{id}` | Toggle `is_active` |
| `DELETE` | `/api/accounts/{id}` | Disconnect the item and delete all its data |

### Sync

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sync` | Trigger a background sync of all active items |

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions?week_start=YYYY-MM-DD` | All transactions for a week (included and excluded) |
| `PATCH` | `/api/transactions/{id}` | Update `user_excluded`, `user_included`, or `user_detailed_category` |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/week?week_start=YYYY-MM-DD` | Returns `summary`, `category_breakdown`, `category_breakdown_detailed`, `daily_totals` |
| `GET` | `/api/categories` | Full Plaid PFC v2 category reference |

**Analytics response structure:**
```json
{
  "summary": {
    "total_spend": 412.50,
    "transaction_count": 18,
    "top_category": { "name": "FOOD_AND_DRINK", "amount": 140.0, "pct": 33.9 },
    "largest_transaction": { "description": "Whole Foods", "amount": 87.32 },
    "last_synced_at": "2026-05-31T14:22:00"
  },
  "category_breakdown": [
    { "category": "FOOD_AND_DRINK", "amount": 140.0, "pct": 33.9, "transaction_count": 7 }
  ],
  "daily_totals": [
    { "date": "2026-05-26", "amount": 45.0, "transaction_count": 3 }
  ]
}
```

### Categorization Rules

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/categorization-rules` | List all rules |
| `POST` | `/api/categorization-rules` | Create a rule (optionally apply to history) |
| `DELETE` | `/api/categorization-rules/{id}` | Delete a rule (does not un-classify past transactions) |

### Goals

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/goals?week_start=YYYY-MM-DD` | List goals with current-week progress attached |
| `POST` | `/api/goals` | Create a goal |
| `PATCH` | `/api/goals/{id}` | Update name or weekly_limit |
| `DELETE` | `/api/goals/{id}` | Delete a goal |

**Goal response includes progress fields:**
```json
{
  "id": "abc-123",
  "name": "Food Budget",
  "type": "category",
  "category": "FOOD_AND_DRINK",
  "weekly_limit": 150.0,
  "actual_spend": 62.40,
  "projected_spend": 124.80,
  "percent_used": 41.6,
  "days_elapsed": 3,
  "status": "on_track"
}
```

---

## Feature Guide

### First-Run Setup Flow

```
App loads
    │
    ▼
GET /api/setup/status
    │
    ├── configured=false ──► /setup  (credentials wizard + desktop shortcut)
    │
    └── configured=true
              │
              ▼
         GET /api/accounts
              │
              ├── no accounts ──► /onboarding  (Plaid Link)
              │
              └── has accounts ──► /  (Dashboard)
```

### Dashboard

The main view. Shows data for the currently selected Mon–Sun week.

- **KPI row** — Total spend, top category (% of spend), largest single transaction
- **Spending by Category** — Donut chart; click a segment to filter the transaction table below
- **Daily Spending** — Bar chart of spend per day for the week
- **Transaction table** — All transactions (included and excluded) with a Status column

### Transaction Table

Every transaction shows:

| Column | Notes |
|---|---|
| Date | Transaction date |
| Description | Merchant name below if different; chips for Pending / Reclassified |
| Category | Primary · Detailed |
| Amount | Green if negative (refund/income) |
| **Status** | `● Counted` (green) or excluded reason (gray) |

**Right-click or click ⋮** on any row to:
- Reclassify category
- Exclude / un-exclude
- Include anyway (override auto-exclusion)

### Goals Page

Create and track weekly spending goals. Each goal card shows:

```
┌─────────────────────────────────┐
│ Food Budget          ● On Track │
│ Category  ·  Food & Drink       │
│ ▓▓▓▓▓▓▓░░░░░░░░░░░  41.6%      │
│ $62.40  /  $150.00 limit        │
│                                 │
│ Projected week total    $124.80 │
│ Based on 3 of 7 days elapsed    │
└─────────────────────────────────┘
```

**Goal types:**
- **Weekly** — caps total included spend across all categories
- **Category** — caps spend within one primary category (e.g., Food & Drink)

**Status:**
- `On Track` — projected week total ≤ limit
- `Off Track` — projected week total > limit

### Sidebar

- Navigate between pages (Dashboard, All Transactions, Goals)
- Click any week on the mini calendar to jump to it
- ← / → arrows step one week at a time
- "Today" button returns to the current week
- **Sync Transactions** button triggers a manual Plaid sync

---

## Transaction Processing Pipeline

### 1. Ingest (sync)

```
Plaid transactions_sync response
            │
    ┌───────┴────────┐
    │ Added/Modified │ Removed
    └───────┬────────┘    │
            │         DELETE from DB
            ▼
   compute_spend_amount()
   ┌─────────────────────────────────────────┐
   │  Credit account:  amount as-is          │
   │  Depository:      amount as-is          │
   │  (positive = money leaving = spending)  │
   └─────────────────────────────────────────┘
            │
   classify_auto_exclude()
   ┌─────────────────────────────────────────────────────┐
   │  CC payment on credit TRANSFER_IN  → cc_payment     │
   │  "CC PAYMENT" in checking desc     → cc_payment     │
   │  "ZELLE" in description            → transfer_zelle │
   │  TRANSFER_OUT/IN/TRANSFER category → transfer_intl  │
   │  INCOME category                   → income         │
   │  spend_amount < 0 (non-transfer)   → refund         │
   │  Otherwise                         → NULL (included)│
   └─────────────────────────────────────────────────────┘
            │
   apply_rules_to()   ← checks categorization_rules in order
            │
   INSERT / UPDATE transactions
```

### 2. CC Payment Pair Detection

After every sync, the system scans the last 14 days for matching pairs:

```
Checking account outflow (cc_payment) ←──── amount match + ≤3 days apart ────► Credit card TRANSFER_IN (cc_payment)
                                                    │
                                         Set paired_txn_id on both
```

This links the two sides of a credit card payment so neither is double-counted.

### 3. User Overrides (always preserved)

When a transaction is re-synced from Plaid, Plaid's data updates but user decisions are never overwritten:

| Field | On re-sync |
|---|---|
| `user_excluded` | Never touched |
| `user_included` | Never touched |
| `user_detailed_category` | Never touched |
| `auto_excluded_reason` | Only updated if user hasn't touched the transaction |

---

## Goal Projection Algorithm

Goals use a **day-of-week weighted projection** to account for the fact that spending is not evenly distributed across the week.

### Spend-Mass Weights

```
Monday    Tuesday   Wednesday  Thursday  Friday    Saturday  Sunday
 10%        12%        14%       14%       20%       18%       12%
```

These sum to 100%. Friday and Saturday carry the highest weight (most consumer spending happens then). Monday is lightest.

### Formula

```
days_elapsed  = clamp(today − week_start + 1,  min=1, max=7)
mass_elapsed  = sum of weights for days [Mon … elapsed]
projected     = actual_spend / mass_elapsed
```

**Example — Wednesday, $120 spent so far, $300 limit:**

```
days_elapsed  = 3  (Mon, Tue, Wed)
mass_elapsed  = 0.10 + 0.12 + 0.14 = 0.36
projected     = $120 / 0.36 = $333

Linear equiv  = $120 / 3 × 7 = $280

Because Friday and Saturday (0.38 combined weight) haven't arrived yet,
the weighted projection is correctly higher — a $333 projection against
a $300 limit flags this as Off Track before it's too late.
```

**Convergence:** On day 7, `mass_elapsed = 1.0`, so `projected = actual` exactly.

| Day | Mass elapsed | $120 actual → projected |
|---|---|---|
| Monday only | 0.10 | $1,200 |
| Mon–Wed | 0.36 | $333 |
| Mon–Thu | 0.50 | $240 |
| Mon–Fri | 0.70 | $171 |
| Full week | 1.00 | $120 |

---

## Configuration

All configuration is read from `.env` in the project root (created automatically on first run from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `PLAID_CLIENT_ID` | — | Plaid developer client ID |
| `PLAID_SECRET` | — | Plaid secret for chosen environment |
| `PLAID_ENV` | `development` | `sandbox` \| `development` \| `production` |
| `DATABASE_URL` | `sqlite:///data/ledger.db` | SQLAlchemy connection string |
| `HOST_SYNC_INTERVAL_SECONDS` | `3600` | Auto-sync interval at startup |

**Plaid environments:**

| Environment | Real banks? | Cost | Best for |
|---|---|---|---|
| `sandbox` | No (fake data) | Free | Testing the app without a bank |
| `development` | Yes | Free up to 100 items | Personal daily use |
| `production` | Yes | Paid per item | N/A for personal use |

---

## Installation

### Prerequisites

| Tool | macOS/Linux | Windows |
|---|---|---|
| Git | Pre-installed / `brew install git` | [git-scm.com](https://git-scm.com/download/win) |
| uv | Auto-installed by launcher | Auto-installed by launcher |
| Node.js | Auto-installed via Homebrew | Auto-installed via winget |

### macOS / Linux

```bash
# 1. Clone
git clone https://github.com/liamsoule-personal/personal-finance.git
cd personal-finance

# 2. Make launcher executable (one-time)
chmod +x launcher.sh stop.sh

# 3. Launch
./launcher.sh
```

The launcher:
1. Installs `uv` via `curl` if not present
2. Installs Node.js via Homebrew if not present and a build is needed
3. Builds the React frontend (`npm run build`) → copies to `src/web/static/`
4. Creates `.venv` and installs Python dependencies
5. Creates `.env` from `.env.example` if missing
6. Creates `data/` directory
7. Runs `alembic upgrade head`
8. Kills any existing server on port 8000
9. Starts `uvicorn` via `nohup` in the background
10. Waits for `GET /api/health` to return 200
11. Opens `http://localhost:8000` in the default browser

**To stop:** `./stop.sh`

**Logs:** `.server.log`

**Force a frontend rebuild:**
```bash
./launcher.sh --rebuild
```

### Windows

Right-click `launcher.ps1` → **"Run with PowerShell"**, or:

```powershell
powershell -ExecutionPolicy Bypass -File launcher.ps1
```

The Windows launcher performs the same steps using `winget` for package installs and creates **Desktop shortcuts** for one-click launch/stop.

If PowerShell blocks scripts:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## How-To Guides

### Connect a Bank Account

1. Complete the credentials setup at `/setup`
2. You are redirected to `/onboarding` — click **Connect Chase Account**
3. The Plaid Link modal opens — search for your bank, log in, select accounts
4. After connecting, a background sync fetches up to 2 years of transactions
5. You are redirected to the Dashboard

### Re-connect an Expired Account

A yellow banner appears on the Dashboard when a connection expires. Click **Reconnect**, complete the Plaid flow, and sync runs automatically.

### Exclude a Transaction

Right-click any row in the transaction table → **Exclude this transaction**.
The row stays visible but dims to 45% opacity and shows an "Excluded" status — it is no longer counted in totals or goal projections.

To reverse: right-click → **Un-exclude**.

### Override Auto-Exclusions

The system automatically excludes transfers, Zelle payments, credit card payments, income, and refunds. To force one of these into your spending totals:

Right-click → **Include anyway** → the row is marked `● Counted`.

### Reclassify a Transaction's Category

Right-click → **Reclassify category** → select a primary and detailed category → **Save**.

The change is stored in `user_detailed_category` and persists across syncs.

### Create a Categorization Rule

From the transaction's right-click menu → **Reclassify category** → check **"Apply to all matching transactions"** before saving.

This creates a `CategorizationRule` that will be applied to all future transactions matching the same merchant/description pattern. You can manage rules from the API at `GET /api/categorization-rules`.

### Set a Spending Goal

1. Navigate to **Goals** in the sidebar
2. Click **+ Add Goal**
3. Choose **Weekly** (all spend) or **Category** (one category)
4. Enter a name and dollar limit
5. Click **Create goal**

The goal card appears immediately with the current week's projection.

### Update the App

```bash
git pull
./launcher.sh          # re-runs migrations if needed, rebuilds if source changed
```

If frontend source changed significantly:
```bash
./launcher.sh --rebuild
```

---

## Troubleshooting

### "Permission denied" running `launcher.sh`

```bash
chmod +x launcher.sh stop.sh
```

### Port 8000 already in use

The launcher checks for this and will exit with the blocking process listed. Kill it:

```bash
# macOS / Linux
lsof -i :8000 -sTCP:LISTEN
kill <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### App didn't start — check the logs

```bash
# macOS / Linux
cat .server.log

# Windows — look for the minimised PowerShell window in the taskbar
```

Common causes:
- Missing `.env` — the launcher creates it automatically; run it again
- Bad Plaid credentials — check `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env`
- Database migration failed — run `alembic upgrade head` manually

### Plaid Link fails / "Failed to initialize Plaid"

- Confirm `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env` match the environment you selected (`PLAID_ENV`)
- The secret for Sandbox and Development are **different keys** — copy the one that matches your `PLAID_ENV`
- Re-enter credentials at `/setup` (the app detects placeholder values on load)

### Transactions missing after sync

- Click **Sync Transactions** in the sidebar
- Check `.server.log` for `status: failed` sync entries
- If the account shows a yellow reconnect banner, re-authenticate through Plaid Link

### Frontend looks outdated after `git pull`

```bash
./launcher.sh --rebuild
```

### Node.js not found (macOS)

Install [Homebrew](https://brew.sh) first, then re-run the launcher:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
./launcher.sh
```
