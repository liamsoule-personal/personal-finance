# Personal Finance

A personal finance tracker that connects to your bank accounts via Plaid and displays spending by week, category, and day.

---

## Requirements

Before installing, make sure you have:

- **Windows 10 or 11**
- **Git** — [download here](https://git-scm.com/download/win) if not already installed
- **Plaid account** — sign up free at [dashboard.plaid.com](https://dashboard.plaid.com). You'll need your **Client ID** and **Secret** from Team Settings → Keys.

> Docker Desktop is installed automatically by the launcher if you don't already have it.

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

1. Install **Docker Desktop** if it isn't already on your machine
2. Start Docker Desktop and wait for it to be ready
3. Create a **`.env` file** and open it in Notepad for you to fill in your Plaid credentials
4. Build and start the application container
5. Create **Desktop shortcuts** — "Personal Finance" (launch) and "Stop Personal Finance" (stop)
6. Open the app in your browser at `http://localhost:8000`

> The first run takes ~2 minutes to build the Docker image. Every run after that is near-instant.

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
| **Personal Finance** | Starts the app and opens it in your browser |
| **Stop Personal Finance** | Gracefully shuts down the app |

---

## Updating the App

To pull the latest version, open PowerShell in the project folder and run:

```powershell
git pull
```

The next time you launch the app, it will automatically rebuild with the latest changes.

---

## Troubleshooting

**Docker didn't start in time**
Open Docker Desktop from the Start menu, wait until it shows "Engine running" in the bottom-left, then re-run the launcher.

**App didn't respond within 60 seconds**
Check the container logs for errors:
```powershell
docker compose logs -f
```

**Plaid connection isn't working**
Ensure your `.env` file has the correct Client ID and Secret from [dashboard.plaid.com](https://dashboard.plaid.com). Use `PLAID_ENV=sandbox` to test with fake data without real bank credentials.

**PowerShell says "running scripts is disabled"**
Run this once in PowerShell as Administrator, then re-run the launcher:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
