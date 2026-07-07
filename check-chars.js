#!/usr/bin/env node
/**
 * check-chars.js — JSON 字数预检
 * 用法：node check-chars.js YYYY-MM-DD
 * 在 gen-html.js 之前跑，超标直接报错退出
 */

const fs = require('fs');
const path = require('path');

const date = process.argv[2];
if (!date) {
  console.error('Usage: node check-chars.js YYYY-MM-DD');
  process.exit(1);
}

const jsonPath = path.join(__dirname, 'data', `${date}.json`);
if (!fs.existsSync(jsonPath)) {
  console.error('JSON not found:', jsonPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const limits = {
  phrase_en: 17,
  phrase_pron: 45,
  meaning_cn: 18,
  trap_x: 40,
  trap_check: 40,
};

const exLimits = { source: 45, en: 52, cn: 22 };

const issues = [];
for (const [k, max] of Object.entries(limits)) {
  const v = (data[k] || '').toString();
  if (v.length > max) issues.push(`${k}: ${v.length}/${max}（溢出${v.length - max}）`);
}

(data.examples || []).forEach((ex, i) => {
  for (const [k, max] of Object.entries(exLimits)) {
    const v = (ex[k] || '').toString();
    if (v.length > max) issues.push(`examples[${i}].${k}: ${v.length}/${max}（溢出${v.length - max}）`);
  }
});

if (issues.length) {
  console.error(`❌ ${date} 字数超限：`);
  issues.forEach(m => console.error(' ', m));
  process.exit(1);
}

console.log(`✅ ${date} 字数预检通过`);
