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

```bash
node {baseDir}/scripts/track.js <TRACKING_NUMBER>
```

**Examples:**
```bash
# International registered mail (RR / EM prefix)
node {baseDir}/scripts/track.js RR123456789IL

# EMS express
node {baseDir}/scripts/track.js EM123456789IL

# Domestic
node {baseDir}/scripts/track.js 1234567890
```

## Tracking Number Formats

| Format | Type |
|--------|------|
| `RR…IL` | International registered mail |
| `EM…IL` | EMS express mail |
| `CP…IL` | Parcel post |
| `RA…IL` | Registered airmail |
| `EA…IL` | EMS airmail |
| 10-digit number | Domestic parcel |

## Output

The script prints the full tracking event history — dates, statuses, and locations in Hebrew and/or English, newest last.

**Not found?** The tracking number may be invalid, or international packages can take 24–48 hours to appear after dispatch.

## Notes

- Uses Puppeteer with your system **Google Chrome** (not Chromium) to bypass Israel Post's Radware bot protection
- Requires Chrome at `/Applications/Google Chrome.app` (macOS) or `CHROME_PATH` env var
- Takes ~10–15 seconds per lookup
