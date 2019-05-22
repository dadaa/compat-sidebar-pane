"use strict";

const compatData = getCompatData();
const targetBrowsers = getTargetBrowsers(compatData);

browser.runtime.onConnect.addListener(port => {
  const listener = declarations => {
    const propertiesCompatData = compatData.css.properties;
    const issueList = [];

    for (const { name: property, value, isValid } of declarations) {
      if (!isValid) {
        if (value) {
          issueList.push({ property, propertyIssues: [],
                           value, valueIssues: targetBrowsers });
        } else {
          issueList.push({ property, propertyIssues: targetBrowsers });
        }
        continue;
      }

      const propertyCompatData = propertiesCompatData[property];
      if (!propertyCompatData) {
        continue;
      }

      const propertyIssues =
        this.getUnsupportedBrowsers(propertyCompatData, targetBrowsers);
      const issue = {
        property,
        propertyIssues,
      };

      if (propertyCompatData) {
        const valueCompatData = propertyCompatData[value];
        if (valueCompatData) {
          const valueIssues =
            this.getUnsupportedBrowsers(valueCompatData, targetBrowsers);
          issue.value = value;
          issue.valueIssues = valueIssues;
        }
      }

      if (issue.propertyIssues.length || (issue.value && issue.valueIssues.length)) {
        issueList.push(issue);
      }
    }

    port.postMessage(issueList);
  };

  browser.experiments.inspectedNode.onChange.addListener(listener);
  port.onDisconnect.addListener(() => {
    browser.experiments.inspectedNode.onChange.removeListener(listener);
  });
});

function getTargetBrowsers(compatData) {
  const browsers = compatData.browsers;

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

function getUnsupportedBrowsers(compatData, targets) {
  for (let field in compatData) {
    if (field === "__compat") {
      break;
    }

    // We don't have the way to know the context for now.
    // Thus, we choose first context if need.
    if (field.endsWith("_context")) {
      compatData = compatData[field];
    }
  }

  if (!compatData.__compat) {
    return targets;
  }

  const browsers = [];
  for (const target of targets) {
    const version = parseFloat(target.version);
    const supportStates = compatData.__compat.support[target.name] || [];
    let isSupported = false;
    for (const state of Array.isArray(supportStates) ? supportStates : [supportStates]) {
      // Ignore things that have prefix or flags
      if (state.prefix || state.flags) {
        continue;
      }

      const addedVersion = this.asFloatVersion(state.version_added);
      const removedVersion = this.asFloatVersion(state.version_removed);
      if (addedVersion <= version && version < removedVersion) {
        isSupported = true;
        break;
      }
    }

    if (!isSupported) {
      browsers.push(target);
    }
  }

  return browsers;
}

function asFloatVersion(version = false) {
  if (version === true) {
    return 0;
  }
  return version === false ? Number.MAX_VALUE : parseFloat(version);
}
