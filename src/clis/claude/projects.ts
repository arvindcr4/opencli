import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const projectsCommand = cli({
  site: 'claude',
  name: 'projects',
  description: 'List Claude.ai projects; optionally open one by index',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'index', required: false, positional: true, help: 'Project index to open (1-based)' },
  ],
  columns: ['#', 'Name', 'Active'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    // Navigate to projects page
    await page.goto('https://claude.ai/projects');
    await page.wait(2);

    const raw = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll('a[href*="/project/"]'));
        const seen = new Set();
        const projects = [];
        for (const el of links) {
          const href = el.getAttribute('href') || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);
          const name = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80);
          const active = el.getAttribute('aria-current') === 'page' || window.location.href.includes(href);
          projects.push({ index: projects.length + 1, name, href, active });
        }
        return JSON.stringify(projects);
      })()
    `);

    let projects: Array<{ index: number; name: string; href: string; active: boolean }> = [];
    try { projects = JSON.parse(raw); } catch { /* ignore */ }

    if (!projects.length) return [{ '#': '-', Name: 'No projects found', Active: '' }];

    const idx = kwargs.index ? parseInt(kwargs.index as string, 10) : null;
    if (idx !== null) {
      const proj = projects[idx - 1];
      if (!proj) throw new Error(`Project ${idx} not found`);
      const url = proj.href.startsWith('http') ? proj.href : `https://claude.ai${proj.href}`;
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
