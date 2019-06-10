"use strict";

const { ISSUE_TYPE } = MDNBrowserCompat;

const port = browser.runtime.connect();
port.onMessage.addListener(({ type, issueList }) => {
  const isInSelectedNode = type === "node";
  const sectionEl = isInSelectedNode ? document.querySelector(".node")
                                     : document.querySelector(".document");
  sectionEl.innerHTML = "";

  const ulEl = document.createElement("ul");

  if (!issueList.length) {
    const liEl = document.createElement("li");
    liEl.textContent = "No issues";
    ulEl.appendChild(liEl);
  } else {
    for (const issue of issueList) {
      ulEl.appendChild(renderIssue(issue, isInSelectedNode));
    }
  }

  sectionEl.appendChild(ulEl);
});

function onClick({ target }) {
  port.postMessage({ searchTerm: target.dataset.searchTerm });
}

function renderIssue(issue, isInSelectedNode) {
  const liEl = document.createElement("li");
  const subjectEl = renderSubject(issue);
  const predicateEl = renderPredicate(issue);
  liEl.appendChild(subjectEl);
  liEl.appendChild(predicateEl);

  switch (issue.type) {
    case ISSUE_TYPE.PROPERTY_INVALID:
    case ISSUE_TYPE.VALUE_INVALID: {
      liEl.classList.add("warning");
      break;
    }
    case ISSUE_TYPE.PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.PROPERTY_ALIASES_NOT_COVER:
    case ISSUE_TYPE.VALUE_NOT_SUPPORT:
    case ISSUE_TYPE.VALUE_ALIASES_NOT_COVER: {
      liEl.classList.add("information");
      break;
    }
  }

  if (isInSelectedNode) {
    const linkEl = renderMDNLink(issue);
    if (linkEl) {
      liEl.appendChild(linkEl);
    }
  }

  return liEl;
}

function renderSubject(issue) {
  let termsEl = null;
  let contextEl = null;

  switch (issue.type) {
    case ISSUE_TYPE.PROPERTY_INVALID:
    case ISSUE_TYPE.PROPERTY_NOT_SUPPORT: {
      termsEl = renderTerms(issue.property, ["property"]);
      break;
    }
    case ISSUE_TYPE.PROPERTY_ALIASES_NOT_COVER: {
      termsEl = renderTerms(issue.propertyAliases, ["property", "alias"]);
      break;
    }
    case ISSUE_TYPE.VALUE_INVALID:
    case ISSUE_TYPE.VALUE_NOT_SUPPORT: {
      contextEl = renderLabel(`${ issue.property }: `);
      termsEl = renderTerms(issue.value, ["value"]);
      break;
    }
    case ISSUE_TYPE.VALUE_ALIASES_NOT_COVER: {
      contextEl = renderLabel(`${ issue.property }: `);
      termsEl = renderTerms(issue.valueAliases, ["value", "alias"]);
      break;
    }
  }

  const subjectEl = document.createElement("span");
  if (contextEl) {
    subjectEl.appendChild(contextEl);
  }
  subjectEl.appendChild(termsEl);

  return subjectEl;
}

function renderPredicate(issue) {
  let contentEl = null;

  switch (issue.type) {
    case ISSUE_TYPE.PROPERTY_INVALID:
    case ISSUE_TYPE.VALUE_INVALID: {
      contentEl = renderLabel(" is invalid.");
      break;
    }
    case ISSUE_TYPE.PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.VALUE_NOT_SUPPORT: {
      const browserText = getBrowsersString(issue.unsupportedBrowsers);
      contentEl = renderLabel(` is not supported in ${ browserText }.`);
      break;
    }
    case ISSUE_TYPE.PROPERTY_ALIASES_NOT_COVER:
    case ISSUE_TYPE.VALUE_ALIASES_NOT_COVER: {
      const browserText = getBrowsersString(issue.unsupportedBrowsers);
      contentEl = renderLabel(` could not cover ${ browserText }.`);
      break;
    }
  }

  const predicateEl = document.createElement("span");
  predicateEl.appendChild(contentEl);
  return predicateEl;
}

function renderTerms(terms, classes) {
  const containerEl = document.createElement("span");

  for (const term of Array.isArray(terms) ? terms : [terms]) {
    const termEl = renderLabel(term);
    termEl.classList.add(...classes);
    termEl.classList.add("clickable");
    termEl.dataset.searchTerm = term;
    termEl.addEventListener("click", onClick);
    containerEl.appendChild(termEl);
  }

  return containerEl;
}

function renderLabel(text) {
  const labelEl = document.createElement("label");
  labelEl.textContent = text;
  return labelEl;
}

function renderMDNLink(issue) {
  let term = null;

  switch (issue.type) {
    case ISSUE_TYPE.PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.VALUE_INVALID:
    case ISSUE_TYPE.VALUE_NOT_SUPPORT:
    case ISSUE_TYPE.VALUE_ALIASES_NOT_COVER: {
      term = issue.property;
      break;
    }
    case ISSUE_TYPE.PROPERTY_ALIASES_NOT_COVER: {
      term = issue.propertyAliases[0];
      break;
    }
  }

  if (!term) {
    return null;
  }

  const url = `https://developer.mozilla.org/docs/Web/CSS/${ term }`;
  const linkEl = document.createElement("a");
  linkEl.textContent = "Learn more";
  linkEl.href = url;
  linkEl.classList.add("link");
  return linkEl;
}

function getBrowsersString(browsers) {
  const map = {};
  for (const { brandName, version } of browsers) {
    if (!map[brandName]) {
      map[brandName] = [];
    }
    map[brandName].push(version);
  }

  let browserText = "";
  for (let name in map) {
    const versions = map[name];
    browserText += `${ name } (${ versions.join(", ") }) `;
  }

  return browserText;
}
