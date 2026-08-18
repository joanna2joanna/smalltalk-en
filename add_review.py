#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
smalltalk-en review.html 加卡脚本。
把新卡插进对应「使用场景」章节，章节内从新到旧重排，更新张数与总数。
必要时候开新章节（--new-name + --new-color）。

用法：
  python3 add_review.py <文件名> <英文> <中文释义> <sarcasm|direct|really|attitude|news|drama|daily>
  python3 add_review.py 2026-08-19a-small-talk.html "You nailed it!" "办得漂亮" attitude
  python3 add_review.py 2026-08-19a-small-talk.html "..." "..." new --new-name "🧊 新场景" --new-color "#FF00AA"

说明：
  - 文件名必须与 issues/ 下的实际文件一致
  - 重复文件名自动跳过（幂等）
"""
import re
import sys

PATH = 'review.html'

CATS = {
    'sarcasm': 'var(--c1)', 'direct': 'var(--c2)', 'really': 'var(--c3)',
    'attitude': 'var(--c4)', 'news': 'var(--c5)', 'drama': 'var(--c6)',
    'daily': 'var(--c7)',
}


def sort_key(f):
    """按日期 + 后缀从新到旧排序。"""
    base = f.replace('-small-talk.html', '')
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})(?:(?:-(\d+))|(?:-([a-z]+))|(?:-([a-z]))|([a-z]))?$', base)
    if not m:
        return (0, 0, 0, 0)
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if m.group(4):
        suffix = 100 + int(m.group(4))
    elif m.group(5):
        suffix = 50  # 命名后缀（suanwode/fillmein/suibian）
    elif m.group(6) or m.group(7):
        ch = m.group(6) or m.group(7)
        suffix = ord(ch) - ord('a')
    else:
        suffix = -1
    return (y, mo, d, suffix)


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(1)
    fname, en, cn, cat = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    new_name = None
    new_color = None
    if '--new-name' in sys.argv:
        new_name = sys.argv[sys.argv.index('--new-name') + 1]
    if '--new-color' in sys.argv:
        new_color = sys.argv[sys.argv.index('--new-color') + 1]

    html = open(PATH, encoding='utf-8').read()

    if f'href="issues/{fname}"' in html:
        print(f'{fname} 已在 review 中，跳过（幂等）')
        return

    if cat == 'new':
        if not new_name or not new_color:
            print('新章节需要 --new-name 与 --new-color')
            sys.exit(1)
        html = _add_new_chapter(html, fname, en, cn, new_name, new_color)
    else:
        if cat not in CATS:
            print(f'!! 未知场景 {cat}，可用：{" ".join(CATS)}')
            sys.exit(1)
        html = _insert_into_cat(html, cat, fname, en, cn)

    html = _update_totals(html)
    open(PATH, 'w', encoding='utf-8').write(html)
    print(f'已加入 review.html：{fname}「{en}」→ {cat or "新章节"}')


def _insert_into_cat(html, cat, fname, en, cn):
    block_m = re.search(
        rf'<div class="cat" id="cat-{cat}">(.*?)(?=<div class="cat" id="cat-|\Z)',
        html, re.S)
    if not block_m:
        print(f'!! 找不到章节 cat-{cat}，用 new 开新章节')
        sys.exit(1)
    block = block_m.group(0)
    dot = CATS[cat]
    card = (f'      <a class="card" style="border-left-color:{dot}" '
            f'href="issues/{fname}"><div class="en">{en}</div>'
            f'<div class="cn">{cn}</div></a>')
    grid_m = re.search(r'<div class="grid">\s*\n(.*?)\n    </div>', block, re.S)
    cards = [card] + re.findall(r'<a class="card".*?</a>', grid_m.group(1), re.S)
    cards.sort(key=lambda c: sort_key(re.search(r'href="issues/([^"]+)"', c).group(1)), reverse=True)
    new_grid = '<div class="grid">\n' + '\n'.join(cards) + '\n    </div>'
    block = re.sub(r'<div class="grid">.*?\n    </div>\n  </div>', new_grid + '\n  </div>', block, count=1, flags=re.S)
    # 更新该章节张数（「N 张」）
    m = re.search(r'<span class="count">(\d+) 张', block)
    if m:
        block = block.replace(m.group(0), f'<span class="count">{int(m.group(1)) + 1} 张', 1)
    return html.replace(block_m.group(0), block, 1)


def _add_new_chapter(html, fname, en, cn, new_name, new_color):
    # 找下一个可用颜色变量
    idx = len(re.findall(r'--c\d+:', html.split(':root')[1].split('}')[0])) + 1
    cvar = f'--c{idx}'
    if cvar not in html:
        m = re.search(r'--c\d+:([^;]+);', html)
        if m:
            html = html.replace(m.group(0), m.group(0) + f'\n    {cvar}:{new_color};', 1)
    # 图例加入口
    legend_m = re.search(r'(<div class="legend">.*?)(</div>\s*</div>)', html, re.S)
    if legend_m and f'href="#cat-new-{idx}"' not in html:
        entry = f'    <a href="#cat-new-{idx}"><span class="dot" style="background:var({cvar})"></span>{new_name}</a>'
        html = html.replace(legend_m.group(0), legend_m.group(1) + '\n' + entry + legend_m.group(2), 1)
    # cat 块加在 footer 前
    cat_block = (
        '\n\n  <!-- ' + new_name + ' -->\n'
        f'  <div class="cat" id="cat-new-{idx}">\n'
        f'    <div class="cat-header"><span class="dot" style="background:var({cvar})"></span>'
        f'<h2>{new_name}</h2><span class="count">1 张</span></div>\n'
        '    <div class="grid">\n'
        f'      <a class="card" style="border-left-color:var({cvar})" '
        f'href="issues/{fname}"><div class="en">{en}</div><div class="cn">{cn}</div></a>\n'
        '    </div>\n'
        '  </div>'
    )
    html = html.replace('<div class="footer">', cat_block + '\n\n  <div class="footer">', 1)
    return html


def _update_totals(html):
    n = len(re.findall(r'<a class="card"[^>]*href="issues/[^"]+"', html))
    html = re.sub(r'<title>英文口语卡片 · \d+张分类索引</title>',
                  f'<title>英文口语卡片 · {n}张分类索引</title>', html)
    html = re.sub(r'<p class="sub">\d+ 张 · 按使用场景分类复习</p>',
                  f'<p class="sub">{n} 张 · 按使用场景分类复习</p>', html)
    return html


if __name__ == '__main__':
    main()
