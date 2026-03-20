import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { CDPBridge } from '../../browser/cdp.js';

/**
 * Switch the ChatGPT model/mode via the model selector dropdown.
 * Thin wrapper around the CDP mouse-event approach used in promode.
 */
async function selectModel(bridge: CDPBridge, mode: string): Promise<void> {
  // Normalize common aliases
  const aliases: Record<string, string> = {
    'gpt-4o': 'instant',
    'gpt4o': 'instant',
    '4o': 'instant',
    'o3': 'thinking',
    'o1': 'thinking',
    'pro': 'pro',
    'o3-pro': 'pro',
    'extended': 'pro',
  };
  const normalizedMode = aliases[mode.toLowerCase()] ?? mode.toLowerCase();

  const btnResult = await bridge.send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    })()`,
    returnByValue: true,
  });
  const btnPos = JSON.parse(btnResult?.result?.value || 'null');
  if (!btnPos) throw new Error('Could not find model selector button');

  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnPos.x, y: btnPos.y });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 600));

  const yOffsets: Record<string, number> = { instant: 86, thinking: 137, pro: 188, configure: 240 };
  const itemX = btnPos.x + 55;
  const itemY = btnPos.y + (yOffsets[normalizedMode] ?? 188);

  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: itemX, y: itemY });
  await new Promise(r => setTimeout(r, 100));
  await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: itemX, y: itemY, button: 'left', clickCount: 1 });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: itemX, y: itemY, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 500));
}

export const switchCommand = cli({
  site: 'chatgpt',
  name: 'switch',
  description: 'Switch ChatGPT model (instant/gpt-4o, thinking/o3, pro/o3-pro)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    {
      name: 'model',
      required: true,
      positional: true,
      help: 'Model to switch to: instant | thinking | pro | gpt-4o | o3 | o3-pro',
      choices: ['instant', 'thinking', 'pro', 'gpt-4o', 'o3', 'o3-pro', 'o1', '4o'],
    },
  ],
  columns: ['Model', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const model = kwargs.model as string;

    const cdpBridge = new CDPBridge();
    const _p = await cdpBridge.connect();
    try {
      await selectModel(cdpBridge, model);
      return [{ Model: model, Status: 'Switched' }];
    } finally {
      await cdpBridge.close();
    }
  },
});
