"use strict";

const port = browser.runtime.connect();
port.onMessage.addListener(issueList => {
  const mainEl = document.querySelector("main");
  mainEl.innerHTML = "";

  if (!issueList.length) {
    mainEl.textContent = "No issues";
    return;
  }

  const ulEl = document.createElement("ul");
  for (const { property, propertyIssues,
               value, valueIssues,
               isValid, ruleId } of issueList) {
    if (isValid) {
      // Not supported
      if (propertyIssues.length) {
        const titleEl = createPropertyIssueLabel(property, ruleId);
        const resultEl = renderNotSupported(titleEl, propertyIssues);
        ulEl.appendChild(resultEl);
      }

      if (valueIssues.length) {
        const titleEl = createPropertyValueIssueLabel(property, value, ruleId);
        const resultEl = renderNotSupported(titleEl, valueIssues);
        ulEl.appendChild(resultEl);
      }
    } else {
      // Invalid
      const titleEl = value ? createPropertyValueIssueLabel(property, value, ruleId)
                            : createPropertyIssueLabel(property, ruleId);
      const resultEl = renderInvalid(titleEl);
      ulEl.appendChild(resultEl);
    }
  }

  mainEl.appendChild(ulEl);
});

function onClick({ target }) {
  port.postMessage({ ruleId: target.dataset.ruleId });
}

function createPropertyIssueLabel(property, ruleId) {
  const propertyEl = document.createElement("label");
  propertyEl.classList.add("property");
  propertyEl.textContent = property;
  propertyEl.dataset.ruleId = ruleId;
  propertyEl.addEventListener("click", onClick);
  return propertyEl;
}

function createPropertyValueIssueLabel(property, value, ruleId) {
  const titleEl = document.createElement("span");
  const propertyEl = document.createElement("label");
  propertyEl.textContent = `${ property }: `;
  const valueEl = document.createElement("label");
  valueEl.textContent = value;
  valueEl.classList.add("value");
  valueEl.dataset.ruleId = ruleId;
  valueEl.addEventListener("click", onClick);
  titleEl.appendChild(propertyEl);
  titleEl.appendChild(valueEl);
  return titleEl;
}

function renderInvalid(titleEl) {
  const liEl = document.createElement("li");
  const invalidEl = document.createElement("label");
  invalidEl.textContent = ` is invalid.`;
  liEl.appendChild(titleEl);
  liEl.appendChild(invalidEl);
  return liEl;
}

function renderNotSupported(titleEl, browsers) {
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

  const liEl = document.createElement("li");
  const browsersEl = document.createElement("label");
  browsersEl.textContent = ` is not supported in ${ browserText }.`;
  browsersEl.classList.add("browsers");
  liEl.appendChild(titleEl);
  liEl.appendChild(browsersEl);
  return liEl;
}
