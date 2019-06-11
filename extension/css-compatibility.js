class CSSCompatibility {
  constructor(clientId, mdnBrowserCompat) {
    this._clientId = clientId;
    this._mdnBrowserCompat = mdnBrowserCompat;
  }

  async getCurrentDocumentIssues(targetBrowsers) {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });
    const tabId = tabs[0].id;
    const [styleSheets] =
      await browser.tabs.executeScript(tabId, { file: "css-content-script.js",
                                                runAt: "document_idle" });

    const issueMap = new Map();
    for (const styleSheet of styleSheets) {
      try {
        await this._analyzeStyleSheet(styleSheet, issueMap, targetBrowsers);
      } catch (e) {
        console.error(
          `Could not analyze ${ styleSheet.text || styleSheet.href } [${ e.message }]`);
      }
    }

    return [...issueMap.values()];
  }

  async getCurrentNodeIssues(targetBrowsers) {
    const issueList = [];
    const declarationBlocks =
      await browser.experiments.inspectedNode.getStyle(this._clientId);

    for (const { ruleId, declarations } of declarationBlocks) {
      const issues =
        this._mdnBrowserCompat.getDeclarationBlockIssues(declarations, targetBrowsers)
                              .map(issue => Object.assign(issue, { ruleId }));
      issueList.push(...issues);
    }

    return issueList;
  }

  async _analyzeStyleSheet(styleSheet, issueMap, targetBrowsers) {
    const content = styleSheet.text || await this._fetchContent(styleSheet.href);
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
          console.warn(`No parent for this property: ${ chunk.property.text }`);
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

          if (!this._mdnBrowserCompat.hasCSSProperty(property)) {
            issueMap.set(property,
                         { type: MDNBrowserCompat.ISSUE_TYPE.CSS_PROPERTY_INVALID,
                           property });
            continue;
          }

          this._analyzeProperty(property, issueMap, targetBrowsers);

          for (const { text, tokenType } of chunk.values) {
            if (tokenType !== "ident") {
              continue;
            }

            this._analyzePropertyValue(property, text, issueMap, targetBrowsers);
          }
        }
      } else if (chunk.unknown) {
        console.warn(chunk);
      }
    }
  }

  _analyzeProperty(property, issueMap, targetBrowsers) {
    if (issueMap.has(property)) {
      // Avoid duplication
      return;
    }

    const unsupportedBrowsers = [];
    for (const targetBrowser of targetBrowsers) {
      const support = this._mdnBrowserCompat.getCSSPropertyState(property,
                                                                 targetBrowser.name,
                                                                 targetBrowser.version);
      if (support !== MDNBrowserCompat.COMPAT_STATE.SUPPORTED) {
        unsupportedBrowsers.push(targetBrowser);
      }
    }

    if (unsupportedBrowsers.length) {
      issueMap.set(property,
                   { type: MDNBrowserCompat.ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT,
                     property,
                     unsupportedBrowsers });
    }
  }

  _analyzePropertyValue(property, value, issueMap, targetBrowsers) {
    const key = `${ property }:${ value }`;
    if (issueMap.has(key)) {
      // Avoid duplication
      return;
    }

    const unsupportedBrowsers = [];
    for (const targetBrowser of targetBrowsers) {
      const support = this._mdnBrowserCompat.getCSSValueState(property,
                                                              value,
                                                              targetBrowser.name,
                                                              targetBrowser.version);
      if (support === MDNBrowserCompat.COMPAT_STATE.UNSUPPORTED) {
        unsupportedBrowsers.push(targetBrowser);
      }
    }

    if (unsupportedBrowsers.length) {
      issueMap.set(property,
                   { type: MDNBrowserCompat.ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT,
                     property,
                     value,
                     unsupportedBrowsers });
    }
  }

  async _fetchContent(href) {
    const result = await fetch(href);
    return result.text();
  }
}
