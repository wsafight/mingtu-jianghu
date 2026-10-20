// 站点可能部署在子路径（GitHub Pages 项目页），统一给站内绝对路径补前缀。
const base = import.meta.env.BASE_URL;

export const withBase = (path: string) => path.startsWith('/') && !path.startsWith('//')
  ? `${base}${path.slice(1)}`
  : path;
