#!/usr/bin/env node
/**
 * gen-html.js — Small Talk 卡片 HTML 生成器
 * 用法：echo '{...}' | node gen-html.js YYYY-MM-DD
 *
 * stdin JSON 格式：
 * {
 *   "phrase_en": "You can say that again.",
 *   "phrase_pron": "/juː kən seɪ ðæt əˈɡen/",
 *   "meaning_cn": "<em>可不是嘛！</em> / 说得太对了！",
 *   "trap_x": "字面意思：你可以再说一遍",
 *   "trap_check": "真正意思：我完全同意！（不是叫你重复）",
 *   "examples": [
 *     { "source": "Friends S9E04 · 老友记", "en": "\"This party...\"", "cn": "这派对..." },
 *     ...（3个）
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: echo \'{...}\' | node gen-html.js YYYY-MM-DD');
  process.exit(1);
}

const date = args[0];
const templatePath = path.join(__dirname, 'template.html');
const outputDir = path.join(__dirname, 'issues');
const outputPath = path.join(outputDir, `${date}-small-talk.html`);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read JSON from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input.trim());
  } catch (e) {
    console.error('Invalid JSON from stdin:', e.message);
    process.exit(1);
  }

  let template = fs.readFileSync(templatePath, 'utf8');

  // ⚠️ nl2br：JSON.parse 后 \n 已变成真正的换行符(ASCII 10)
  // 用 split/join 避开正则转义歧义，可靠地将换行符转为 <br>
  const nl2br = (s) => (s || '').split('\n').join('<br>');

  // Auto-detect phrase length and apply size class
  // Default 120px; >15 chars → 105px (long); >22 chars → 90px (vlong)
  const phrase = data.phrase_en || '';
  let phraseHtml = phrase;
  if (phrase.length > 22) {
    phraseHtml = `<div class="phrase-en vlong-phrase">${phrase}</div>`;
  } else if (phrase.length > 15) {
    phraseHtml = `<div class="phrase-en long-phrase">${phrase}</div>`;
  }

  const replacements = [
    ['{{DATE}}', date],
    ['{{PHRASE_EN}}', phraseHtml],
    ['{{PHRASE_PRON}}', data.phrase_pron || ''],
    ['{{MEANING_CN}}', data.meaning_cn || ''],
    ['{{TRAP_X}}', data.trap_x || ''],
    ['{{TRAP_CHECK}}', data.trap_check || ''],
    ['{{EX1_SOURCE}}', nl2br(data.examples?.[0]?.source || data.ex1_source || '')],
    ['{{EX1_EN}}', nl2br(data.examples?.[0]?.en || data.ex1_en || '')],
    ['{{EX1_CN}}', nl2br(data.examples?.[0]?.cn || data.ex1_cn || '')],
    ['{{EX2_SOURCE}}', nl2br(data.examples?.[1]?.source || data.ex2_source || '')],
    ['{{EX2_EN}}', nl2br(data.examples?.[1]?.en || data.ex2_en || '')],
    ['{{EX2_CN}}', nl2br(data.examples?.[1]?.cn || data.ex2_cn || '')],
    ['{{EX3_SOURCE}}', nl2br(data.examples?.[2]?.source || data.ex3_source || '')],
    ['{{EX3_EN}}', nl2br(data.examples?.[2]?.en || data.ex3_en || '')],
    ['{{EX3_CN}}', nl2br(data.examples?.[2]?.cn || data.ex3_cn || '')],
  ];

  for (const [placeholder, value] of replacements) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    template = template.replace(new RegExp(escaped, 'g'), value);
  }

  fs.writeFileSync(outputPath, template, 'utf8');
  console.log('HTML saved:', outputPath);
});
