#!/usr/bin/env node
/**
 * Israel Post Package Monitor (מעקב חבילות)
 * Tracks multiple packages and sends WhatsApp notifications when status changes.
 *
 * Commands:
 *   node scripts/monitor.js add <TRACKING_NUMBER> [name]   — Add a package to watchlist
 *   node scripts/monitor.js remove <TRACKING_NUMBER>       — Remove from watchlist
 *   node scripts/monitor.js list                           — Show all tracked packages
 *   node scripts/monitor.js check                          — Check all, notify on changes
 *
 * Config: ~/.israel-post-state.json
 * Notifications: WhatsApp via `openclaw message send`
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { trackPackage, eventSignature, isDelivered, isInCustoms } = require('./lib');

const STATE_FILE = path.join(process.env.HOME, '.israel-post-state.json');

// ── State helpers ────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { notifyChannel: 'whatsapp', notifyTarget: null, packages: {} };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── WhatsApp notification ────────────────────────────────────────────────────

function notify(state, message) {
  if (!state.notifyTarget) {
    console.log(`[NOTIFY] ${message}`);
    return;
  }
  try {
    const escaped = message.replace(/"/g, '\\"');
    execSync(
      `openclaw message send --channel ${state.notifyChannel} --target "${state.notifyTarget}" --message "${escaped}"`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    console.error(`Failed to send notification: ${err.message}`);
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdAdd(args) {
  const trackingNumber = (args[0] || '').trim().toUpperCase();
  const name = args.slice(1).join(' ') || trackingNumber;

  if (!trackingNumber) {
    console.error('Usage: monitor.js add <TRACKING_NUMBER> [name]');
    process.exit(1);
  }

  const state = loadState();
  if (state.packages[trackingNumber]) {
    console.log(`Already tracking ${trackingNumber} (${state.packages[trackingNumber].name})`);
    return;
  }

  state.packages[trackingNumber] = {
    name,
    addedAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastSignature: null,
    delivered: false,
  };
  saveState(state);
  console.log(`✅ Added: ${trackingNumber} — "${name}"`);
  console.log(`   Run 'monitor.js check' to fetch initial status.`);
}

function cmdRemove(args) {
  const trackingNumber = (args[0] || '').trim().toUpperCase();
  if (!trackingNumber) {
    console.error('Usage: monitor.js remove <TRACKING_NUMBER>');
    process.exit(1);
  }

  const state = loadState();
  if (!state.packages[trackingNumber]) {
    console.log(`Not tracking ${trackingNumber}`);
    return;
  }

  const name = state.packages[trackingNumber].name;
  delete state.packages[trackingNumber];
  saveState(state);
  console.log(`🗑️  Removed: ${trackingNumber} — "${name}"`);
}

function cmdList() {
  const state = loadState();
  const pkgs = Object.entries(state.packages);

  if (pkgs.length === 0) {
    console.log('No packages being tracked. Use: monitor.js add <TRACKING_NUMBER> [name]');
    return;
  }

  console.log(`📦 Tracking ${pkgs.length} package(s):\n`);
  pkgs.forEach(([num, pkg]) => {
    const status = pkg.delivered ? '✅ Delivered' : pkg.lastSignature ? '🔄 In transit' : '⏳ Not yet checked';
    const checked = pkg.lastCheckedAt
      ? `Last checked: ${new Date(pkg.lastCheckedAt).toLocaleString('he-IL')}`
      : 'Never checked';
    console.log(`  ${num} — "${pkg.name}"`);
    console.log(`    ${status} | ${checked}`);
    if (pkg.lastSignature) console.log(`    Last event: ${pkg.lastSignature.split('|').join(' · ')}`);
    console.log();
  });
}

async function cmdCheck() {
  const state = loadState();
  const pkgs = Object.entries(state.packages);

  if (pkgs.length === 0) {
    console.log('No packages to check. Add one with: monitor.js add <TRACKING_NUMBER> [name]');
    return;
  }

  console.log(`🔍 Checking ${pkgs.length} package(s)...\n`);
  let notifiedCount = 0;

  for (const [trackingNumber, pkg] of pkgs) {
    if (pkg.delivered) {
      console.log(`✅ ${trackingNumber} (${pkg.name}) — already delivered, skipping`);
      continue;
    }

    console.log(`📡 Checking ${trackingNumber} (${pkg.name})...`);

    try {
      const result = await trackPackage(trackingNumber);
      state.packages[trackingNumber].lastCheckedAt = new Date().toISOString();

      if (!result || !result.found) {
        console.log(`   ❓ No data found — may still be in transit or number is invalid`);
        continue;
      }

      const currentSig = eventSignature(result.events, result.raw);
      const previousSig = pkg.lastSignature;
      const delivered = isDelivered(result.events, result.raw);
      const inCustoms = isInCustoms(result.events, result.raw);

      // First check (no previous signature) — just save baseline, no notification
      if (!previousSig) {
        state.packages[trackingNumber].lastSignature = currentSig;
        state.packages[trackingNumber].delivered = delivered;
        const latestEvent = currentSig.split('|').join(' · ');
        console.log(`   📝 Baseline saved: ${latestEvent || 'status unknown'}`);
        continue;
      }

      // No change
      if (currentSig === previousSig) {
        console.log(`   ➡️  No change`);
        continue;
      }

      // Status changed — notify!
      state.packages[trackingNumber].lastSignature = currentSig;
      state.packages[trackingNumber].delivered = delivered;

      // Build the latest events (new ones only)
      const latestRows = (result.events || [])
        .filter(row => row.some(c => /\d{2}[./]\d{2}[./]\d{4}/.test(c)))
        .slice(-3)
        .map(row => row.join(' · '))
        .join('\n');

      let statusIcon = '📦';
      let statusNote = '';
      if (delivered) {
        statusIcon = '✅';
        statusNote = '\n🎉 Package delivered!';
      } else if (inCustoms) {
        statusIcon = '🛃';
        statusNote = '\n⚠️ Package is in customs — action may be required.';
      }

      const message =
        `${statusIcon} Israel Post Update\n` +
        `${trackingNumber} — ${pkg.name}\n\n` +
        `${latestRows || currentSig.split('|').join(' · ')}` +
        statusNote;

      console.log(`   🆕 Status changed — notifying:`);
      console.log(`   ${message.replace(/\n/g, '\n   ')}`);
      notify(state, message);
      notifiedCount++;

    } catch (err) {
      console.error(`   ❌ Error checking ${trackingNumber}: ${err.message}`);
    }

    // Small delay between requests to be polite to Israel Post servers
    await new Promise(r => setTimeout(r, 3000));
  }

  saveState(state);
  console.log(`\n✅ Check complete. ${notifiedCount} notification(s) sent.`);
}

function cmdSetTarget(args) {
  const target = (args[0] || '').trim();
  const channel = (args[1] || 'whatsapp').trim();
  if (!target) {
    console.error('Usage: monitor.js set-target <phone_or_id> [channel]');
    console.error('Example: monitor.js set-target +972545292949 whatsapp');
    process.exit(1);
  }
  const state = loadState();
  state.notifyTarget = target;
  state.notifyChannel = channel;
  saveState(state);
  console.log(`✅ Notifications will be sent to ${target} via ${channel}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'add':
    cmdAdd(args);
    break;
  case 'remove':
  case 'rm':
  case 'delete':
    cmdRemove(args);
    break;
  case 'list':
  case 'ls':
    cmdList();
    break;
  case 'check':
  case 'run':
    cmdCheck().catch(err => { console.error(err); process.exit(1); });
    break;
  case 'set-target':
    cmdSetTarget(args);
    break;
  default:
    console.log(`
Israel Post Monitor — commands:
  add <TRACKING_NUMBER> [name]   Add a package to watchlist
  remove <TRACKING_NUMBER>       Remove from watchlist
  list                           Show all tracked packages
  check                          Check all packages, send WhatsApp on change
  set-target <number> [channel]  Set WhatsApp notification target

Examples:
  node scripts/monitor.js add RR123456789IL "AliExpress order"
  node scripts/monitor.js set-target +972545292949 whatsapp
  node scripts/monitor.js check
    `);
    break;
}
