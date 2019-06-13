class HTMLCompatibility {
  constructor(clientId, mdnBrowserCompat) {
    this._clientId = clientId;
    this._mdnBrowserCompat = mdnBrowserCompat;
  }

  async getCurrentDocumentIssues(targetBrowsers) {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });
    const tabId = tabs[0].id;
    const [elements] =
      await browser.tabs.executeScript(tabId, { file: "html-content-script.js",
                                                runAt: "document_idle" });
    return await mdnBrowserCompat.getHTMLElementIssues(elements, targetBrowsers);
  }

  async getCurrentNodeIssues(targetBrowsers) {
    const element = await browser.experiments.inspectedNode.getElement(this._clientId);
    return element
             ? await mdnBrowserCompat.getHTMLElementIssues([element], targetBrowsers)
             : [];
  }
}
