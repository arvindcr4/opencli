import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const projectsCommand = cli({
  site: 'chatgpt',
  name: 'projects',
  description: 'List ChatGPT projects from sidebar; optionally open one by index',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'index', required: false, positional: true, help: 'Project index to open (1-based)' },
  ],
  columns: ['#', 'Name', 'Active'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const raw = await page.evaluate(`
      (function() {
        // Projects appear as sidebar links — they typically use /g/ or /project/ paths
        const links = Array.from(document.querySelectorAll(
          'a[href*="/g/"], a[href*="/project/"], nav a[href*="/gpts/"], [data-testid*="project"] a'
        ));
        const seen = new Set();
        const projects = [];
        for (const el of links) {
          const href = el.getAttribute('href') || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);
          const name = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80);
          const active = el.getAttribute('aria-current') === 'page' || window.location.pathname === href;
          projects.push({ index: projects.length + 1, name, href, active });
        }
        return JSON.stringify(projects);
      })()
    `);

    let projects: Array<{ index: number; name: string; href: string; active: boolean }> = [];
    try { projects = JSON.parse(raw); } catch { /* ignore */ }

    if (!projects.length) {
      return [{ '#': '-', Name: 'No projects found (create one at chatgpt.com)', Active: '' }];
    }

    const idx = kwargs.index ? parseInt(kwargs.index as string, 10) : null;
    if (idx !== null) {
      const proj = projects[idx - 1];
      if (!proj) throw new Error(`Project ${idx} not found (only ${projects.length} available)`);
      const url = proj.href.startsWith('http') ? proj.href : `https://chatgpt.com${proj.href}`;
      await page.goto(url);
      await page.wait(2);
      return [{ '#': idx, Name: proj.name, Active: 'opened' }];
    }

    return projects.map(p => ({
      '#': p.index,
      Name: p.name || '(unnamed)',
      Active: p.active ? '✓' : '',
    }));
  },
});
