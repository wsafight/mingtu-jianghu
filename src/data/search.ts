import { getCollection, render } from 'astro:content';
import { chapters } from './book';

export interface SearchEntry {
  title: string;
  description: string;
  href: string;
  group: string;
  text: string;
  chapter: string;
  depth: number;
}

const plain = (text: string) => text
  .replace(/<[^>]*>/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[#*`>|\[\]]/g, '')
  .replace(/\s+/g, ' ').trim();

export async function getSearchIndex(): Promise<SearchEntry[]> {
  const entries = await getCollection('chapters');
  const groups = await Promise.all(chapters.map(async (chapter) => {
    const entry = entries.find((item) => item.id === chapter.id);
    const body = entry?.body ?? '';
    const href = `/guide/${chapter.id}/`;
    const items: SearchEntry[] = [{
      title: chapter.title, description: chapter.description, href,
      group: chapter.group, text: plain(body), chapter: chapter.id, depth: 0,
    }];
    if (!entry) return items;
    // Use Astro's own slugs, including headings inside disclosure blocks.
    const { headings } = await render(entry);
    const sections = [...body.matchAll(/^(#{2,3})\s+(.+)$/gm)];
    const rendered = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
    sections.forEach((section, i) => {
      const heading = rendered[i];
      if (!heading) return;
      const depth = section[1].length;
      const next = sections.slice(i + 1).find((item) => item[1].length <= depth);
      items.push({
        title: heading.text, description: chapter.title, group: `${chapter.title} · ${chapter.group}`,
        href: `${href}#${heading.slug}`, text: plain(body.slice(section.index, next?.index ?? body.length)),
        chapter: chapter.id, depth,
      });
    });
    return items;
  }));
  return [...groups.flat(), {
    title: '小师妹 roll 推算', description: '计算师门好感扣分、最低骰点与能否过关。',
    href: '/tools/roll/', group: '案头工具',
    text: '唐默铃 小师妹 大师兄 好感 冲突 50 骰子 命运 判定 割舍心 小师妹是我的',
    chapter: 'roll', depth: 0,
  }];
}
