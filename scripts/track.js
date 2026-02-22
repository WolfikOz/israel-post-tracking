#!/usr/bin/env node
/**
 * Israel Post Package Tracker (דואר ישראל)
 * Tracks a single shipment and prints full event history.
 *
 * Usage:
 *   node scripts/track.js <TRACKING_NUMBER>
 *   node scripts/track.js RR123456789IL
 *
 * Requires: Google Chrome installed at /Applications/Google Chrome.app (macOS)
 * Or set CHROME_PATH env var to your Chrome executable.
 *
 * For continuous monitoring + WhatsApp notifications, use monitor.js instead.
 */

const { trackPackage } = require('./lib');

const TRACKING_URL = 'https://mypost.israelpost.co.il/itemtrace';

async function main() {
  const trackingNumber = process.argv[2];

  if (!trackingNumber) {
    console.error('Usage: node scripts/track.js <TRACKING_NUMBER>');
    console.error('Example: node scripts/track.js RR123456789IL');
    process.exit(1);
  }

  const number = trackingNumber.trim().toUpperCase();
  console.log(`🔍 Tracking: ${number}`);
  console.log('📡 Connecting to Israel Post...');

  try {
    const result = await trackPackage(number);

    if (!result || !result.found) {
      console.log(`\n❌ No tracking information found for: ${number}`);
      console.log('   • Verify the tracking number is correct');
      console.log('   • International packages may take 24–48h to appear after dispatch');
      console.log(`\n🔗 Check manually: ${TRACKING_URL}`);
      process.exit(1);
    }

    console.log(`\n✅ Tracking results for ${number}:\n`);

    if (result.events && result.events.length > 0) {
      result.events.forEach(row => {
        console.log('  ' + row.join('  |  '));
      });
    } else {
      const lines = result.raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3 && !l.match(/^\s*$/))
        .slice(0, 30);
      console.log(lines.join('\n'));
    }

    process.exit(0);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (err.message.includes('Chrome') || err.message.includes('executable')) {
      console.error('   Make sure Google Chrome is installed at the expected path.');
      console.error(`   Set CHROME_PATH env var to override.`);
    }
    process.exit(1);
  }
}

main();
