import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const artifactsCommand = cli({
  site: 'claude',
  name: 'artifacts',
  description: 'View or export Claude artifacts (code, documents, etc.) from the current conversation',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'output', required: false, positional: true, help: 'Output file path to save artifacts (optional)' },
    { name: 'index', required: false, help: 'Artifact index to show (default: last)', default: '-1' },
  ],
  columns: ['Type', 'Title', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const outputPath = kwargs.output as string | undefined;
    const index = parseInt(kwargs.index as string, 10);

    const artifacts = await page.evaluate(`
      (function() {
        const results = [];
        // Claude artifacts are in iframes or special containers
        const artifactEls = Array.from(document.querySelectorAll(
          '[data-testid*="artifact"], [class*="artifact"], iframe[title], [class*="Artifact"]'
        ));
        for (const el of artifactEls) {
          const title = el.getAttribute('title') || el.getAttribute('data-title') || 
                       el.querySelector('[class*="title"], h1, h2, h3')?.textContent || 'Artifact';
          const type = el.tagName.toLowerCase() === 'iframe' ? 'html' : 
                      (el.getAttribute('data-type') || 'text');
          const content = (el.innerText || el.textContent || '').trim().slice(0, 3000);
          results.push({ type, title: title.trim().slice(0, 60), content });
        }
        // Also check code blocks marked as artifacts
        const codeArtifacts = Array.from(document.querySelectorAll('pre[class*="artifact"], [data-artifact] pre'));
        for (const el of codeArtifacts) {
          const lang = el.className.match(/language-(\w+)/)?.[1] || 'code';
          results.push({ type: lang, title: 'Code block', content: (el.textContent || '').trim().slice(0, 3000) });
        }
        return JSON.stringify(results);
      })()
    `);

    let artifactList: Array<{ type: string; title: string; content: string }> = [];
    try { artifactList = JSON.parse(artifacts as string); } catch { /* ignore */ }

    if (!artifactList.length) return [{ Type: 'none', Title: 'No artifacts found', Content: '' }];

    const target = index === -1 ? artifactList[artifactList.length - 1] : artifactList[index] || artifactList[0];

    if (outputPath) {
      const resolvedPath = path.resolve(outputPath);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, target.content, 'utf-8');
      return [{ Type: target.type, Title: target.title, Content: `Saved to ${resolvedPath}` }];
    }

    return [{ Type: target.type, Title: target.title, Content: target.content.slice(0, 500) }];
  },
});
