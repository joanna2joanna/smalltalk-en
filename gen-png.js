const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const date = process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
  console.error('Usage: node gen-playwright.js YYYY-MM-DD[-suffix]');
  process.exit(1);
}

const htmlPath = path.join(__dirname, 'issues', `${date}-small-talk.html`);
const outputPath = path.join(__dirname, 'issues', `${date}-small-talk.png`);

async function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML not found:', htmlPath);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: '/Users/joanna/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  });
  const page = await browser.newPage();
  // 先用足够高的 viewport 渲染，避免卡片被视口裁切
  await page.setViewportSize({ width: 1080, height: 3000 });


  const html = fs.readFileSync(htmlPath, 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle' });

  const card = await page.$('.card');
  const box = await card.boundingBox();
  // card 用 height:auto+min-height，Chromium 行为变动后会撑到 2960px。
  // 用 page.screenshot({ clip }) 裁到卡片设计尺寸 1080×1440。
  await page.screenshot({ path: outputPath, type: 'png', scale: 'css', clip: { x: box.x, y: box.y, width: 1080, height: 1440 } });

  await browser.close();
  console.log('PNG saved:', outputPath);
}

main().catch(e => { console.error(e); process.exit(1); });
