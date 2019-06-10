"use strict";

async function getAllIssues(tabId, targetBrowsers, mdnBrowserCompat) {
  await browser.tabs.executeScript(tabId, { file: "content.js",
                                             runAt: "document_idle" });
  const issueMap = new Map();
  const styleSheets = await browser.tabs.sendMessage(tabId, {});
  for (const styleSheet of styleSheets) {
    try {
      await _analyzeStyleSheet(styleSheet, issueMap, targetBrowsers, mdnBrowserCompat);
    } catch (e) {
      console.error(
        `Could not analyze ${ styleSheet.text || styleSheet.href } [${ e.message }]`);
    }
  }

  return [...issueMap.values()];
}

async function _analyzeStyleSheet(styleSheet, issueMap,
                                  targetBrowsers, mdnBrowserCompat) {
  const content = styleSheet.text || await _fetchContent(styleSheet.href);
  const cssTokenizer = new CSSTokenizer(content);

  let parent;
  for (;;) {
    const chunk = cssTokenizer.nextChunk();
    if (!chunk) {
      break;
    }

    if (chunk.atrule) {
      parent = chunk;
    } else if (chunk.selectors) {
      parent = chunk;
    } else if (chunk.property) {
      if (!parent) {
        console.warn("No parent for this property:"+chunk.property.text);
        continue;
      }

      const isInCSSDeclarationBlock = parent.selectors ||
                                      parent.atrule.text === "media" ||
                                      parent.atrule.text === "page";

      if (isInCSSDeclarationBlock) {
        const property = chunk.property.text;

        if (property.startsWith("--")) {
          // Ignore CSS variable
          continue;
        }

        if (property === ("*")) {
          // Ignore all
          continue;
        }

        if (!mdnBrowserCompat.hasProperty(property)) {
          issueMap.set(property,
                       { type: MDNBrowserCompat.ISSUE_TYPE.PROPERTY_INVALID, property });
          continue;
        }

        _analyzeProperty(property, issueMap, targetBrowsers, mdnBrowserCompat);

        for (const valueToken of chunk.values) {
          if (valueToken.tokenType !== "ident") {
            continue;
          }

          _analyzePropertyValue(property, valueToken.text,
                                issueMap, targetBrowsers, mdnBrowserCompat);
        }
      }
    } else if (chunk.unknown) {
      console.warn(chunk);
    }
  }
}

function _analyzeProperty(property, issueMap, targetBrowsers, mdnBrowserCompat) {
  if (issueMap.has(property)) {
    // Avoid duplication
    return;
  }

  const unsupportedBrowsers = [];
  for (const targetBrowser of targetBrowsers) {
    const support = mdnBrowserCompat.getPropertyState(property,
                                                      targetBrowser.name,
                                                      targetBrowser.version);
    if (support !== MDNBrowserCompat.COMPAT_STATE.SUPPORTED) {
      unsupportedBrowsers.push(targetBrowser);
    }
  }

  if (unsupportedBrowsers.length) {
    issueMap.set(property,
                 { type: MDNBrowserCompat.ISSUE_TYPE.PROPERTY_NOT_SUPPORT,
                   property,
                   unsupportedBrowsers });
  }
}

function _analyzePropertyValue(property, value,
                               issueMap, targetBrowsers, mdnBrowserCompat) {
  const key = `${ property }:${ value }`;
  if (issueMap.has(key)) {
    // Avoid duplication
    return;
  }

  const unsupportedBrowsers = [];
  for (const targetBrowser of targetBrowsers) {
    const support = mdnBrowserCompat.getPropertyValueState(property,
                                                           value,
                                                           targetBrowser.name,
                                                           targetBrowser.version);
    if (support === MDNBrowserCompat.COMPAT_STATE.UNSUPPORTED) {
      unsupportedBrowsers.push(targetBrowser);
    }
  }

  if (unsupportedBrowsers.length) {
    issueMap.set(property,
                 { type: MDNBrowserCompat.ISSUE_TYPE.VALUE_NOT_SUPPORT,
                   property,
                   value,
                   unsupportedBrowsers });
  }
}

async function _fetchContent(href) {
  const result = await fetch(href);
  return result.text();
}
