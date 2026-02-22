#!/usr/bin/env node
/**
 * Israel Post Package Tracker (דואר ישראל)
 * Tracks shipments using the real system Chrome to bypass bot protection.
 *
 * Usage:
 *   node scripts/track.js <TRACKING_NUMBER>
 *   node scripts/track.js RR123456789IL
 *
 * Requires: Google Chrome installed at /Applications/Google Chrome.app (macOS)
 * Or set CHROME_PATH env var to your Chrome executable.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const TRACKING_URL = 'https://mypost.israelpost.co.il/itemtrace';
const CHROME_PATH = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TIMEOUT = 30000;

async function trackPackage(trackingNumber) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        `--user-data-dir=/tmp/israel-post-chrome-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`🔍 Tracking: ${trackingNumber}`);
    console.log('📡 Connecting to Israel Post...');

    await page.goto(TRACKING_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    const title = await page.title();
    if (
      title.toLowerCase().includes('captcha') ||
      title.toLowerCase().includes('access denied') ||
      title.toLowerCase().includes('radware')
    ) {
      throw new Error('Bot protection triggered — try again in a moment');
    }

    // Fill the tracking number input (barcode field)
    await page.waitForSelector('input[name="barcode"], input#_r_c_, input[type="text"]', { timeout: TIMEOUT });
    await page.click('input[name="barcode"], input#_r_c_, input[type="text"]');
    await page.type('input[name="barcode"], input#_r_c_, input[type="text"]', trackingNumber, { delay: 60 });

    console.log('⏳ Searching...');

    // Submit and wait for results
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);

    // Also try clicking a submit/search button if navigation didn't happen
    const button = await page.$('button[type="submit"], input[type="submit"], .search-btn, .btn-search');
    if (button) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        button.click(),
      ]);
    }

    await page.waitForTimeout(2000);

    // Extract results
    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Check for "not found" indicators
      const notFoundPatterns = [
        'לא נמצא', 'not found', 'no information', 'אין מידע',
        'לא קיים', 'לא אותר', 'לא נמסר', 'no results', 'item not found'
      ];
      const lowerText = bodyText.toLowerCase();
      const isNotFound = notFoundPatterns.some(p => lowerText.includes(p.toLowerCase()));
      if (isNotFound) return { found: false };

      // Extract tracking events from tables
      const events = [];
      const rows = document.querySelectorAll('table tr, .tracking-event, .trace-item, .event-row, [class*="event"], [class*="trace"]');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th, .col, [class*="col"], span, div');
        const texts = Array.from(cells).map(c => c.innerText.trim()).filter(t => t.length > 1 && !t.includes('\n'));
        if (texts.length >= 2) events.push(texts);
      });

      // Fallback: try extracting meaningful sections
      if (events.length === 0) {
        const sections = document.querySelectorAll('.tracking-result, .item-trace-result, .result, main, article, [class*="result"]');
        sections.forEach(s => {
          const text = s.innerText.trim();
          if (text.length > 20) events.push([text]);
        });
      }

      // Last resort: full body text if we have any indication of results
      const hasResults = bodyText.includes('תל אביב') || bodyText.includes('נמסר') ||
        bodyText.includes('ירושלים') || bodyText.includes('נמצא') ||
        bodyText.includes('delivered') || bodyText.includes('transit') ||
        bodyText.includes('customs') || /\d{2}\/\d{2}\/\d{4}/.test(bodyText) ||
        /\d{2}\.\d{2}\.\d{4}/.test(bodyText);

      return {
        found: events.length > 0 || hasResults,
        events,
        raw: bodyText.substring(0, 3000)
      };
    });

    if (!result.found) {
      console.log(`\n❌ No tracking information found for: ${trackingNumber}`);
      console.log('   • Verify the tracking number is correct');
      console.log('   • International packages may take 24–48h to appear after dispatch');
      console.log(`\n🔗 Check manually: ${TRACKING_URL}`);
      return false;
    }

    console.log(`\n✅ Tracking results for ${trackingNumber}:\n`);

    if (result.events && result.events.length > 0) {
      result.events.forEach(row => {
        console.log('  ' + row.join('  |  '));
      });
    } else {
      // Print clean version of raw text
      const lines = result.raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3 && !l.match(/^\s*$/))
        .slice(0, 30);
      console.log(lines.join('\n'));
    }

    return true;

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (err.message.includes('Chrome')) {
      console.error('   Make sure Google Chrome is installed at the expected path.');
      console.error(`   Set CHROME_PATH env var to override: ${CHROME_PATH}`);
    }
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const trackingNumber = process.argv[2];

if (!trackingNumber) {
  console.error('Usage: node scripts/track.js <TRACKING_NUMBER>');
  console.error('Example: node scripts/track.js RR123456789IL');
  process.exit(1);
}

trackPackage(trackingNumber.trim().toUpperCase()).then(success => {
  process.exit(success ? 0 : 1);
});
