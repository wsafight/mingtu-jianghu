const storage = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Reading still works without storage. */ } },
};

const themeButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
const updateThemeLabel = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton?.setAttribute('aria-label', dark ? '切换日间阅读' : '切换夜读模式');
  themeButton?.setAttribute('aria-pressed', String(dark));
};
updateThemeLabel();
themeButton?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  storage.set('mingtu-theme', next);
  updateThemeLabel();
});

const menu = document.querySelector<HTMLButtonElement>('#menu-toggle');
const closeNavigation = () => {
  delete document.body.dataset.navOpen;
  menu?.setAttribute('aria-expanded', 'false');
};
menu?.addEventListener('click', () => {
  const open = document.body.dataset.navOpen !== 'true';
  document.body.dataset.navOpen = String(open);
  menu.setAttribute('aria-expanded', String(open));
});
document.querySelector('.nav-backdrop')?.addEventListener('click', closeNavigation);
document.querySelectorAll('.sidebar a').forEach((link) => link.addEventListener('click', closeNavigation));

import type { SearchEntry } from '../data/search';
const index: SearchEntry[] = JSON.parse(document.querySelector('#search-index')?.textContent ?? '[]');
const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
const searchInput = document.querySelector<HTMLInputElement>('#search-input');
const results = document.querySelector<HTMLDivElement>('#search-results');
const renderSearch = () => {
  if (!results || !searchInput) return;
  const query = searchInput.value.trim().toLowerCase().slice(0, 120);
  const terms = query.split(/\s+/).filter(Boolean);
  let matches = index.filter((entry) => query || entry.depth === 0).map((entry) => {
    const all = `${entry.title} ${entry.description} ${entry.text}`.toLowerCase();
    const score = terms.every((term) => all.includes(term))
      ? terms.reduce((total, term) => total + (entry.title.toLowerCase().includes(term) ? 100 : 0) + (entry.description.toLowerCase().includes(term) ? 20 : 0) + 1, entry.depth * 3)
      : -1;
    return { entry, score };
  }).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score);
  if (query) {
    const sectionChapters = new Set(matches.filter(({ entry }) => entry.depth > 0).map(({ entry }) => entry.chapter));
    matches = matches.filter(({ entry }) => entry.depth > 0 || !sectionChapters.has(entry.chapter));
  }
  results.replaceChildren();
  const label = document.createElement('p');
  label.className = 'search-result-label';
  label.textContent = query ? `找到 ${matches.length} 处相关内容${matches.length > 13 ? '，显示最相关的 13 处' : ''}` : '从这里开始翻阅';
  results.append(label);
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = '没有找到相关内容。试试人物名字、选项中的几个字，或「好感」「命运」。';
    results.append(empty);
    return;
  }
  matches.slice(0, query ? 13 : 7).forEach(({ entry }) => {
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = entry.href;
    link.addEventListener('click', (event) => {
      const target = new URL(link.href);
      dialog?.close();
      if (target.pathname === location.pathname && target.hash) {
        event.preventDefault();
        if (location.hash !== target.hash) location.hash = target.hash;
        revealHashTarget(true);
      }
    });
    const group = document.createElement('span');
    group.className = 'search-result-group';
    group.textContent = entry.group;
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const excerpt = document.createElement('p');
    const position = query ? entry.text.toLowerCase().indexOf(terms[0]) : -1;
    excerpt.textContent = position >= 0
      ? `${position > 25 ? '…' : ''}${entry.text.slice(Math.max(0, position - 25), position + 100)}…`
      : entry.description;
    link.append(group, title, excerpt);
    results.append(link);
  });
};
const openSearch = () => {
  if (!dialog || !searchInput) return;
  closeNavigation();
  if (!dialog.open) dialog.showModal();
  renderSearch();
  searchInput.focus();
};
document.querySelectorAll('[data-open-search]').forEach((trigger) => trigger.addEventListener('click', openSearch));
document.querySelector('#search-close')?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
searchInput?.addEventListener('input', renderSearch);
dialog?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const links = Array.from(results?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
  if (next < 0) searchInput?.focus();
  else links[Math.min(next, links.length - 1)]?.focus();
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (dialog?.open) dialog.close(); else openSearch();
  }
  if (event.key === 'Escape') {
    dialog?.close();
    closeNavigation();
  }
});

