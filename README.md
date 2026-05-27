# Personal Finance

A personal finance tracker that connects to your bank accounts via Plaid and displays spending by week, category, and day.

---

## Requirements

Before installing, make sure you have:

- **Windows 10 or 11**
- **Git** — [download here](https://git-scm.com/download/win) if not already installed
- **Plaid account** — sign up free at [dashboard.plaid.com](https://dashboard.plaid.com). You will need your **Client ID** and **Secret** from Team Settings -> Keys.

> Everything else (uv, Node.js) is installed automatically by the launcher on first run.

---

## Installation

### Step 1 — Clone the repository

Open PowerShell and run:

```powershell
git clone https://github.com/liamsoule-personal/personal-finance.git
cd personal-finance
```

### Step 2 — Run the launcher

Right-click `launcher.ps1` and select **"Run with PowerShell"**.

The launcher will automatically:

1. Install **uv** (Python package manager) if not already present — takes ~5 seconds
2. Install **Node.js** if not already present — takes ~30 seconds, only needed once
3. Build the React frontend and copy it into place
4. Create an isolated Python environment and install all dependencies — ~25 seconds on first run
5. Create a **`.env` file** and open it in Notepad for you to fill in your Plaid credentials
6. Run database migrations
7. Start the application server
8. Create **Desktop shortcuts** — "Personal Finance" (launch) and "Stop Personal Finance" (stop)
9. Open the app in your browser at `http://localhost:8000`

### Step 3 — Enter your Plaid credentials

When the `.env` file opens in Notepad, fill in your values:

```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_development_secret_here
PLAID_ENV=development
```

Save and close Notepad. The launcher will continue automatically.

---

## Daily Use

After the first run, use the **Desktop shortcuts** created during setup:

| Shortcut | What it does |
|----------|-------------|
| **Personal Finance** | Starts the server and opens the app in your browser |
| **Stop Personal Finance** | Shuts down the server |

The server runs in a minimized window in your taskbar while the app is active.

---

## Updating the App

To pull the latest version, open PowerShell in the project folder and run:

```powershell
git pull
```

Then relaunch using the Desktop shortcut. If the frontend source changed, run the launcher with `-Rebuild` to force a fresh frontend build:

```powershell
powershell -ExecutionPolicy Bypass -File launcher.ps1 -Rebuild
```

---

## Troubleshooting

**App did not respond — check the server window**
Look for a minimized PowerShell window in your taskbar labelled with the uvicorn process. Expand it to see any error output.

**Plaid connection is not working**
Ensure your `.env` file has the correct Client ID and Secret from [dashboard.plaid.com](https://dashboard.plaid.com). Use `PLAID_ENV=sandbox` to test with fake data without real bank credentials.

**PowerShell says "running scripts is disabled"**
Run this once in PowerShell as Administrator, then re-run the launcher:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Frontend looks outdated after a `git pull`**
Run the launcher with `-Rebuild` to force a fresh build:
```powershell
powershell -ExecutionPolicy Bypass -File launcher.ps1 -Rebuild
```
