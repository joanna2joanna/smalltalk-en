---
name: encard
description: 生成一张英文口语卡片（小红书版）。先选题确认，再写JSON，最后生成PNG。
---

项目路径：`/Users/joanna/Projects/smalltalk-en`

## 流程

### 1. 选题

每次列出 2 个候选，说明字面 vs 真正意思 + 出处，等用户确认。

**硬杠（缺一不可）：**

| 硬杠 | 说明 |
|------|------|
| **≤ 17 字符** | `"Eat your heart out!".length` = 19 ❌，当场数当场淘汰 |
| **不重复** | 两条命令：`grep -ohP '<div class="phrase-en">\K[^<]+' /Volumes/JOANNAZ/workbuddy/workspace-root/projects/smalltalk/.workbuddy/cards/*-small-talk.html \| sort -u` + `grep -ohP '"phrase_en": "\K[^"]+' data/*.json \| sort -u` |
| **trap 够明显** | 字面越荒谬越好，反差要大。用户说"不够明显"直接换，不争辩 |
| **现在还在说** | 搜索确认 2025-2026 年主流媒体/社交平台还有日常使用记录。淘汰信号：只在怀旧文章出现、听起来像 90 年代电影台词、像高中课本里的、类比中文"蓝瘦香菇"那种过时感 |
| **出处可查** | 优先影视剧/播客/名人采访中的真实对话，互联网原生短语也可以用 WSJ/BBC/名人引述等权威出处。禁止自己编对话 |

**选题搜索策略（先列排除条件再搜）：**
1. 搜索前先想：这短语是不是"蓝瘦香菇"级别过时了？是就跳过
2. 每轮搜 3 个候选方向并行，不串行碰运气
3. 两个硬信号同时命中才算通过：媒体 2025-2026 年在用 + 有真实可查出处

### 2. 写 JSON

确认后写 `data/YYYY-MM-DDa.json` + `data/YYYY-MM-DDb.json`。

**examples 铁律：**
- 每条 example 的 `source` 必须有搜索验证过的真实出处。搜不到明确出处就不能写那个片名/来源，换一个能搜到的
- 保留对话格式（两句引号），超限缩前半句不砍后半句
- 字数由 `check-chars.js` 自动挡

**两张时全流程并行**：确认后所有步骤——JSON 写入、check-chars、超限修复、gen-html、gen-png、check-layout——两张同时推进，不分先后。

**trap_x / trap_check 不要塞到接近 40 字上限**：字数过不代表不会溢出卡片。check-layout 只检查重叠不检查文字截断。PNG 出现 `⋯` 省略号就是太长，缩短原文解决，不要等用户指出。

### 3. 生成

每张卡五步串行（check-chars → gen-html → gen-png → check-layout，不过不往下），两张之间并行。

```bash
cd /Users/joanna/Projects/smalltalk-en

# 每张卡分别跑：
node check-chars.js YYYY-MM-DDa
NODE_PATH=/Users/joanna/.workbuddy/binaries/node/workspace/node_modules node gen-html.js YYYY-MM-DDa < data/YYYY-MM-DDa.json
NODE_PATH=/Users/joanna/.workbuddy/binaries/node/workspace/node_modules node gen-png.js YYYY-MM-DDa
NODE_PATH=/Users/joanna/.workbuddy/binaries/node/workspace/node_modules node check-layout.js YYYY-MM-DDa
```

最后打开文件夹检查两张 PNG：
```bash
open /Users/joanna/Projects/smalltalk-en/issues/
```

检查有无 `⋯` 省略号截断。**严禁手写 HTML 或改 CSS。**

## 版式

配色暗底暖金（`#1A1A2E` + `#F0A500`），1080×1440px。短语 >15 字符 → 105px，>22 → 90px。5 级字号：120 / 48 / 34 / 28 / 20。
