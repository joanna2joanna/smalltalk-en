/**
 * check-layout.js — Small Talk 卡片版式自检
 * 用法：node check-layout.js YYYY-MM-DD[-suffix]
 *
 * 检查项：
 * 1. 短语是否溢出 .phrase-area（被截断或超出）
 * 2. .trap-text / .trap-right 是否溢出 .trap-card
 * 3. .ex-en / .ex-cn 是否溢出 .ex-item
 * 4. 任意元素是否溢出 .card（超出 1440px 高度）
 * 5. 卡片实际高度是否超过 1440px（内容溢出）
 * 6. 中英文例句是否出现单字成行（orphan）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const date = process.argv[2];
if (!date) {
  console.error('Usage: node check-layout.js YYYY-MM-DD[-suffix]');
  process.exit(1);
}

const baseDir = path.resolve(__dirname, 'issues');
const htmlPath = path.join(baseDir, `${date}-small-talk.html`);

async function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML not found:', htmlPath);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: '/Users/joanna/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 3000 });

  const html = fs.readFileSync(htmlPath, 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle' });

  const issues = [];

  // —— 检查 1：卡片实际高度是否超过 1440px ——
  const cardBounds = await page.$eval('.card', el => {
    const r = el.getBoundingClientRect();
    return { height: r.height, bottom: r.bottom };
  });
  if (cardBounds.height > 1440 + 5) {  // 容差 5px
    issues.push(`⚠️ 卡片实际高度 ${Math.round(cardBounds.height)}px 超过 1440px（溢出 ${Math.round(cardBounds.height - 1440)}px）`);
  }

  // —— 检查 2：.phrase-en 是否字重溢出（横向溢出 phrase-area）——
  const phraseOverflow = await page.$eval('.phrase-en', el => {
    const r = el.getBoundingClientRect();
    const parent = el.closest('.phrase-area');
    const pr = parent.getBoundingClientRect();
    return {
      elRight: r.right,
      parentRight: pr.right,
      elLeft: r.left,
      parentLeft: pr.left,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      text: el.textContent.trim(),
    };
  });
  if (phraseOverflow.elRight > phraseOverflow.parentRight + 5) {
    issues.push(`⚠️ 短语「${phraseOverflow.text}」向右溢出 ${Math.round(phraseOverflow.elRight - phraseOverflow.parentRight)}px`);
  }

  // —— 检查 3：.trap-text / .trap-right 是否溢出 .trap-card ——
  const trapOverflow = await page.$$eval('.trap-row', rows => rows.map(row => {
    const card = row.closest('.trap-card');
    const cr = card.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return {
      rowRight: rr.right,
      cardRight: cr.right,
      rowLeft: rr.left,
      cardLeft: cr.left,
      rowBottom: rr.bottom,
      cardBottom: cr.bottom,
    };
  }));
  trapOverflow.forEach((r, i) => {
    if (r.rowRight > r.cardRight + 5) {
      issues.push(`⚠️ .trap-row[${i}] 向右溢出 ${Math.round(r.rowRight - r.cardRight)}px`);
    }
    if (r.rowLeft < r.cardLeft - 5) {
      issues.push(`⚠️ .trap-row[${i}] 向左溢出 ${Math.round(r.cardLeft - r.rowLeft)}px`);
    }
  });

  // —— 检查 4：.ex-en / .ex-cn 是否溢出 .ex-item ——
  const exOverflow = await page.$$eval('.ex-item', (items, _) => items.map(item => {
    const cr = item.getBoundingClientRect();
    const children = [...item.children];
    const childResults = children.map(c => ({
      tag: c.className,
      right: c.getBoundingClientRect().right,
      bottom: c.getBoundingClientRect().bottom,
    }));
    return { itemRight: cr.right, itemBottom: cr.bottom, children: childResults };
  }), null);
  exOverflow.forEach((it, i) => {
    it.children.forEach(c => {
      if (c.right > it.itemRight + 5) {
        issues.push(`⚠️ .ex-item[${i}].${c.tag} 向右溢出 ${Math.round(c.right - it.itemRight)}px`);
      }
    });
  });

  // —— 检查 5：单字成行（orphan）——
  // 检查 .ex-cn 和 .meaning-cn 是否有单字单独成行
  const orphanCheck = await page.$$eval('.ex-cn, .meaning-cn, .trap-text, .trap-right', els => els.map(el => {
    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const rects = [...el.getClientRects()];
    // 检查最后一行是否只有一个字
    const text = el.textContent.trim();
    if (!text) return null;
    // 用 range 检测最后一行文字
    const range = document.createRange();
    range.selectNodeContents(el);
    const rectsFull = range.getClientRects();
    if (rectsFull.length === 0) return null;
    // 简单判断：如果最后一行高度正常但文字只有一个字符，大概率 orphan
    const lines = el.innerHTML.split('<br>');
    const lastLine = lines[lines.length - 1]?.replace(/<[^>]+>/g, '').trim();
    if (lastLine && lastLine.length === 1) {
      return { text: lastLine, context: el.className, full: el.textContent.trim().slice(0, 30) };
    }
    return null;
  }));
  orphanCheck.forEach(r => {
    if (r) {
      issues.push(`⚠️ Orphan 风险：${r.context} 末行只有一个字「${r.text}」（上下文：「${r.full}...」）`);
    }
  });

  // —— 检查 6：元素之间是否重叠（getBoundingClientRect 交叉检测）——
  const overlapCheck = await page.$eval('.card', card => {
    const selectors = ['.phrase-area', '.meaning-area', '.trap-card', '.examples'];
    const rects = selectors.map(s => {
      const el = card.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { sel: s, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }).filter(Boolean);

    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        // 检查垂直方向是否重叠（且不是上下排列的正常情况）
        const aBottomBelowBTop = a.bottom > b.top + 2;  // +2px 容差
        const bBottomBelowATop = b.bottom > a.top + 2;
        if (aBottomBelowBTop && bBottomBelowATop) {
          // 进一步检查水平方向是否有交叉
          const horizOverlap = a.left < b.right && a.right > b.left;
          if (horizOverlap) {
            overlaps.push(`${a.sel} 与 ${b.sel} 重叠`);
          }
        }
      }
    }
    return overlaps;
  });
  overlapCheck.forEach(msg => issues.push(`⚠️ 元素重叠：${msg}`));

  await browser.close();

  // —— 输出报告 ——
  if (issues.length === 0) {
    console.log(`✅ ${date} 版式自检通过，无溢出/重叠/orphan 问题`);
    process.exit(0);
  } else {
    console.error(`❌ ${date} 版式自检发现 ${issues.length} 个问题：`);
    issues.forEach(m => console.error(' ', m));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
