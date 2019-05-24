"use strict";

const mdnBrowserCompat = new MDNBrowserCompat(getCompatData());
const targetBrowsers = getTargetBrowsers();
let currentPortNumber = 0;

browser.runtime.onConnect.addListener(port => {
  const observer = createObserver(port);
  const clientId = `client-${ currentPortNumber++ }`;
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

function createObserver(port) {
  return declarations => {
    const issueList = [];

    for (const { name: property, value, isValid, isNameValid, ruleId } of declarations) {
      if (!isValid) {
        if (!isNameValid) {
          issueList.push({ property, isValid, ruleId });
        } else {
          issueList.push({ property, value, isValid, ruleId });
        }
        continue;
      }

      const propertyIssues = [];
      const valueIssues = [];

      for (const targetBrowser of targetBrowsers) {
        const propertyState = mdnBrowserCompat.getPropertyState(property,
                                                                targetBrowser.name,
                                                                targetBrowser.version);

        if (propertyState !== MDNBrowserCompat.STATE.SUPPORTED) {
          propertyIssues.push(targetBrowser);
          continue;
        }

        const valueState = mdnBrowserCompat.getPropertyValueState(property,
                                                                  value,
                                                                  targetBrowser.name,
                                                                  targetBrowser.version);
        if (valueState === MDNBrowserCompat.STATE.UNSUPPORTED) {
          valueIssues.push(targetBrowser);
          continue;
        }
      }

      if (propertyIssues.length === 0 && valueIssues.length === 0) {
        continue;
      }

      issueList.push({ property, propertyIssues, value, valueIssues, isValid, ruleId });
    }

    port.postMessage(issueList);
  };
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
