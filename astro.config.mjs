import { defineConfig } from 'astro/config';

export default defineConfig({
  trailingSlash: 'always',
  output: 'static',
  markdown: { shikiConfig: { theme: 'github-light', wrap: true } },
});
