"use strict";

const mdnBrowserCompat = new MDNBrowserCompat(getCompatData());
const targetBrowsers = getTargetBrowsers();
let currentPortNumber = 0;

browser.runtime.onConnect.addListener(port => {
  const clientId = `client-${ currentPortNumber++ }`;

  const cssCompatibility = new CSSCompatibility(clientId, mdnBrowserCompat);

  const observer = async (type) => {
    const nodeIssues =
      await cssCompatibility.getCurrentNodeIssues(targetBrowsers);
    port.postMessage({ type: "node", issueList: nodeIssues });

    if (type === "document") {
      const documentIssues =
        await cssCompatibility.getCurrentDocumentIssues(targetBrowsers);
      port.postMessage({ type: "document", issueList: documentIssues });
    }
  };

  browser.experiments.inspectedNode.onChange.addListener(observer, clientId);

  const messageListener = ({ searchTerm }) => {
    browser.experiments.inspectedNode.highlight(searchTerm, clientId);
  };
  port.onMessage.addListener(messageListener);

  const disconnectedListener = () => {
    browser.experiments.inspectedNode.onChange.removeListener(observer);
    port.onDisconnect.removeListener(disconnectedListener);
    port.onMessage.removeListener(messageListener);
  };
  port.onDisconnect.addListener(disconnectedListener);
});

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
