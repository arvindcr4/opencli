import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sourcesCommand = cli({
  site: 'chatgpt',
  name: 'sources',
  description: 'Extract sources and citations from the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Title', 'URL'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const sources = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll(
          '[data-message-author-role="assistant"] a[href], [class*="citation"] a, [class*="source"] a, .footnote a'
        ));
        const results = links
          .filter(a => a.href && !a.href.includes('chatgpt.com') && !a.href.includes('openai.com') && a.href.startsWith('http'))
          .map(a => ({ title: (a.textContent || a.title || '').trim().slice(0, 80) || a.href, url: a.href }));
        const seen = new Set();
        return JSON.stringify(results.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; }));
      })()
    `);

    let sourceList: Array<{ title: string; url: string }> = [];
    try { sourceList = JSON.parse(sources as string); } catch { /* ignore */ }
    if (!sourceList.length) return [{ Title: 'No sources found (try after web search or deep research)', URL: '' }];
    return sourceList.map(s => ({ Title: s.title, URL: s.url }));
  },
});
