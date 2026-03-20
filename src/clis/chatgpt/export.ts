import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const exportCommand = cli({
  site: 'chatgpt',
  name: 'export',
  description: 'Export the current ChatGPT conversation to a local file (markdown or JSON)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'output', required: false, positional: true, help: 'Output file path (default: ./chatgpt-export.md)' },
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
    const defaultName = `chatgpt-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    const outputPath = path.resolve((kwargs.output as string) || defaultName);

    const raw = await page.evaluate(`
      (function() {
        const turns = Array.from(document.querySelectorAll('[data-message-author-role]'));
        const messages = turns.map((el, i) => {
          const role = el.getAttribute('data-message-author-role') || 'unknown';
          const text = (el.innerText || el.textContent || '')
            .replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '')
            .trim();
          return { index: i + 1, role, text };
        });
        // Get page title as conversation name
        const titleEl = document.querySelector('title');
        const title = (titleEl?.textContent || 'ChatGPT Conversation').replace(' - ChatGPT', '').trim();
        return JSON.stringify({ title, messages });
      })()
    `);

    let data: { title: string; messages: Array<{ index: number; role: string; text: string }> };
    try { data = JSON.parse(raw as string); }
    catch { return [{ File: outputPath, Messages: '0', Status: 'Failed to extract messages' }]; }

    const { title, messages } = data;
    if (!messages.length) return [{ File: outputPath, Messages: '0', Status: 'No messages found' }];

    let content: string;
    if (format === 'json') {
      content = JSON.stringify({ title, exportedAt: new Date().toISOString(), messages }, null, 2);
    } else {
      const lines = [`# ${title}`, ``, `*Exported ${new Date().toISOString()}*`, ``];
      for (const m of messages) {
        const heading = m.role === 'user' ? '**You**' : m.role === 'assistant' ? '**ChatGPT**' : `**${m.role}**`;
        lines.push(`${heading}:`, ``, m.text, ``);
      }
      content = lines.join('\n');
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');

    return [{ File: outputPath, Messages: String(messages.length), Status: 'Exported' }];
  },
});
