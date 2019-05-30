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
      const resultEl = issue.propertyAliases ? createPropertyAliasIssue(issue)
                                             : createPropertyIssue(issue);
      ulEl.appendChild(resultEl);
    }
  }

  sectionEl.appendChild(ulEl);
});

function onClick({ target }) {
  port.postMessage({ ruleId: target.dataset.ruleId });
}

function createPropertyAliasIssue({ propertyAliases, unsupportedBrowsers, ruleId }) {
  const titleEl = document.createElement("span");
  const propertyText = propertyAliases.join(", ");
  titleEl.appendChild(createPropertyIssueLabel(propertyText, ruleId));
  const browsersEl = document.createElement("label");
  const browserText = getBrowsersString(unsupportedBrowsers);
  browsersEl.textContent = ` could not cover ${ browserText }.`;

  const liEl = document.createElement("li");
  liEl.classList.add("unsupported");
  liEl.appendChild(titleEl);
  liEl.appendChild(browsersEl);
  return liEl;
}

function createPropertyIssue({ property, value, unsupportedBrowsers, isValid, ruleId }) {
  const titleEl = value ? createPropertyValueIssueLabel(property, value, ruleId)
                        : createPropertyIssueLabel(property, ruleId);
  const resultEl = isValid ? renderNotSupported(titleEl, unsupportedBrowsers)
                           : renderInvalid(titleEl);
  return resultEl;
}

function createPropertyIssueLabel(property, ruleId) {
  const propertyEl = document.createElement("label");
  propertyEl.classList.add("property");
  propertyEl.textContent = property;
  if (ruleId) {
    propertyEl.classList.add("clickable");
    propertyEl.dataset.ruleId = ruleId;
    propertyEl.addEventListener("click", onClick);
  }
  return propertyEl;
}

function createPropertyValueIssueLabel(property, value, ruleId) {
  const titleEl = document.createElement("span");
  const propertyEl = document.createElement("label");
  propertyEl.textContent = `${ property }: `;
  const valueEl = document.createElement("label");
  valueEl.textContent = value;
  valueEl.classList.add("value");
  if (ruleId) {
    valueEl.classList.add("clickable");
    valueEl.dataset.ruleId = ruleId;
    valueEl.addEventListener("click", onClick);
  }
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
