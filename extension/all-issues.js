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
                                  argetBrowsers, mdnBrowserCompat) {
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

        if (issueMap.has(property)) {
          // Avoid duplication
          continue;
        }

        if (!mdnBrowserCompat.hasProperty(property)) {
          issueMap.set(property, { property, isValid: false });
          continue;
        }

        const propertyIssues = [];
        for (const targetBrowser of targetBrowsers) {
          const support = mdnBrowserCompat.getPropertyState(property,
                                                            targetBrowser.name,
                                                            targetBrowser.version);
          if (support !== MDNBrowserCompat.STATE.SUPPORTED) {
            propertyIssues.push(targetBrowser);
          }
        }

        if (propertyIssues.length) {
          issueMap.set(property,
                       { property, propertyIssues, valueIssues: [], isValid: true });
        }
      }
    } else if (chunk.unknown) {
      console.warn(chunk);
    }
  }
}

async function _fetchContent(href) {
  const result = await fetch(href);
  return result.text();
}
