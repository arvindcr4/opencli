import { cli, Strategy } from "@jackwener/opencli/registry";
import { COPILOT365_URL, isCopilot365Url } from "./_lib/shared.js";
const statusCommand = cli({
  site: "copilot365",
  name: "status",
  access: "read",
  description: "Verify the active Chrome tab is logged in to Microsoft 365 Copilot",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ["Status", "Url", "Title", "SignedIn"],
  func: async (page) => {
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(4);
    }
    const info = await page.evaluate(`
      () => {
        const title = document.title || '';
        const url = window.location.href;
        // The OfficeShell renders a <div id="identity"> JSON block on the page
        // for any authenticated M365 surface. Verified via the M365 Copilot
        // exporter userscript (ganyuke/copilot-exporter) which depends on it.
        const identityEl = document.getElementById('identity');
        let signedIn = false;
        let upn = '';
        let tenantId = '';
        if (identityEl && identityEl.textContent) {
          try {
            const id = JSON.parse(identityEl.textContent);
            signedIn = !!(id && id.objectId && id.tenantId);
            upn = id?.userPrincipalName || '';
            tenantId = id?.tenantId || '';
          } catch (_) { /* ignore parse error, treat as not signed in */ }
        }
        return { title, url, signedIn, upn, tenantId };
      }
    `);
    return [{
      Status: info.signedIn ? "Connected" : "NotSignedIn",
      Url: info.url,
      Title: info.title,
      SignedIn: info.signedIn ? `yes (${info.upn || info.tenantId})` : "no"
    }];
  }
});
export {
  statusCommand
};
