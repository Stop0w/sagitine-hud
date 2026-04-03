import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const screenshotDir = path.join(__dirname, 'docs', 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const baseUrl = 'http://localhost:5173';
  console.log(`Navigating to ${baseUrl}`);
  
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Assuming there's a pill/button to open the progressive disclosure initially
    // Since the system defaults to "collapsed", let's wait a moment
    await page.waitForTimeout(1500);
    console.log('Taking screenshot 1: Progressive Disclosure');
    await page.screenshot({ path: path.join(screenshotDir, '1_progressive_disclosure.png'), fullPage: true });

    // Open Hub
    // Wait... if the pill says "S.", we need to click it. Look for the button with S.
    console.log('Clicking to expand hub...');
    // We can just click the HUD pill or use a generic click on the first bottom right button
    // The pill has text 'S.'
    const pill = await page.getByRole('button').filter({ hasText: 'S' }).first();
    if (pill) await pill.click();
    await page.waitForTimeout(1500);
    
    console.log('Taking screenshot 2: First expansion (Hub Overview)');
    await page.screenshot({ path: path.join(screenshotDir, '2_hub_overview.png'), fullPage: true });

    // Phase 3: Category click (Ticket Queue)
    console.log('Double clicking category...');
    // Wait for the damaged & faulty category
    await page.locator('text=Damaged & Faulty').first().click();
    await page.waitForTimeout(1500);

    console.log('Taking screenshot 3: Ticket Queue');
    await page.screenshot({ path: path.join(screenshotDir, '3_ticket_queue.png'), fullPage: true });

    // Phase 4: Individual inquiry double click
    console.log('Double clicking inquiry...');
    await page.locator('text=Sarah Johnson').first().click();
    await page.waitForTimeout(1500);

    console.log('Taking screenshot 4a: Resolution Console (Collapsed)');
    await page.screenshot({ path: path.join(screenshotDir, '4a_resolution_console_collapsed.png'), fullPage: true });

    // Expand view
    console.log('Expanding view...');
    await page.locator('button[title="Expand to full view"]').first().click();
    
    await page.waitForTimeout(1500);
    console.log('Taking screenshot 4b: Resolution Console (Expanded)');
    await page.screenshot({ path: path.join(screenshotDir, '4b_resolution_console_expanded.png'), fullPage: true });

    console.log(`Success! Screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('Error during screenshot generation:', error);
  } finally {
    await browser.close();
  }
})();
