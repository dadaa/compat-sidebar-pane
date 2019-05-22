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
  for (const { name, propertyIssues, value, valueIssues } of issueList) {
    if (propertyIssues && propertyIssues.length) {
      const titleEl = document.createElement("label");
      titleEl.classList.add("name");
      titleEl.textContent = name;
      ulEl.appendChild(renderList(titleEl, propertyIssues));
    }

    if (valueIssues && valueIssues.length) {
      const titleEl = document.createElement("span");
      const labelEl = document.createElement("label");
      labelEl.textContent = `${ name }: `;
      const valueEl = document.createElement("label");
      valueEl.textContent = value;
      valueEl.classList.add("value");
      titleEl.appendChild(labelEl);
      titleEl.appendChild(valueEl);
      ulEl.appendChild(renderList(titleEl, valueIssues));
    }
  }

  mainEl.appendChild(ulEl);
});

function renderList(titleEl, browsers) {
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
