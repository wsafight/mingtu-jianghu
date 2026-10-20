// Match the website's Markdown renderer instead of guessing Chinese heading slugs.
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const chapters = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const renderer = await createSatteriMarkdownProcessor({ syntaxHighlight: false });
const result = {};
for (const [id, body] of Object.entries(chapters)) {
  result[id] = (await renderer.render(body)).metadata.headings;
}
process.stdout.write(JSON.stringify(result));
