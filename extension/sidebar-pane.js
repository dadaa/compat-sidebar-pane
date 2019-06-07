"use strict";

const port = browser.runtime.connect();
port.onMessage.addListener(({ type, issueList }) => {
  const sectionEl = type === "node" ? document.querySelector(".node")
                                    : document.querySelector(".document");
  sectionEl.innerHTML = "";

  const ulEl = document.createElement("ul");

  if (!issueList.length) {
    const liEl = document.createElement("li");
    liEl.textContent = "No issues";
    ulEl.appendChild(liEl);
  } else {
    for (const issue of issueList) {
      const resultEl = issue.propertyAliases || issue.valueAliases
                         ? createPropertyAliasIssue(issue) : createPropertyIssue(issue);
      ulEl.appendChild(resultEl);
    }
  }

  sectionEl.appendChild(ulEl);
});

function onClick({ target }) {
  port.postMessage({ searchTerm: target.dataset.searchTerm });
}

function createPropertyAliasIssue({ property, propertyAliases, valueAliases,
                                    unsupportedBrowsers }) {
  const titleEl = document.createElement("span");

  if (propertyAliases) {
    for (const propertyAlias of propertyAliases) {
      const propertyAliasEl = createIssueLabel(propertyAlias, ["property", "alias"]);
      titleEl.appendChild(propertyAliasEl);
    }
  } else {
    const propertyEl = document.createElement("label");
    propertyEl.textContent = `${ property }: `;
    titleEl.appendChild(propertyEl);

    for (const valueAlias of valueAliases) {
      const valueAliasEl = createIssueLabel(valueAlias, ["value", "alias"]);
      titleEl.appendChild(valueAliasEl);
    }
  }

  const browsersEl = document.createElement("label");
  const browserText = getBrowsersString(unsupportedBrowsers);
  browsersEl.textContent = ` could not cover ${ browserText }.`;

  const liEl = document.createElement("li");
  liEl.classList.add("unsupported");
  liEl.appendChild(titleEl);
  liEl.appendChild(browsersEl);
  return liEl;
}

function createPropertyIssue({ property, value, unsupportedBrowsers, isValid }) {
  const titleEl = value ? createPropertyValueIssueLabel(property, value)
                        : createIssueLabel(property, ["property"]);
  const resultEl = isValid ? renderNotSupported(titleEl, unsupportedBrowsers)
                           : renderInvalid(titleEl);
  return resultEl;
}

function createIssueLabel(value, classes) {
  const el = document.createElement("label");
  for (const clazz of classes) {
    el.classList.add(clazz);
  }
  el.textContent = value;
  el.classList.add("clickable");
  el.dataset.searchTerm = value;
  el.addEventListener("click", onClick);
  return el;
}

function createPropertyValueIssueLabel(property, value) {
  const titleEl = document.createElement("span");
  const propertyEl = document.createElement("label");
  propertyEl.textContent = `${ property }: `;
  const valueEl = createIssueLabel(value, ["value"]);
  titleEl.appendChild(propertyEl);
  titleEl.appendChild(valueEl);
  return titleEl;
}

function renderInvalid(titleEl) {
  const liEl = document.createElement("li");
  liEl.classList.add("invalid");
  const invalidEl = document.createElement("label");
  invalidEl.textContent = ` is invalid.`;
  liEl.appendChild(titleEl);
  liEl.appendChild(invalidEl);
  return liEl;
}

function renderNotSupported(titleEl, browsers) {
  const liEl = document.createElement("li");
  liEl.classList.add("unsupported");
  const browsersEl = document.createElement("label");
  const browserText = getBrowsersString(browsers);
  browsersEl.textContent = ` is not supported in ${ browserText }.`;
  browsersEl.classList.add("browsers");
  liEl.appendChild(titleEl);
  liEl.appendChild(browsersEl);
  return liEl;
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
