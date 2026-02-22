/**
 * Israel Post tracking core — shared by track.js and monitor.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const TRACKING_URL = 'https://mypost.israelpost.co.il/itemtrace';
const CHROME_PATH = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TIMEOUT = 30000;

/**
 * Track a single package.
 * @param {string} trackingNumber
 * @returns {{ found: boolean, events: string[][], raw: string } | null}
 */
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

    await page.goto(TRACKING_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    const title = await page.title();
    if (
      title.toLowerCase().includes('captcha') ||
      title.toLowerCase().includes('access denied') ||
      title.toLowerCase().includes('radware')
    ) {
      throw new Error('Bot protection triggered — try again later');
    }

    await page.waitForSelector('input[name="barcode"], input#_r_c_, input[type="text"]', { timeout: TIMEOUT });
    await page.click('input[name="barcode"], input#_r_c_, input[type="text"]');
    await page.type('input[name="barcode"], input#_r_c_, input[type="text"]', trackingNumber, { delay: 60 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);

    const button = await page.$('button[type="submit"], input[type="submit"], .search-btn, .btn-search');
    if (button) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
        button.click(),
      ]);
    }

    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      const notFoundPatterns = [
        'לא נמצא', 'not found', 'no information', 'אין מידע',
        'לא קיים', 'לא אותר', 'לא נמסר', 'no results', 'item not found'
      ];
      const lowerText = bodyText.toLowerCase();
      const isNotFound = notFoundPatterns.some(p => lowerText.includes(p.toLowerCase()));
      if (isNotFound) return { found: false };

      const events = [];
      const rows = document.querySelectorAll('table tr, .tracking-event, .trace-item, .event-row, [class*="event"], [class*="trace"]');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th, .col, [class*="col"], span, div');
        const texts = Array.from(cells).map(c => c.innerText.trim()).filter(t => t.length > 1 && !t.includes('\n'));
        if (texts.length >= 2) events.push(texts);
      });

      if (events.length === 0) {
        const sections = document.querySelectorAll('.tracking-result, .item-trace-result, .result, main, article, [class*="result"]');
        sections.forEach(s => {
          const text = s.innerText.trim();
          if (text.length > 20) events.push([text]);
        });
      }

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

    return result;

  } catch (err) {
    throw err;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Extract a "signature" from the latest event — used to detect status changes.
 * Falls back to raw page text if no structured events found.
 * Returns a string like "11/01/2026|בתהליך מיון|יקנעם עילית"
 */
function eventSignature(events, raw) {
  // Try structured events first
  if (events && events.length > 0) {
    const candidates = events.filter(row => row.some(c => /\d{2}[./]\d{2}[./]\d{4}/.test(c)));
    if (candidates.length > 0) return candidates[candidates.length - 1].join('|');
    return events[events.length - 1].join('|');
  }

  // Fallback: extract meaningful lines from raw text
  if (raw) {
    const lines = raw.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2);

    // Find lines with dates
    const dateLines = lines.filter(l => /\d{2}[./]\d{2}[./]\d{4}/.test(l));
    if (dateLines.length > 0) return dateLines[dateLines.length - 1];

    // Find Hebrew status lines
    const hebrewLines = lines.filter(l => /[\u0590-\u05FF]/.test(l) && l.length > 5);
    if (hebrewLines.length > 0) return hebrewLines[hebrewLines.length - 1];

    // Last resort: hash the first 200 chars of raw
    return raw.substring(0, 200).replace(/\s+/g, ' ').trim();
  }

  return '';
}

/**
 * Detect if a package is delivered based on event text.
 */
function isDelivered(events, raw) {
  const deliveredKeywords = ['נמסר לנמען', 'נמסר', 'delivered', 'נמסרה'];
  const text = (events || []).flat().join(' ') + (raw || '');
  return deliveredKeywords.some(k => text.includes(k));
}

/**
 * Detect if a package is stuck in customs.
 */
function isInCustoms(events, raw) {
  const customsKeywords = ['מכס', 'customs', 'עצור', 'בדיקת מכס'];
  const text = (events || []).flat().join(' ') + (raw || '');
  return customsKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
}

module.exports = { trackPackage, eventSignature, isDelivered, isInCustoms };
