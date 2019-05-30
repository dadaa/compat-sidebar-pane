"use strict";

const mdnBrowserCompat = new MDNBrowserCompat(getCompatData());
const targetBrowsers = getTargetBrowsers();
let currentPortNumber = 0;

browser.runtime.onConnect.addListener(port => {
  const clientId = `client-${ currentPortNumber++ }`;

  const observer = async (type) => {
    const nodeIssues = await getNodeIssues(clientId);
    port.postMessage({ type: "node", issueList: nodeIssues });

    if (type === "document") {
      const documentIssues = await getDocumentIssues();
      port.postMessage({ type: "document", issueList: documentIssues });
    }
  };

  browser.experiments.inspectedNode.onChange.addListener(observer, clientId);

  const messageListener = ({ ruleId }) => {
    browser.experiments.inspectedNode.highlight(ruleId, clientId);
  };
  port.onMessage.addListener(messageListener);

  const disconnectedListener = () => {
    browser.experiments.inspectedNode.onChange.removeListener(observer);
    port.onDisconnect.removeListener(disconnectedListener);
    port.onMessage.removeListener(messageListener);
  };
  port.onDisconnect.addListener(disconnectedListener);
});

async function getDocumentIssues() {
  const tabs = await browser.tabs.query({ currentWindow: true, active: true });
  const currentTab = tabs[0];
  const issueList = await getAllIssues(currentTab.id, targetBrowsers, mdnBrowserCompat);
  return issueList;
}

async function getNodeIssues(clientId) {
  const issueList = [];
  const declarationBlocks = await browser.experiments.inspectedNode.getStyle(clientId);

  for (const { ruleId, declarations } of declarationBlocks) {
    const issues =
      mdnBrowserCompat.getDeclarationBlockIssues(declarations, targetBrowsers)
                      .map(issue => Object.assign(issue, { ruleId }));
    issueList.push(...issues);
  }

  return issueList;
}

function getTargetBrowsers() {
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
