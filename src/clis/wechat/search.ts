import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const searchCommand = cli({
  site: 'wechat',
  name: 'search',
  description: 'Open WeChat search and type a query (find contacts or messages)',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [{ name: 'query', required: true, positional: true, help: 'Search query (contact name or keyword)' }],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (process.platform !== 'darwin') {
      return [{ Status: 'Not supported on Linux — this command requires the macOS desktop app.' }];
    }
    const query = kwargs.query as string;
    try {
      // Activate WeChat
      execSync("osascript -e 'tell application \"WeChat\" to activate'");
      execSync("osascript -e 'delay 0.3'");

      // Cmd+F to open search (WeChat Mac uses Cmd+F for search)
      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'keystroke \"f\" using command down' " +
        "-e 'delay 0.5' " +
        `-e 'keystroke ${JSON.stringify(query)}' ` +
        "-e 'end tell'"
      );

      return [{ Status: `Searching for: ${query}` }];
    } catch (err: any) {
      return [{ Status: 'Error: ' + err.message }];
    }
  },
});
