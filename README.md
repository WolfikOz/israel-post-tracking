# israel-post-tracking

Track packages via **Israel Post (דואר ישראל)** from the command line or via an AI agent.

## Install

```bash
npm install
```

## Usage

```bash
node scripts/track.js <TRACKING_NUMBER>
```

**Examples:**
```bash
node scripts/track.js RR123456789IL   # International registered
node scripts/track.js EM123456789IL   # EMS express
node scripts/track.js 1234567890      # Domestic parcel
```

## How It Works

Uses Puppeteer with stealth mode to navigate the [Israel Post tracking page](https://mypost.israelpost.co.il/itemtrace), bypass bot protection, and extract tracking events.

## Requirements

- Node.js v16+
- ~300 MB disk space (Chromium, downloaded once on first install)

## License

MIT

---

*Part of the [awesome-agent-skills-israel](https://github.com/alexpolonsky/awesome-agent-skills-israel) collection.*
