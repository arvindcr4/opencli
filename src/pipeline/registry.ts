/**
 * Dynamic registry for pipeline steps.
 * Allows core and third-party plugins to register custom YAML operations.
 */

import type { IPage } from '../types.js';

// Import core steps
import { stepNavigate, stepClick, stepType, stepFill, stepWait, stepPress, stepSnapshot, stepEvaluate } from './steps/browser.js';
import { stepFetch } from './steps/fetch.js';
import { stepSelect, stepMap, stepFilter, stepSort, stepLimit } from './steps/transform.js';
import { stepIntercept } from './steps/intercept.js';
import { stepTap } from './steps/tap.js';
import { stepDownload } from './steps/download.js';

/** 
 * Step handler: all pipeline steps conform to this generic interface.
 * TData is the type of the `data` state flowing into the step.
 * TResult is the expected return type.
 */
export type StepHandler<TData = unknown, TResult = unknown, TParams = unknown> = (
  page: IPage | null,
  params: TParams,
  data: TData,
  args: Record<string, unknown>
) => Promise<TResult>;

const _stepRegistry = new Map<string, StepHandler>();

/**
 * Get a registered step handler by name.
 */
export function getStep(name: string): StepHandler | undefined {
  return _stepRegistry.get(name);
}

/**
 * List all currently registered step names. Used by `validate.ts` to allowlist
 * step names without maintaining a parallel hand-coded list.
 *
 * Note: this depends on registerStep() side effects below already having run.
 * Importing this module triggers all core registrations at the bottom of the
 * file, so the returned array reflects every core + plugin step at call time.
 */
export function getRegisteredStepNames(): string[] {
  return [..._stepRegistry.keys()];
}

/**
 * Register a new custom step handler for the YAML pipeline.
 * Core step names (navigate, fetch, evaluate, etc.) are reserved and cannot be overridden.
 */
export function registerStep(name: string, handler: StepHandler): void {
  if (RESERVED_STEPS.has(name) && _stepRegistry.has(name)) {
    // Silently reject attempts to override reserved core steps
    return;
  }
  _stepRegistry.set(name, handler);
}

/** Core step names that cannot be overridden by plugins */
const RESERVED_STEPS = new Set([
  'navigate', 'fetch', 'select', 'evaluate', 'snapshot',
  'click', 'type', 'wait', 'press', 'map', 'filter',
  'sort', 'limit', 'intercept', 'tap', 'download',
]);

// -------------------------------------------------------------
// Auto-Register Core Steps
// -------------------------------------------------------------
registerStep('navigate', stepNavigate);
registerStep('fetch', stepFetch);
registerStep('select', stepSelect);
registerStep('evaluate', stepEvaluate);
registerStep('snapshot', stepSnapshot);
registerStep('click', stepClick);
registerStep('type', stepType);
registerStep('fill', stepFill);
registerStep('wait', stepWait);
registerStep('press', stepPress);
registerStep('map', stepMap);
registerStep('filter', stepFilter);
registerStep('sort', stepSort);
registerStep('limit', stepLimit);
registerStep('intercept', stepIntercept);
registerStep('tap', stepTap);
registerStep('download', stepDownload);
