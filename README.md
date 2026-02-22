# Israel Post Tracker 📦🇮🇱

Track packages via **Israel Post (דואר ישראל)** from the command line — with optional WhatsApp notifications when your package status changes.

> Unofficial tool, not affiliated with Israel Post. Data is fetched from the public Israel Post website.

---

## Features

- **One-shot tracking** — look up any tracking number and see the full event history
- **Monitor mode** — watch multiple packages, get a WhatsApp message the moment something changes
- **Bypass bot protection** — uses your real Google Chrome (not headless Chromium) to get past Radware
- **Smart detection** — flags when a package is delivered ✅ or stuck in customs 🛃

---

## Requirements

- **Node.js** v16+
- **Google Chrome** installed at `/Applications/Google Chrome.app` (macOS default)
  - Or set `CHROME_PATH` env var to your Chrome executable
- **OpenClaw** (only needed for WhatsApp notifications in monitor mode)

---

## Install

```bash
git clone https://github.com/WolfikOz/israel-post-tracking.git
cd israel-post-tracking
npm install
```

---

## One-Shot Tracking

Look up a single package and print the full event history:

```bash
node scripts/track.js <TRACKING_NUMBER>
```

**Examples:**
```bash
node scripts/track.js RR123456789IL   # International registered mail
node scripts/track.js EM123456789IL   # EMS express
node scripts/track.js CP123456789IL   # Parcel post
node scripts/track.js 1234567890      # Domestic parcel (10-digit)
```

**Sample output:**
```
🔍 Tracking: RR123456789IL
📡 Connecting to Israel Post...
⏳ Searching...

✅ Tracking results for RR123456789IL:

  11/01/2026  |  בתהליך מיון  |  סניף יקנעם עלית  |  יקנעם עילית
  11/01/2026  |  נקלט למשלוח  |  סניף יקנעם עלית  |  יקנעם עילית
  25/03/2025  |  בתהליך מיון  |  סניף הרצל, רחובות
```

---

## Monitor Mode (WhatsApp Notifications)

Watch multiple packages and get notified automatically when anything changes.

### 1. Set your WhatsApp number (one-time)

```bash
node scripts/monitor.js set-target +972XXXXXXXXX whatsapp
```

### 2. Add packages to your watchlist

```bash
node scripts/monitor.js add RR123456789IL "AliExpress headphones"
node scripts/monitor.js add EM987654321IL "Amazon order"
```

### 3. Check all packages

```bash
node scripts/monitor.js check
```

- **First run:** saves the current status as baseline — no notification sent
- **Subsequent runs:** if anything changed since last check → WhatsApp notification sent
- Delivered package → `✅ Package delivered!`
- Stuck in customs → `🛃 ⚠️ Package is in customs — action may be required.`

### 4. List your watchlist

```bash
node scripts/monitor.js list
```

```
📦 Tracking 2 package(s):

  RR123456789IL — "AliExpress headphones"
    🔄 In transit | Last checked: 22/2/2026, 14:41:29
    Last event: 11/01/2026 · בתהליך מיון · יקנעם עילית

  EM987654321IL — "Amazon order"
    ⏳ Not yet checked | Never checked
```

### 5. Remove a package

```bash
node scripts/monitor.js remove RR123456789IL
```

### Automate with a cron job

To get automatic monitoring, run `check` on a schedule. With OpenClaw:

```bash
openclaw cron add --schedule "every 4h" --command "cd /path/to/israel-post-tracking && node scripts/monitor.js check"
```

Or add to your system crontab:
```
0 */4 * * * cd /path/to/israel-post-tracking && node scripts/monitor.js check
```

---

## Tracking Number Formats

| Format | Type |
|--------|------|
| `RR…IL` | International registered mail |
| `EM…IL` | EMS express mail |
| `CP…IL` | Parcel post |
| `RA…IL` | Registered airmail |
| `EA…IL` | EMS airmail |
| 10-digit number | Domestic parcel |

---

## How It Works

Israel Post's website uses **Radware bot protection** that blocks standard headless browsers (Puppeteer/Playwright with Chromium). This tool bypasses it by using your **real system Chrome** instead of the bundled Chromium — real Chrome has a different fingerprint that passes Radware's checks.

Each run also uses a fresh random Chrome profile directory to avoid session-based detection.

---

## Troubleshooting

**"Chrome not found" error**
Make sure Google Chrome is installed. On macOS it should be at `/Applications/Google Chrome.app`. Set `CHROME_PATH` if yours is elsewhere:
```bash
CHROME_PATH="/path/to/chrome" node scripts/track.js RR123456789IL
```

**"Bot protection triggered"**
Your IP may be temporarily flagged. Wait a few minutes and try again. Avoid running the script many times in rapid succession.

**Package not found**
- Double-check the tracking number
- International packages can take 24–48 hours to appear on Israel Post's system after dispatch from the origin country

---

## License

MIT

---

*Part of the [awesome-agent-skills-israel](https://github.com/alexpolonsky/awesome-agent-skills-israel) collection.*
