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
    const nameEl = renderList(`${ name } property`, propertyIssues);
    if (nameEl) {
      ulEl.appendChild(nameEl);
    }

    const valueEl = renderList(`${ name }:${ value } value`, valueIssues);
    if (valueEl) {
      ulEl.appendChild(valueEl);
    }
  }

  mainEl.appendChild(ulEl);
});

function renderList(title, browsers) {
  if (!browsers || browsers.length === 0) {
    return null;
  }

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
  const titleEl = document.createElement("label");
  titleEl.textContent = title;
  titleEl.classList.add("title");
  const browsersEl = document.createElement("label");
  browsersEl.textContent = `is not supported in ${ browserText }.`;
  browsersEl.classList.add("browsers");
  liEl.appendChild(titleEl);
  liEl.appendChild(browsersEl);
  return liEl;
}
