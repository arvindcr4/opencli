/**
 * Safe evaluation utilities for browser code injection.
 *
 * Prevents code injection by passing data through a
 * window.__opencli_args side channel instead of template-string interpolation.
 *
 * All pipeline steps that evaluate JS in the browser MUST use these helpers.
 */

import type { IPage } from '../types.js';

/**
 * Set args on the page before calling evaluate, so the JS code can
 * read them from window.__opencli_args instead of embedded template literals.
 */
export async function setEvaluateArgs(page: IPage, args: Record<string, any>): Promise<void> {
  const safeJson = JSON.stringify(args);
  await page.evaluate(`window.__opencli_args = ${safeJson}`);
}

/**
 * Evaluate JS that reads data from window.__opencli_args.
 * The JS code must be a trusted function (not containing user input).
 */
export async function safeEvaluate(
  page: IPage,
  trustedJs: string,
  args?: Record<string, any>,
): Promise<any> {
  if (args) {
    await setEvaluateArgs(page, args);
  }
  return page.evaluate(trustedJs);
}

/**
 * Wrap a trusted JS snippet so it receives args as a parameter.
 * Use this pattern instead of template literal interpolation.
 */
export async function safeEvaluateWrapper(
  page: IPage,
  trustedJsFn: string,
  args: Record<string, any>,
): Promise<any> {
  const safeJson = JSON.stringify(args);
  const wrapped = `(() => { const __args = ${safeJson}; return (${trustedJsFn})(__args); })()`;
  return page.evaluate(wrapped);
}
