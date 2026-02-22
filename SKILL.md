---
name: israel-post-tracking
description: Track packages and mail via Israel Post (דואר ישראל). Use when tracking a shipment, checking delivery status, or looking up where an Israeli Post parcel is. Also supports monitoring multiple packages and sending WhatsApp notifications when status changes. Supports all Israel Post tracking number formats (domestic and international). דואר ישראל, מעקב חבילה, מסלול משלוח, בדיקת סטטוס חבילה, איפה החבילה שלי, מעקב משלוח.
license: MIT
compatibility: Requires Node.js 16+ and Google Chrome installed at /Applications/Google Chrome.app (macOS). Set CHROME_PATH env var to override. Monitor mode notifications require OpenClaw.
metadata:
  author: WolfikOz
  version: "1.1.0"
---

# Israel Post Tracker (דואר ישראל)

Track packages via Israel Post — one-shot lookup or ongoing monitoring with WhatsApp notifications on status change.

> **Disclaimer**: Unofficial tool, not affiliated with Israel Post. Data is fetched from the public Israel Post website.

## When to use which command

- **User asks "where is my package / track this number"** → use `track.js` for an immediate result
- **User asks to be notified when a package moves / set up monitoring** → use `monitor.js`
- **Running as a scheduled check** → `monitor.js check`

## Requirements

- Google Chrome at `/Applications/Google Chrome.app` (macOS), or set `CHROME_PATH`
- For monitor notifications: OpenClaw with a configured WhatsApp channel

## Install

```bash
cd {baseDir} && npm install
```

## One-Shot Tracking

```bash
node {baseDir}/scripts/track.js <TRACKING_NUMBER>
```

**Examples:**
```bash
node {baseDir}/scripts/track.js RR123456789IL   # International registered mail
node {baseDir}/scripts/track.js EM123456789IL   # EMS express
node {baseDir}/scripts/track.js CP123456789IL   # Parcel post
node {baseDir}/scripts/track.js 1234567890      # Domestic (10-digit)
```

**Output:** Full event history — dates, statuses, and locations in Hebrew/English, newest last.

## Monitor Mode (WhatsApp notifications on status change)

### Setup (one-time)

```bash
# Set notification target — E.164 phone number
node {baseDir}/scripts/monitor.js set-target +972XXXXXXXXX whatsapp
```

### Add a package to the watchlist

```bash
node {baseDir}/scripts/monitor.js add <TRACKING_NUMBER> [optional name]
```

Example:
```bash
node {baseDir}/scripts/monitor.js add RR123456789IL "AliExpress headphones"
```

### Check all watched packages

```bash
node {baseDir}/scripts/monitor.js check
```

- First run → saves baseline status, no notification
- Every subsequent run → if status changed, sends WhatsApp notification
- Detected states: ✅ delivered, 🛃 stuck in customs

### Other commands

```bash
node {baseDir}/scripts/monitor.js list              # Show all tracked packages
node {baseDir}/scripts/monitor.js remove <NUMBER>  # Stop tracking a package
```

### State file

Watchlist and last-known statuses are stored in `~/.israel-post-state.json`.

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

- Uses Puppeteer with real system **Google Chrome** (not headless Chromium) to bypass Israel Post's Radware bot protection
- Each run uses a fresh random Chrome profile to avoid session-based detection
- Takes ~10–15 seconds per tracking lookup
- If bot protection triggers, wait a few minutes before retrying — avoid rapid repeated requests
- International packages may take 24–48 hours to appear after dispatch from origin country
