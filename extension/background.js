"use strict";

const mdnBrowserCompat = new MDNBrowserCompat(getCompatData());
let currentPortNumber = 0;

browser.runtime.onConnect.addListener(port => {
  const clientId = `client-${ currentPortNumber++ }`;

  const cssCompatibility = new CSSCompatibility(clientId, mdnBrowserCompat);
  const htmlCompatibility = new HTMLCompatibility(clientId, mdnBrowserCompat);

  const observer = async (type, url) => {
    const targetBrowsers = await getTargetBrowsers();
    const nodeIssues = [
      ...(await htmlCompatibility.getCurrentNodeIssues(targetBrowsers)),
      ...(await cssCompatibility.getCurrentNodeIssues(targetBrowsers)),
    ]
    port.postMessage({ type: "node", issueList: nodeIssues, url });

    if (type === "document") {
      const documentIssues = [
        ...(await htmlCompatibility.getCurrentDocumentIssues(targetBrowsers)),
        ...(await cssCompatibility.getCurrentDocumentIssues(targetBrowsers)),
      ]
      port.postMessage({ type: "document", issueList: documentIssues, url });
    }
  };

  browser.experiments.inspectedNode.onChange.addListener(observer, clientId);

  const messageListener = (action) => {
    if (action.method === "highlight") {
      if (action.type === "css") {
        browser.experiments.inspectedNode.highlightCSS(action.searchTerm, clientId);
      } else {
        browser.experiments.inspectedNode.highlightHTML(action.searchTerm, clientId);
      }
    } else if (action.method === "launch") {
      const launchInfo = { path: action.path, url: action.url };
      browser.runtime.sendNativeMessage("compat_sidebar_pane_launcher", launchInfo);
    }
  };
  port.onMessage.addListener(messageListener);

  const disconnectedListener = () => {
    browser.experiments.inspectedNode.onChange.removeListener(observer);
    port.onDisconnect.removeListener(disconnectedListener);
    port.onMessage.removeListener(messageListener);
  };
  port.onDisconnect.addListener(disconnectedListener);
});

async function getTargetBrowsers() {
  const { targetRuntimes } = await browser.storage.local.get("targetRuntimes");

  if (targetRuntimes) {
    return targetRuntimes;
  }

  const browsers = mdnBrowserCompat.getBrowsers();

  const targets = [];
  for (const name of ["firefox", "firefox_android",
                      "chrome", "chrome_android",
                      "safari", "safari_ios",
                      "edge", "edge_mobile"]) {
    const { name: brandName, releases } = browsers[name];

    for (const version in releases) {
      const { status } = releases[version];

      if (status !== "current" && status !== "beta" && status !== "nightly") {
        continue;
      }

      targets.push({ name, brandName, version, status });
    }
  }

  return targets;
}
