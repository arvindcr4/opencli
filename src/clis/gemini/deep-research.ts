import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const deepResearchCommand = cli({
  site: 'gemini',
  name: 'deep-research',
  description: 'Run Gemini Deep Research on a topic and return the full report',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'prompt', type: 'string', required: true, positional: true, help: 'Research topic or question' },
    { name: 'timeout', type: 'int', default: 600, help: 'Max seconds to wait for research (default: 600 = 10min)' },
  ],
  columns: ['Role', 'Text'],
  timeoutSeconds: 660,
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const prompt = kwargs.prompt as string;
    const timeoutMs = ((kwargs.timeout as number) || 600) * 1000;
    const promptJson = JSON.stringify(prompt);

    // Navigate to fresh Gemini home
    await page.goto('https://gemini.google.com/app');
    await page.wait(4);

    // Try to activate Deep Research mode
    await page.evaluate(`
      async () => {
        // Try direct button
        const allClickable = [...document.querySelectorAll('button, a, [role="button"], span')];
        const drBtn = allClickable.find(el => (el.textContent || '').trim().toLowerCase() === 'deep research');
        if (drBtn) { drBtn.click(); await new Promise(r => setTimeout(r, 2000)); return; }

        // Try mode picker
        const modeBtn = document.querySelector('button[aria-label="Open mode picker"]');
        if (modeBtn) {
          modeBtn.click();
          await new Promise(r => setTimeout(r, 1500));
          const items = [...document.querySelectorAll('button, [role="menuitem"], [role="option"], .mat-mdc-menu-item, a')];
          const drItem = items.find(el => (el.textContent || '').toLowerCase().includes('deep research'));
          if (drItem) { drItem.click(); await new Promise(r => setTimeout(r, 2000)); return; }
          document.body.click();
          await new Promise(r => setTimeout(r, 500));
        }

        // Try Tools drawer
        const toolsBtn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim().toLowerCase() === 'tools');
        if (toolsBtn) {
          toolsBtn.click();
          await new Promise(r => setTimeout(r, 1500));
          const items = [...document.querySelectorAll('button, [role="menuitem"], [role="option"], a, span')];
          const drItem = items.find(el => (el.textContent || '').toLowerCase().includes('deep research'));
          if (drItem) { drItem.click(); await new Promise(r => setTimeout(r, 2000)); return; }
          document.body.click();
        }
      }
    `);

    await page.wait(2);

    // Type prompt and send
    const sendResult = await page.evaluate(`
      async () => {
        const editor = document.querySelector('.ql-editor[contenteditable="true"]');
        if (!editor) return { ok: false, msg: 'no editor' };
        editor.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('insertText', false, ${promptJson});
        await new Promise(r => setTimeout(r, 800));
        const sendBtn = document.querySelector('button[aria-label="Send message"]');
        if (sendBtn && !sendBtn.disabled) { sendBtn.click(); return { ok: true }; }
        return { ok: false, msg: 'no send button' };
      }
    `);

    if (!sendResult || !sendResult.ok) {
      return [{ Role: 'User', Text: prompt }, { Role: 'System', Text: '[SEND FAILED] ' + JSON.stringify(sendResult) }];
    }

    process.stderr.write('[deep-research] Prompt sent, waiting for research plan...\n');

    // Phase 1: Wait for research plan + click "Start research" (up to 90s)
    let researchStarted = false;
    for (let i = 0; i < 30; i++) {
      await page.wait(3);

      const result = await page.evaluate(`
        () => {
          // Check for error
          const responses = document.querySelectorAll('model-response');
          if (responses.length > 0) {
            const lastText = (responses[responses.length - 1].innerText || '').trim();
            if (lastText.includes('something went wrong') || lastText.includes('error') || lastText.includes('try again')) {
              return { action: 'error', text: lastText };
            }
          }

          // Look for "Start research" button
          const btns = [...document.querySelectorAll('button')];
          const startBtn = btns.find(b => (b.textContent || '').trim().toLowerCase().includes('start research'));
          if (startBtn && !startBtn.disabled) {
            startBtn.click();
            return { action: 'clicked-start' };
          }

          // Check if already researching
          const bodyText = document.body.innerText;
          if (bodyText.includes('Researching') || bodyText.includes('Browsing') || bodyText.includes('Analyzing')) {
            return { action: 'researching' };
          }
          if (bodyText.includes('Generating research plan')) {
            return { action: 'generating-plan' };
          }

          return { action: 'waiting' };
        }
      `);

      if (result?.action === 'error') {
        return [{ Role: 'User', Text: prompt }, { Role: 'System', Text: '[ERROR] ' + result.text }];
      }
      if (result?.action === 'clicked-start') {
        process.stderr.write('[deep-research] Clicked "Start research"\n');
        researchStarted = true;
        break;
      }
      if (result?.action === 'researching') {
        process.stderr.write('[deep-research] Research already in progress\n');
        researchStarted = true;
        break;
      }
      if (result?.action === 'generating-plan') {
        process.stderr.write('[deep-research] Generating plan...\n');
      }
    }

    if (!researchStarted) {
      process.stderr.write('[deep-research] Warning: Start research button not found, polling for report anyway\n');
    }

    // Phase 2: Poll for the final report
    process.stderr.write('[deep-research] Polling for report...\n');
    const startTime = Date.now();
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      await page.wait(10);

      const state = await page.evaluate(`
        () => {
          const responses = document.querySelectorAll('model-response');

          // Also check for Canvas or report containers
          const canvas = document.querySelector('immersive-container, [class*="canvas"], [class*="report"], article');

          // Check active research indicators
          const bodyText = document.body.innerText;
          const isResearching = bodyText.includes('Researching') || bodyText.includes('Browsing') || bodyText.includes('Analyzing');

          if (isResearching) {
            return { text: '', phase: 'researching' };
          }

          // Try Canvas/report container first (Deep Research outputs to Canvas)
          if (canvas) {
            const canvasText = (canvas.innerText || '').trim();
            if (canvasText.length > 500) {
              return { text: canvasText, phase: 'done' };
            }
          }

          // Try model-response elements
          if (responses.length > 0) {
            const last = responses[responses.length - 1];
            let text = (last.innerText || last.textContent || '').trim();
            text = text.replace(/^(Show thinking|Hide thinking)\\s*/i, '').trim();
            text = text.replace(/^Gemini said\\s*/i, '').trim();

            if (text.includes('something went wrong') || text.includes("I can't help with that")) {
              return { text, phase: 'error' };
            }
            if (text.includes('Start research') || text.includes('Edit plan')) {
              return { text: '', phase: 'plan' };
            }
            if (text.length > 200) {
              const hasLoading = !!document.querySelector('mat-progress-bar, [class*="streaming"]');
              return { text, phase: hasLoading ? 'streaming' : 'done' };
            }
          }

          // Fallback: check the main content area for any long text
          const mainContent = document.querySelector('main, [role="main"]');
          if (mainContent) {
            const mainText = (mainContent.innerText || '').trim();
            // If page has a lot of content and research indicators are gone, it might be done
            if (mainText.length > 2000 && !isResearching) {
              // Extract just the report part (skip UI chrome)
              return { text: mainText, phase: 'maybe-done' };
            }
          }

          return { text: '', phase: 'waiting' };
        }
      `);

      if (!state) continue;

      const elapsed = Math.round((Date.now() - startTime) / 1000);

      if (state.phase === 'error') {
        return [{ Role: 'User', Text: prompt }, { Role: 'System', Text: '[ERROR] ' + state.text }];
      }

      if (state.phase === 'researching') {
        if (elapsed % 30 < 11) process.stderr.write(`[deep-research] ${elapsed}s - Still researching...\n`);
        continue;
      }

      if (state.phase === 'plan') continue;

      if (state.text && state.text.length > 200) {
        if (state.phase === 'done' && state.text === lastText) {
          stableCount++;
          if (stableCount >= 2) {
            process.stderr.write(`[deep-research] Report complete (${state.text.length} chars)\n`);
            return [
              { Role: 'User', Text: prompt },
              { Role: 'Gemini (Deep Research)', Text: state.text },
            ];
          }
        } else if (state.text !== lastText) {
          stableCount = 0;
          if (elapsed % 30 < 11) process.stderr.write(`[deep-research] ${elapsed}s - Report growing (${state.text.length} chars)...\n`);
        }
        lastText = state.text;
      }
    }

    if (lastText && lastText.length > 100) {
      return [
        { Role: 'User', Text: prompt },
        { Role: 'Gemini (Deep Research)', Text: lastText + '\n\n[Timed out after ' + (timeoutMs / 1000) + 's — may still be generating]' },
      ];
    }

    return [
      { Role: 'User', Text: prompt },
      { Role: 'System', Text: 'No report within ' + (timeoutMs / 1000) + 's. Check gemini.google.com — research may still be running.' },
    ];
  },
});
