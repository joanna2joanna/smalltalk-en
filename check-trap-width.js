#!/usr/bin/env node
/**
 * check-trap-width.js — GOTCHA 区文案单行预检
 *
 * 用法：
 *   node check-trap-width.js YYYY-MM-DD[-suffix]   读 data/<date>.json 的 trap_x / trap_check
 *   node check-trap-width.js "候选串1" "候选串2"    直接测任意文案
 *
 * 为什么需要：.trap-right 是 white-space:normal，超宽会折行；折出来的末行
 * 常常只剩 1 到 2 个字，直接踩孤字规则。check-chars.js 只管字数上限 40，
 * 管不到渲染宽度。实测单行上限约 37 字 / 812px（汉字 28px，英文约 15px）。
 *
 * .trap-x 那行是 nowrap + ellipsis，超宽会截断成 ⋯，一并报出来。
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node check-trap-width.js YYYY-MM-DD[-suffix] | "候选串" ...');
  process.exit(1);
}

// 单个参数且像日期 → 读 JSON；否则全部当候选文案
const dateLike = args.length === 1 && /^\d{4}-\d{2}-\d{2}/.test(args[0]);
let items;
if (dateLike) {
  const jsonPath = path.join(__dirname, 'data', `${args[0]}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error('JSON not found:', jsonPath);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  items = [
    { label: 'trap_x', text: data.trap_x || '' },
    { label: 'trap_check', text: data.trap_check || '' },
  ];
} else {
  items = args.map((t, i) => ({ label: `#${i + 1}`, text: t }));
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#2a2a3a;display:flex;justify-content:center}
.card{width:1080px;background:#2E2E48;padding:72px 72px 90px 72px;font-family:'Helvetica Neue','PingFang SC',sans-serif}
.trap-card{width:100%;background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.3);border-radius:16px;padding:24px 30px;margin-bottom:36px}
.trap-header{font-size:28px;color:#F0A500;letter-spacing:4px;text-transform:uppercase;margin-bottom:16px;font-weight:600}
.trap-row{display:flex;align-items:flex-start;gap:20px;margin-bottom:10px}
.trap-row:last-child{margin-bottom:0}
.trap-x{font-size:34px;color:#E94560;font-weight:700;flex-shrink:0;line-height:1.2}
.trap-text{font-size:28px;color:rgba(255,255,255,0.4);text-decoration:line-through;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.trap-check{font-size:34px;color:#00E676;font-weight:700;flex-shrink:0;line-height:1.2}
.trap-right{font-size:28px;color:#fff;font-weight:500;line-height:1.4;white-space:normal;overflow-wrap:break-word;max-width:100%}
`;

async function main() {
  const browser = await chromium.launch({
    executablePath: '/Users/joanna/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1200 });

  let bad = 0;
  for (const it of items) {
    // 候选串模式只验 trap_check（喂进来的就是它）；trap_x 那行留空，免得报假截断
    const html = `<style>${CSS}</style><div class="card"><div class="trap-card">
      <div class="trap-row"><span class="trap-x">X</span><span class="trap-text" id="x">${dateLike ? it.text : ''}</span></div>
      <div class="trap-row"><span class="trap-check">&#10003;</span><span class="trap-right" id="c">${it.text}</span></div>
    </div></div>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const c = document.getElementById('c');
      const range = document.createRange();
      range.selectNodeContents(c);
      const rects = Array.from(range.getClientRects());
      const lines = new Set(rects.map(x => Math.round(x.top))).size;
      const x = document.getElementById('x');
      return { lines, truncated: x.scrollWidth > x.clientWidth + 1 };
    });

    const note = [];
    if (r.lines > 1) { note.push(`折行成 ${r.lines} 行，末行易孤字`); bad++; }
    if (r.truncated) note.push('trap_x 被 ⋯ 截断');
    console.log(`${note.length ? '❌' : '✅'} ${it.label} ${r.lines} 行  ${it.text}`);
    note.forEach(n => console.log(`     └ ${n}`));
  }

  await browser.close();
  process.exit(bad ? 1 : 0);
}
main();
