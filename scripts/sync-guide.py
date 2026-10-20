"""Build Markdown editions from the same chapter sources used by Astro."""
from pathlib import Path
import json
import re
import subprocess
from urllib.parse import unquote, urlsplit

SITE = Path(__file__).resolve().parents[1]
CHAPTERS = SITE / 'src/content/chapters'
DOWNLOADS = SITE / 'public/downloads'
FULL_NAME = '活侠传关键节点选择攻略.md'
def chapter_number(value):
    digits = '零一二三四五六七八九'
    if value < 10:
        return digits[value]
    return (digits[value // 10] if value >= 20 else '') + '十' + (digits[value % 10] if value % 10 else '')


def body(path):
    text = path.read_text()
    assert text.startswith('---\n'), path
    return text.split('---\n', 2)[2].strip()


def offline_links(text, output, *, single=False):
    """Keep cross-chapter and reference links usable in downloaded Markdown."""
    def link(match):
        target = match.group(1)
        if target.startswith('/guide/'):
            parsed = urlsplit(target)
            chapter = parsed.path.strip('/').split('/')[1]
            fragment = unquote(parsed.fragment)
            anchor = chapter + (f'--{fragment}' if fragment else '')
            return '](' + (f'./{FULL_NAME}' if single else '') + '#' + anchor + ')'
        if target.startswith('/tools/'):
            return '](http://127.0.0.1:4321' + target + ')'
        if target.startswith('/reference/'):
            prefix = '../reference/' if output.parent == DOWNLOADS else 'mingtu-jianghu/public/reference/'
            return '](' + prefix + target.removeprefix('/reference/') + ')'
        if target.startswith('/downloads/'):
            prefix = './' if output.parent == DOWNLOADS else 'mingtu-jianghu/public/downloads/'
            return '](' + prefix + target.removeprefix('/downloads/') + ')'
        raise ValueError(f'Unmapped site link: {target}')
    return re.sub(r'\]\((/[^)]+)\)', link, text)


def add_heading_anchors(text, key, headings):
    """Use chapter namespaces without duplicating readers' automatic heading IDs."""
    matches = list(re.finditer(r'^(#{2,5})\s+(.+)$', text, flags=re.M))
    headings = [heading for heading in headings if 2 <= heading['depth'] <= 5]
    assert len(matches) == len(headings), f'Heading renderer mismatch: {key}'
    aliases = set(re.findall(r'<a id="([^"]+)"></a>', text))
    slugs = {heading['slug'] for heading in headings} | aliases
    def local_link(match):
        slug = unquote(match[1])
        assert slug in slugs, f'Unknown local heading in {key}: {slug}'
        return f'](#{key}--{slug})'
    text = re.sub(r'\]\(#([^)]+)\)', local_link, text)
    # Keep old section bookmarks usable in both the website and offline editions.
    text = re.sub(r'<a id="([^"]+)"></a>', lambda match: f'<a id="{key}--{match[1]}"></a>', text)
    # Recalculate offsets after rewriting any local links.
    matches = list(re.finditer(r'^(#{2,5})\s+(.+)$', text, flags=re.M))
    for match, heading in reversed(list(zip(matches, headings))):
        anchor = f"{key}--{heading['slug']}"
        text = text[:match.start()] + f'<a id="{anchor}"></a>\n\n' + text[match.start():]
    return text


def main():
    timeline = json.loads((SITE / 'src/data/timeline.json').read_text())
    lines = ['---', 'title: "江湖年表"', 'description: "按时间查找关键事件与独立留档节点。"', '---', '',
             '使用不同存档位保留以下节点，不要始终覆盖同一个存档。', '',
             '| 时间／事件 | 留档目的 | 当时要检查什么 |', '| --- | --- | --- |']
    lines.extend(f"| {item['time']} | {item['purpose']} | {item['check']} |" for item in timeline)
    lines.extend(['', '日期表示对应事件的检查窗口。人物离场、前置缺失或进入其他支路时，同一天也不一定出现事件。回家等动态安排事件以答应时约好的日期为准。', ''])
    (CHAPTERS / 'timeline.md').write_text('\n'.join(lines))

    book = (SITE / 'src/data/book.ts').read_text()
    entries = re.findall(r"id: '([^']+)', title: '([^']+)'", book)
    assert len(entries) < 100, 'Extend Chinese chapter numbering for 100 or more chapters.'
    version = re.search(r"version: '([^']+)'", book)[1]
    updated = re.search(r"updated: '([^']+)'", book)[1]
    chapter_bodies = {key: body(CHAPTERS / f'{key}.md') for key, _ in entries}
    heading_map = json.loads(subprocess.run(
        ['node', str(SITE / 'scripts/heading-map.mjs')], input=json.dumps(chapter_bodies),
        text=True, capture_output=True, check=True, cwd=SITE).stdout)
    header = (f'# 《命途江湖》——活侠传关键节点选择攻略\n\n'
              f'更新日期：**{updated}**  \n适用版本：本机 Steam 版 **{version}**  \n'
              '内容：六条感情线、公共分流、主线决策、养成装备与成就继承。含必要剧透。\n\n'
              '按「提前准备 → 具体选择 → 成功标志 → 漏项排查」查阅。'
              '本书提供已核对的推荐走法，未穷尽全部替代入口与战斗变体；人物在场、数值和实际事件记录仍要逐项确认。\n\n'
              '离线阅读：正文可直接查阅；核对资料需保留链接所指的 reference 目录，roll 工具需运行本地网站。\n\n')
    contents = '\n'.join(f'- [{chapter_number(i + 1)}、{title}](#{key})' for i, (key, title) in enumerate(entries))
    sections = []
    for i, (key, title) in enumerate(entries):
        chapter = add_heading_anchors(chapter_bodies[key], key, heading_map[key])
        chapter = re.sub(r'^(#{2,5}) ', r'\1# ', chapter, flags=re.M)
        sections.append(f'<a id="{key}"></a>\n\n## {chapter_number(i + 1)}、{title}\n\n{chapter}')
    complete = header + contents + '\n\n---\n\n' + '\n\n---\n\n'.join(sections) + '\n'
    for output in [SITE.parent / FULL_NAME, DOWNLOADS / FULL_NAME]:
        output.write_text(offline_links(complete, output))
    chapter_downloads = json.loads((SITE / 'src/data/downloads.json').read_text())
    for key, filename in chapter_downloads.items():
        output = DOWNLOADS / filename
        title = filename.removesuffix('.md')
        note = ('> 离线查阅：跨章链接指向《活侠传关键节点选择攻略.md》，请将完整版与本文件放在同一目录。'
                '核对资料需保留对应 reference 目录；roll 工具需运行本地网站，公式也可查完整版的小师妹篇。\n\n')
        chapter = add_heading_anchors(chapter_bodies[key], key, heading_map[key])
        output.write_text(offline_links(f'# {title}\n\n' + note + chapter + '\n', output, single=True))
    print(f'Synchronized {len(entries)} chapters, {len(timeline)} timeline nodes, original and {len(chapter_downloads) + 1} downloads.')


if __name__ == '__main__':
    main()
