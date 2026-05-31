# Personal Finance

A personal finance tracker that connects to your bank accounts via Plaid and displays spending by week, category, and day.

---

## Requirements

- **Git** — [download here](https://git-scm.com/downloads) if not already installed
- **A Plaid account** — sign up free at [dashboard.plaid.com](https://dashboard.plaid.com/signup). You will need your **Client ID** and **Secret** from Team Settings → Keys. *(The app walks you through this on first run.)*

> Everything else (uv, Node.js) is installed automatically by the launcher on first run.

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/liamsoule-personal/personal-finance.git
cd personal-finance
```

### Step 2 — Run the launcher

**macOS / Linux:**
```bash
chmod +x launcher.sh   # only needed once after cloning
./launcher.sh
```

**Windows:**

Right-click `launcher.ps1` and select **"Run with PowerShell"**, or run in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File launcher.ps1
```

The launcher automatically:
1. Installs **uv** (Python package manager) if not present
2. Installs **Node.js** if not present (macOS: via Homebrew; Windows: via winget)
3. Builds the React frontend
4. Creates an isolated Python environment and installs all dependencies
5. Creates a `.env` file and runs database migrations
6. Starts the application server
7. Opens the app in your browser at `http://localhost:8000`

### Step 3 — Enter your Plaid credentials

On first launch the app opens a **setup screen** asking for your Plaid API keys.
Click the **"Sign up for Plaid →"** button if you don't have an account yet, then:

1. Log in to [dashboard.plaid.com](https://dashboard.plaid.com)
2. Go to **Team Settings → Keys**
3. Copy your **Client ID** and **Secret**
4. Paste them into the setup screen and click **Save & Continue**

Your credentials are saved to a `.env` file on your machine only — they are never transmitted anywhere except directly to Plaid.

---

## Daily Use

### macOS / Linux

| Action | Command |
|--------|---------|
| Start the app | `./launcher.sh` |
| Stop the app | `./stop.sh` |
| View server logs | `cat .server.log` |

### Windows

Use the **Desktop shortcuts** created during the first run:

| Shortcut | What it does |
|----------|--------------|
| **Personal Finance** | Starts the server and opens the app |
| **Stop Personal Finance** | Shuts down the server |

---

## Updating the App

Pull the latest version:

```bash
git pull
```

Then relaunch. If frontend source files changed, force a fresh build:

**macOS / Linux:**
```bash
./launcher.sh --rebuild
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File launcher.ps1 -Rebuild
```

---

## Troubleshooting

### "Permission denied" when running `launcher.sh` (macOS / Linux)

The script needs to be marked executable. Run once:

```bash
chmod +x launcher.sh stop.sh
```

### PowerShell says "running scripts is disabled" (Windows)

Run this once in PowerShell as Administrator, then re-run the launcher:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### App did not respond / blank page

Check the server logs for errors:

```bash
# macOS / Linux
cat .server.log

# Windows — look for a minimized PowerShell window in the taskbar
```

### Plaid connection is not working

- Confirm your **Client ID** and **Secret** are correct in the app's setup screen (or in the `.env` file).
- Use `PLAID_ENV=sandbox` in the setup screen to test with fake data without a real bank connection.

### Node.js not found on macOS

Install [Homebrew](https://brew.sh) first, then re-run the launcher:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
./launcher.sh
```
