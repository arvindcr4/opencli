import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sourcesCommand = cli({
  site: 'grok',
  name: 'sources',
  description: 'Extract sources and citations from the current Grok DeepSearch response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Title', 'URL'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const sources = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll(
          '[class*="citation"] a, [class*="source"] a, [class*="reference"] a, a[data-source], .source-link a'
        ));
        const results = links
          .filter(a => a.href && !a.href.includes('grok.com') && a.href.startsWith('http'))
          .map(a => ({ title: (a.textContent || a.title || a.href).trim().slice(0, 80), url: a.href }));

        // Deduplicate by URL
        const seen = new Set();
        return JSON.stringify(results.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; }));
      })()
    `);

    let sourceList: Array<{ title: string; url: string }> = [];
    try { sourceList = JSON.parse(sources as string); } catch { /* ignore */ }
    if (!sourceList.length) return [{ Title: 'No sources found', URL: '' }];
    return sourceList.map(s => ({ Title: s.title, URL: s.url }));
  },
});
