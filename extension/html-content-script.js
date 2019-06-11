"use strict";

const tags = new Set();

(function scan(node) {
  if (node.tagName) {
    tags.add(node.tagName);
  }

  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
    scan(children[i]);
  }
})(document.documentElement);

[...tags.values()];
