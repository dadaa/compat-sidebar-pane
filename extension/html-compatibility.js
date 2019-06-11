class HTMLCompatibility {
  constructor(clientId, mdnBrowserCompat) {
    this._clientId = clientId;
    this._mdnBrowserCompat = mdnBrowserCompat;
  }

  async getCurrentDocumentIssues(targetBrowsers) {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });
    const tabId = tabs[0].id;
    const [tags] =
      await browser.tabs.executeScript(tabId, { file: "html-content-script.js",
                                                runAt: "document_idle" });
    return await mdnBrowserCompat.getHTMLTagIssues(tags, targetBrowsers);
  }

  async getCurrentNodeIssues(targetBrowsers) {
    const tag = await browser.experiments.inspectedNode.getTag(this._clientId);
    return tag ? await mdnBrowserCompat.getHTMLTagIssues([tag], targetBrowsers) : [];
  }
}
