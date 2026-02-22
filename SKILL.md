---
name: israel-post-tracking
description: Track packages and mail via Israel Post (דואר ישראל). Use when tracking a shipment, checking delivery status, or looking up where an Israeli Post parcel is. Supports all Israel Post tracking numbers (domestic and international). דואר ישראל, מעקב חבילה, מסלול משלוח, בדיקת סטטוס חבילה, איפה החבילה שלי.
---

# Israel Post Tracker

Track packages via Israel Post (דואר ישראל) using a headless browser.

> **Disclaimer**: Unofficial tool, not affiliated with Israel Post. Tracking data is fetched from the Israel Post public website.

## Requirements

- **Google Chrome** must be installed at `/Applications/Google Chrome.app` (macOS default)
- Or set `CHROME_PATH` env var to your Chrome executable path

## Install

```bash
cd /path/to/skill && npm install
```

## Usage

### One-shot lookup

```bash
node {baseDir}/scripts/track.js <TRACKING_NUMBER>
```

```bash
# International registered mail (RR / EM prefix)
node {baseDir}/scripts/track.js RR123456789IL

# EMS express
node {baseDir}/scripts/track.js EM123456789IL

# Domestic
node {baseDir}/scripts/track.js 1234567890
```

### Monitor mode — WhatsApp notifications on status change

```bash
# Set your WhatsApp number (one-time setup)
node {baseDir}/scripts/monitor.js set-target +972XXXXXXXXX whatsapp

# Add a package to the watchlist
node {baseDir}/scripts/monitor.js add RR123456789IL "My AliExpress order"

# Check all watched packages (run this on a schedule)
node {baseDir}/scripts/monitor.js check

# List what you're tracking
node {baseDir}/scripts/monitor.js list

# Remove a package
node {baseDir}/scripts/monitor.js remove RR123456789IL
```

**How it works:**
1. First `check` saves the current status as baseline (no notification)
2. Subsequent checks compare to baseline — if status changed, sends a WhatsApp message
3. Detects special states: ✅ delivered, 🛃 stuck in customs
4. State is saved in `~/.israel-post-state.json`

**Tip:** Set up a cron job to run `check` every 3–6 hours for hands-off monitoring.

## Tracking Number Formats

| Format | Type |
|--------|------|
| `RR…IL` | International registered mail |
| `EM…IL` | EMS express mail |
| `CP…IL` | Parcel post |
| `RA…IL` | Registered airmail |
| `EA…IL` | EMS airmail |
| 10-digit number | Domestic parcel |

## Notes

- Uses Puppeteer with your system **Google Chrome** (not Chromium) to bypass Israel Post's Radware bot protection
- Requires Chrome at `/Applications/Google Chrome.app` (macOS) or `CHROME_PATH` env var
- Takes ~10–15 seconds per lookup
- Monitor notifications sent via `openclaw message send` (requires OpenClaw)
