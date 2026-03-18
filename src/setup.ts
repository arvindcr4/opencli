/**
 * setup.ts — OpenCLI MCP token setup
 *
 * OpenCLI MCP is now tokenless. This file simply informs the user
 * that token configuration is no longer required.
 */
import chalk from 'chalk';
import { checkTokenConnectivity } from './doctor.js';

export async function runSetup(opts: { cliVersion?: string; token?: string } = {}) {
  console.log();
  console.log(chalk.bold('  opencli setup') + chalk.dim(' — OpenCLI MCP configuration'));
  console.log();
  console.log(`  ${chalk.green('✓')} Configuration complete.`);
  console.log(`  ${chalk.dim('OpenCLI MCP Bridge no longer requires token configuration.')}`);
  console.log();

  // Auto-verify browser connectivity
  console.log(chalk.dim('  Verifying browser connectivity...'));
  try {
    const result = await checkTokenConnectivity({ timeout: 5 });
    if (result.ok) {
      console.log(`  ${chalk.green('✓')} Browser connected in ${(result.durationMs / 1000).toFixed(1)}s`);
    } else {
      console.log(`  ${chalk.yellow('!')} Browser connectivity test failed: ${result.error ?? 'unknown'}`);
      console.log(chalk.dim('    To use opencli, make sure Chrome is running with Developer Mode'));
      console.log(chalk.dim('    and the OpenCLI MCP Bridge extension is enabled.'));
      console.log(chalk.dim(`    Run ${chalk.bold('opencli doctor --live')} to re-test connectivity.`));
    }
  } catch {
    console.log(`  ${chalk.yellow('!')} Browser connectivity test skipped (Chrome may not be running).`);
    console.log(chalk.dim('    Start Chrome to begin using opencli.'));
    console.log(chalk.dim(`    Run ${chalk.bold('opencli doctor --live')} to re-test connectivity.`));
  }
  console.log();
}
