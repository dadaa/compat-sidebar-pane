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
  port.postMessage({ type: target.dataset.type, searchTerm: target.dataset.searchTerm });
}

function renderIssue(issue, isInSelectedNode) {
  const liEl = document.createElement("li");
  const subjectEl = renderSubject(issue);
  const predicateEl = renderPredicate(issue);
  liEl.appendChild(subjectEl);
  liEl.appendChild(predicateEl);

  switch (issue.type) {
    case ISSUE_TYPE.CSS_PROPERTY_INVALID:
    case ISSUE_TYPE.CSS_VALUE_INVALID:
    case ISSUE_TYPE.HTML_TAG_INVALID: {
      liEl.classList.add("warning");
      break;
    }
    case ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER:
    case ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT:
    case ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER:
    case ISSUE_TYPE.HTML_TAG_NOT_SUPPORT: {
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
  let termsEls = null;

  switch (issue.type) {
    case ISSUE_TYPE.CSS_PROPERTY_INVALID:
    case ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT: {
      termsEls = [renderTerms([issue.property], ["property"])];
      break;
    }
    case ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER: {
      termsEls = [renderTerms(issue.propertyAliases, ["property", "alias"])];
      break;
    }
    case ISSUE_TYPE.CSS_VALUE_INVALID:
    case ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT: {
      termsEls = [renderLabel(`${ issue.property }: `),
                  renderTerms([issue.value], ["value"])];
      break;
    }
    case ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER: {
      termsEls = [renderLabel(`${ issue.property }: `),
                  renderTerms(issue.valueAliases, ["value", "alias"])];
      break;
    }
    case ISSUE_TYPE.HTML_TAG_INVALID:
    case ISSUE_TYPE.HTML_TAG_NOT_SUPPORT: {
      termsEls =
        [renderTerms([issue.tag.toLowerCase()], ["html-tag"], "html", t => `<${ t }>` )];
      break;
    }
  }

  const subjectEl = document.createElement("span");
  subjectEl.append(...termsEls);
  return subjectEl;
}

function renderPredicate(issue) {
  let contentEls = null;

  switch (issue.type) {
    case ISSUE_TYPE.CSS_PROPERTY_INVALID:
    case ISSUE_TYPE.CSS_VALUE_INVALID:
    case ISSUE_TYPE.HTML_TAG_INVALID: {
      contentEls = [renderLabel(" is invalid.")];
      break;
    }
    case ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT:
    case ISSUE_TYPE.HTML_TAG_NOT_SUPPORT: {
      contentEls = [renderLabel(" is not supported in"),
                    renderBrowsersElement(issue.unsupportedBrowsers),
                    renderLabel(".")]
      break;
    }
    case ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER:
    case ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER: {
      contentEls = [renderLabel(" could not cover"),
                    renderBrowsersElement(issue.unsupportedBrowsers),
                    renderLabel(".")]
      break;
    }
  }

  const predicateEl = document.createElement("span");
  predicateEl.append(...contentEls);
  return predicateEl;
}

function renderTerms(terms, classes, type = "css", expression = v => v) {
  const containerEl = document.createElement("span");

  for (const term of terms) {
    const termEl = renderLabel(expression(term));
    termEl.classList.add(...classes);
    termEl.classList.add("clickable");
    termEl.dataset.searchTerm = term;
    termEl.dataset.type = type;
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
  const CSS_URL = "https://developer.mozilla.org/docs/Web/CSS/";
  const HTML_URL = "https://developer.mozilla.org/docs/Web/HTML/Element/";

  let url = null;

  switch (issue.type) {
    case ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT:
    case ISSUE_TYPE.CSS_VALUE_INVALID:
    case ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT:
    case ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER: {
      url = CSS_URL + issue.property;
      break;
    }
    case ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER: {
      url = CSS_URL + issue.propertyAliases[0];
      break;
    }
    case ISSUE_TYPE.HTML_TAG_NOT_SUPPORT: {
      url = HTML_URL + issue.tag;
      break;
    }
  }

  if (!url) {
    return null;
  }

  const linkEl = document.createElement("a");
  linkEl.textContent = "Learn more";
  linkEl.href = url;
  linkEl.classList.add("link");
  return linkEl;
}

function renderBrowsersElement(browsers) {
  const browsersEl = document.createElement("span");

  const map = {};
  for (const { brandName, name, version } of browsers) {
    if (!map[name]) {
      map[name] = { brandName, versions: [] };
    }
    map[name].versions.push(version);
  }

  for (let name in map) {
    const { brandName, versions } = map[name];
    const browserEl = renderLabel(`${ brandName } (${ versions.join(", ") })`);
    browserEl.classList.add("browser");
    browserEl.classList.add(name);
    browsersEl.appendChild(browserEl);
  }

  return browsersEl;
}