const article = document.querySelector<HTMLElement>('[data-chapter-id]');
if (article) {
  storage.set('mingtu-reading', JSON.stringify({ id: article.dataset.chapterId, title: article.dataset.chapterTitle }));
}
const resume = document.querySelector<HTMLAnchorElement>('#continue-reading');
if (resume) {
  try {
    const saved = JSON.parse(storage.get('mingtu-reading') ?? 'null');
    if (saved && index.some((entry) => entry.href === `/guide/${saved.id}/`)) {
      resume.href = `/guide/${saved.id}/`;
      const label = document.createElement('span');
      label.textContent = `续读 · ${saved.title}`;
      resume.prepend(label);
      for (const node of Array.from(resume.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      }
    }
  } catch { /* Ignore an old or incomplete reading marker. */ }
}

const bookmark = document.querySelector<HTMLButtonElement>('#bookmark-button');
const updateBookmarks = () => {
  if (bookmark) {
    const saved = storage.get(`mingtu-bookmark:${bookmark.dataset.id}`) === 'true';
    bookmark.setAttribute('aria-pressed', String(saved));
    const label = bookmark.querySelector('span');
    if (label) label.textContent = saved ? '已收藏此卷' : '收藏此卷';
  }
  let count = 0;
  document.querySelectorAll<HTMLElement>('[data-bookmark-item]').forEach((item) => {
    const saved = storage.get(`mingtu-bookmark:${item.dataset.bookmarkItem}`) === 'true';
    item.hidden = !saved;
    if (saved) count++;
  });
  const label = document.querySelector('#bookmark-count');
  if (label) label.textContent = `已收藏 ${count} 卷`;
  const empty = document.querySelector<HTMLElement>('#bookmark-empty');
  if (empty) empty.hidden = count > 0;
};
updateBookmarks();
if (bookmark) {
  bookmark.addEventListener('click', () => {
    const key = `mingtu-bookmark:${bookmark.dataset.id}`;
    storage.set(key, String(storage.get(key) !== 'true'));
    updateBookmarks();
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-remove-bookmark]').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.closest<HTMLElement>('[data-bookmark-item]');
    const next = item?.nextElementSibling;
    storage.set(`mingtu-bookmark:${button.dataset.removeBookmark}`, 'false');
    updateBookmarks();
    const visibleNext = next instanceof HTMLElement && !next.hidden ? next.querySelector<HTMLAnchorElement>('a') : null;
    (visibleNext ?? document.querySelector<HTMLAnchorElement>('[data-bookmark-item]:not([hidden]) a') ?? document.querySelector<HTMLElement>('#bookmarks-heading'))?.focus();
  });
});
window.addEventListener('storage', (event) => {
  if (event.key === null || event.key.startsWith('mingtu-bookmark:')) updateBookmarks();
});
window.addEventListener('pageshow', updateBookmarks);

// A search result may live inside a closed spoiler block.
function revealHashTarget(focus = false) {
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start' });
    if (focus) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  });
}
revealHashTarget();
window.addEventListener('hashchange', () => revealHashTarget(true));
const checks = Array.from(document.querySelectorAll<HTMLInputElement>('[data-check-key]'));
const updateChecks = () => {
  const status = document.querySelector('.checklist-status');
  if (status) status.textContent = `${checks.filter((check) => check.checked).length} / ${checks.length} 项已确认`;
};
checks.forEach((check) => {
  const key = `mingtu-check:${check.dataset.checkKey}`;
  check.checked = storage.get(key) === 'true';
  check.addEventListener('change', () => { storage.set(key, String(check.checked)); updateChecks(); });
});
updateChecks();
document.querySelector('[data-reset-checks]')?.addEventListener('click', () => {
  checks.forEach((check) => { check.checked = false; storage.set(`mingtu-check:${check.dataset.checkKey}`, 'false'); });
  updateChecks();
});
const printDisclosureStates = new Map<HTMLDetailsElement, boolean>();
window.addEventListener('beforeprint', () => {
  document.querySelectorAll<HTMLDetailsElement>('.prose details').forEach((detail) => {
    if (!printDisclosureStates.has(detail)) printDisclosureStates.set(detail, detail.open);
    detail.open = true;
  });
});
window.addEventListener('afterprint', () => {
  printDisclosureStates.forEach((open, detail) => { detail.open = open; });
  printDisclosureStates.clear();
});
document.querySelector('#print-page')?.addEventListener('click', () => window.print());

const progress = document.querySelector<HTMLElement>('.reading-progress');
const updateProgress = () => {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${total > 0 ? Math.min(1, window.scrollY / total) : 0})`;
};
window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.page-toc nav a'));
const observer = new IntersectionObserver((entries) => {
  const current = entries.find((entry) => entry.isIntersecting);
  if (!current) return;
  tocLinks.forEach((link) => link.classList.toggle('current', decodeURIComponent(link.hash.slice(1)) === current.target.id));
}, { rootMargin: '-12% 0px -65% 0px' });
document.querySelectorAll('.prose h2').forEach((heading) => observer.observe(heading));

let timelineYear = 'all';
const routeSelect = document.querySelector<HTMLSelectElement>('#timeline-route');
const timelineItems = Array.from(document.querySelectorAll<HTMLElement>('.timeline-item'));
const filterTimeline = () => {
  const route = routeSelect?.value ?? 'all';
  let count = 0;
  timelineItems.forEach((item) => {
    const visible = (timelineYear === 'all' || item.dataset.years?.split(',').includes(timelineYear))
      && (route === 'all' || item.dataset.routes?.split(',').includes(route));
    item.hidden = !visible;
    if (visible) count++;
  });
  const label = document.querySelector('#timeline-count');
  if (label) label.textContent = `共 ${count} 个留档节点`;
  const empty = document.querySelector<HTMLElement>('#timeline-empty');
  if (empty) empty.hidden = count > 0;
};
document.querySelectorAll<HTMLButtonElement>('[data-timeline-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    timelineYear = button.dataset.timelineFilter ?? 'all';
    document.querySelectorAll<HTMLButtonElement>('[data-timeline-filter]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    filterTimeline();
  });
});
routeSelect?.addEventListener('change', filterTimeline);
