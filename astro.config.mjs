import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

// GitHub Pages 部署时由 workflow 传入 /mingtu-jianghu，本地开发仍使用站点根目录。
const base = process.env.BASE_PATH ?? '/';
const basePath = base.endsWith('/') ? base : `${base}/`;

// 正文里的 Markdown 链接写成站点根路径；部署到子路径时统一补上前缀。
const baseLinks = () => ({
  name: 'base-links',
  element: {
    filter: ['a', 'img'],
    visit(node, ctx) {
      const attribute = node.tagName === 'a' ? 'href' : 'src';
      const value = node.properties?.[attribute];
      if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
        ctx.setProperty(node, attribute, `${basePath}${value.slice(1)}`);
      }
    },
  },
});

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://wsafight.github.io',
  base,
  trailingSlash: 'always',
  output: 'static',
  markdown: {
    processor: satteri({ hastPlugins: [baseLinks] }),
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
