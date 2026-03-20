import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getAllClaudeMessages } from './ax.js';

export const exportCommand = cli({
  site: 'claude',
  name: 'export',
  description: 'Export the current Claude.ai conversation to a local file (markdown or JSON)',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'output', required: false, positional: true, help: 'Output file path (default: ./claude-export.md)' },
    {
      name: 'file_format',
      required: false,
      help: 'Output format: md | json (default: md)',
      choices: ['md', 'json'],
      default: 'md',
    },
  ],
  columns: ['File', 'Messages', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const format = (kwargs.file_format as string) || 'md';
    const defaultName = `claude-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    const outputPath = path.resolve((kwargs.output as string) || defaultName);

    const messages = await getAllClaudeMessages(page);
    if (!messages.length) return [{ File: outputPath, Messages: '0', Status: 'No messages found' }];

    const titleEl = await page.evaluate(`document.title`);
    const title = ((titleEl as string) || 'Claude Conversation').replace(' - Claude', '').trim();

    let content: string;
    if (format === 'json') {
      content = JSON.stringify({ title, exportedAt: new Date().toISOString(), messages }, null, 2);
    } else {
      const lines = [`# ${title}`, ``, `*Exported ${new Date().toISOString()}*`, ``];
      for (const m of messages) {
        const heading = m.role === 'user' ? '**You**' : '**Claude**';
        lines.push(`${heading}:`, ``, m.text, ``);
      }
      content = lines.join('\n');
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');

    return [{ File: outputPath, Messages: String(messages.length), Status: 'Exported' }];
  },
});
