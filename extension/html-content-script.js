"use strict";

const elements = new Set();

(function scan(node) {
  if (node.tagName) {
    elements.add(node.tagName);
  }

  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
    scan(children[i]);
  }
})(document.documentElement);

[...elements.values()];
