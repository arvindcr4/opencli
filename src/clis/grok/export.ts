import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const exportCommand = cli({
  site: 'grok',
  name: 'export',
  description: 'Export the current Grok conversation to a local file (markdown or JSON)',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'output', required: false, positional: true, help: 'Output file path (default: ./grok-export.md)' },
    {
      name: 'format',
      required: false,
      help: 'Output format: md | json (default: md)',
      choices: ['md', 'json'],
      default: 'md',
    },
  ],
  columns: ['File', 'Messages', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const format = (kwargs.format as string) || 'md';
    const defaultName = `grok-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    const outputPath = path.resolve((kwargs.output as string) || defaultName);

    const raw = await page.evaluate(`
      (function() {
        const messages = [];
        const allEls = Array.from(document.querySelectorAll(
          '[data-testid="user-message"], [data-testid="message-bubble"], .user-message, .message-bubble'
        ));
        for (const el of allEls) {
          const isUser = el.dataset?.testid === 'user-message' || el.classList.contains('user-message');
          const role = isUser ? 'user' : 'assistant';
          const text = (el.innerText || el.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
          if (text) messages.push({ role, text });
        }
        return JSON.stringify(messages);
      })()
    `);

    let messages: Array<{ role: string; text: string }> = [];
    try { messages = JSON.parse(raw); } catch { /* ignore */ }

    if (!messages.length) return [{ File: outputPath, Messages: '0', Status: 'No messages found' }];

    const titleEl = await page.evaluate(`document.title`);
    const title = ((titleEl as string) || 'Grok Conversation').replace(' - Grok', '').trim();

    let content: string;
    if (format === 'json') {
      content = JSON.stringify({ title, exportedAt: new Date().toISOString(), messages }, null, 2);
    } else {
      const lines = [`# ${title}`, ``, `*Exported ${new Date().toISOString()}*`, ``];
      for (const m of messages) {
        const heading = m.role === 'user' ? '**You**' : '**Grok**';
        lines.push(`${heading}:`, ``, m.text, ``);
      }
      content = lines.join('\n');
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');
    return [{ File: outputPath, Messages: String(messages.length), Status: 'Exported' }];
  },
});
