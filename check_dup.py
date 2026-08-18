#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
encard 去重预检。候选短语 vs 全部已做卡（data/*.json + issues/*.html + data/_done.txt）。
归一化：剥句末标点 + 忽略大小写 + 去首尾空白。

用法：
  python3 check_dup.py "candidate phrase"
  echo "候选短语" | python3 check_dup.py      # 从 stdin 读

输出：<短语> : <N>字符 OK / DONE-淘汰
"""
import json
import os
import re
import sys


def norm(s):
    return re.sub(r'[.!?]+$', '', s.strip()).lower()


def all_done():
    """三处权威/历史来源，去重合并。"""
    out = set()
    base = os.path.dirname(os.path.abspath(__file__))

    # 1) data/*.json —— 卡面数据源（phrase_en 字段）
    for f in sorted(glob_join(base, 'data/*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        items = d if isinstance(d, list) else [d]
        for it in items:
            if isinstance(it, dict) and it.get('phrase_en'):
                out.add(norm(it['phrase_en']))

    # 2) issues/*-small-talk.html —— 孤儿卡兜底（无 JSON 也查得到）
    for f in sorted(glob_join(base, 'issues/*-small-talk.html')):
        try:
            h = open(f, encoding='utf-8').read()
        except Exception:
            continue
        m = re.search(r'class="phrase-en(?: [a-z-]+)?"\s*>(.*?)</div>', h, re.S)
        if m:
            out.add(norm(re.sub(r'<[^>]+>', '', m.group(1))))

    # 3) data/_done.txt —— 历史手动清单，兜底
    p = os.path.join(base, 'data/_done.txt')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line:
                out.add(norm(line))

    return out


def glob_join(base, pattern):
    import glob
    return glob.glob(os.path.join(base, pattern))


def main():
    cand = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
    if not cand:
        return 1
    key = norm(cand)
    done = all_done()
    dup = key in done
    c = len(cand.strip())
    print(f'{cand} : {c}字符 ' + ('OK' if not dup else 'DONE-淘汰'))
    return 1 if dup else 0


if __name__ == '__main__':
    sys.exit(main())
