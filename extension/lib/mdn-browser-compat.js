"use strict";

const _COMPAT_STATE = {
  BROWSER_NOT_FOUND: "BROWSER_NOT_FOUND",
  DATA_NOT_FOUND: "DATA_NOT_FOUND",
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
};

const _ISSUE_TYPE = {
  CSS_PROPERTY_INVALID: "CSS_PROPERTY_INVALID",
  CSS_PROPERTY_NOT_SUPPORT: "CSS_PROPERTY_NOT_SUPPORT",
  CSS_PROPERTY_ALIASES_NOT_COVER: "CSS_PROPERTY_ALIASES_NOT_COVER",
  CSS_VALUE_INVALID: "CSS_VALUE_INVALID",
  CSS_VALUE_NOT_SUPPORT: "CSS_VALUE_NOT_SUPPORT",
  CSS_VALUE_ALIASES_NOT_COVER: "CSS_VALUE_ALIASES_NOT_COVER",
  HTML_ELEMENT_INVALID: "HTML_ELEMENT_INVALID",
  HTML_ELEMENT_NOT_SUPPORT: "HTML_ELEMENT_NOT_SUPPORT",
};

const _DATA_TYPE = {
  CSS_PROPERTY: "CSS_PROPERTY",
  HTML_ELEMENT: "HTML_ELEMENT",
};

const _TYPE_MAP = {
  "image": [
    "background-image",
    "list-style-image",
    "border-image-source",
    "cursor",
    "mask-image",
    "shape-outside",
    "mask-border-source",
    // symbols for @counter-style
    // content for a pseudo-element (::after/::before)
  ],
};

class MDNBrowserCompat {
  static get COMPAT_STATE() {
    return _COMPAT_STATE;
  }

  static get DATA_TYPE() {
    return _DATA_TYPE;
  }

  static get ISSUE_TYPE() {
    return _ISSUE_TYPE;
  }

  /**
   * @param JSON of browser compat data of MDN
   *        https://github.com/mdn/browser-compat-data
   */
  constructor(mdnCompatData) {
    this.mdnCompatData = mdnCompatData;

    // Flatten CSS property aliases.
    this._flattenMap(this.mdnCompatData.css.properties);

    // Flatten CSS value aliases.
    for (let property in this.mdnCompatData.css.properties) {
      this._flattenMap(this.mdnCompatData.css.properties[property]);
    }

    // Flatten type.
    for (let type in _TYPE_MAP) {
      const root = this.mdnCompatData.css.types[type];
      this._flattenDeeply(root, root);

      // Set to each properties
      for (const property of _TYPE_MAP[type]) {
        const compatData = this.mdnCompatData.css.properties[property];

        if (!compatData) {
          continue;
        }

        for (let key in root) {
          compatData[key] = root[key];
        }
      }
    }

    delete this.mdnCompatData.css.types;
  }

  getBrowsers() {
    return this.mdnCompatData.browsers;
  }

  hasTerm(type, ...terms) {
    return !!this._getCompatTable(type, terms);
  }

  getSupportState(browser, version, type, ...terms) {
    const compatTable = this._getCompatTable(type, terms);
    if (!compatTable) {
      return _COMPAT_STATE.DATA_NOT_FOUND;
    }

    const supportList = compatTable.support[browser];
    if (!supportList) {
      return _COMPAT_STATE.BROWSER_NOT_FOUND;
    }

    version = parseFloat(version);

    const terminal = terms[terms.length - 1];
    const match = terminal.match(/^-\w+-/);
    const prefix = match ? match[0] : null;
    for (const support of Array.isArray(supportList) ? supportList : [supportList]) {
      if((!support.prefix && !prefix) || support.prefix === prefix) {
        const addedVersion = this._asFloatVersion(support.version_added);
        const removedVersion = this._asFloatVersion(support.version_removed);

        if (addedVersion <= version && version < removedVersion) {
          return _COMPAT_STATE.SUPPORTED;
        }
      }
    }

    return _COMPAT_STATE.UNSUPPORTED;
  }

  /**
   * @param declarations - pageStyle.getApplied()[x].rule.declarations
   * @param browsers - [{ browser: e.g. firefox, version: e.g. 68 }, ...]
   */
  getCSSDeclarationBlockIssues(declarations, browsers) {
    const issueList = [];
    let propertyAliasMap = null;
    let valueAliasMap = null;

    for (const { name: property, value, isValid, isNameValid } of declarations) {
      if (!isValid) {
        if (!isNameValid) {
          issueList.push({ type: _ISSUE_TYPE.CSS_PROPERTY_INVALID, property });
        } else {
          issueList.push({ type: _ISSUE_TYPE.CSS_VALUE_INVALID, property, value });
        }
        continue;
      }

      const propertyAlias = this._getAlias(_DATA_TYPE.CSS_PROPERTY, property);
      if (propertyAlias) {
        if (!propertyAliasMap) {
          propertyAliasMap = new Map();
        }
        if (!propertyAliasMap.has(propertyAlias)) {
          propertyAliasMap.set(propertyAlias, []);
        }
        propertyAliasMap.get(propertyAlias).push(property);
        continue;
      }

      const valueAlias = this._getAlias(_DATA_TYPE.CSS_PROPERTY, property, value);
      if (valueAlias) {
        if (!valueAliasMap) {
          valueAliasMap = new Map();
        }
        const key = `${ property }:${ valueAlias }`;
        if (!valueAliasMap.has(key)) {
          valueAliasMap.set(key, []);
        }
        valueAliasMap.get(key).push(value);
        continue;
      }

      const propertyUnsupportedBrowsers = [];
      const valueUnsupportedBrowsers = [];

      for (const browser of browsers) {
        const propertyState = this.getSupportState(browser.name, browser.version,
                                                   _DATA_TYPE.CSS_PROPERTY, property);

        if (propertyState !== _COMPAT_STATE.SUPPORTED) {
          propertyUnsupportedBrowsers.push(browser);
          continue;
        }

        const valueState = this.getSupportState(browser.name, browser.version,
                                                _DATA_TYPE.CSS_PROPERTY, property, value);
        if (valueState === _COMPAT_STATE.UNSUPPORTED) {
          valueUnsupportedBrowsers.push(browser);
          continue;
        }
      }

      if (propertyUnsupportedBrowsers.length) {
        issueList.push(
          { type: _ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT,
            property,
            unsupportedBrowsers: propertyUnsupportedBrowsers });
      }

      if (valueUnsupportedBrowsers.length) {
        issueList.push(
          { type: _ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT,
            property,
            value,
            unsupportedBrowsers: valueUnsupportedBrowsers });
      }
    }

    if (propertyAliasMap) {
      for (const [property, aliases] of propertyAliasMap.entries()) {
        const unsupportedBrowsers = browsers.filter(b => {
          for (const alias of aliases) {
            const state =
              this.getSupportState(b.name, b.version, _DATA_TYPE.CSS_PROPERTY, alias);
            if (state === _COMPAT_STATE.SUPPORTED) {
              return false;
            }
          }

          return true;
        });

        if (unsupportedBrowsers.length) {
          issueList.push({ type: _ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER,
                           propertyAliases: aliases,
                           unsupportedBrowsers });
        }
      }
    }

    if (valueAliasMap) {
      for (const [propertyAndValue, aliases] of valueAliasMap.entries()) {
        const property = propertyAndValue.split(":")[0];
        const unsupportedBrowsers = browsers.filter(b => {
          for (const alias of aliases) {
            const state = this.getSupportState(b.name, b.version,
                                               _DATA_TYPE.CSS_PROPERTY, property, alias);
            if (state !== _COMPAT_STATE.UNSUPPORTED) {
              return false;
            }
          }

          return true;
        });

        if (unsupportedBrowsers.length) {
          issueList.push({ type: _ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER,
                           property,
                           valueAliases: aliases,
                           unsupportedBrowsers });
        }
      }
    }

    return issueList;
  }

  getHTMLElementIssues(elements, browsers) {
    const issueList = [];

    for (const element of elements) {
      if (!this.hasTerm(_DATA_TYPE.HTML_ELEMENT, element)) {
        issueList.push({ type: _ISSUE_TYPE.HTML_ELEMENT_INVALID, element });
        continue;
      }

      const unsupportedBrowsers = browsers.filter(b => {
        const state =
          this.getSupportState(b.name, b.version, _DATA_TYPE.HTML_ELEMENT, element);
        return state !== _COMPAT_STATE.SUPPORTED;
      });

      if (unsupportedBrowsers.length) {
        issueList.push(
          { type: _ISSUE_TYPE.HTML_ELEMENT_NOT_SUPPORT, element, unsupportedBrowsers });
      }
    }

    return issueList;
  }

  _getAlias(type, ...terms) {
    const node = this._getNode(type, terms);
    return node ? node._aliasOf : null;
  }

  _getChildNode(name, parent) {
    name = name.toLowerCase();

    let child = parent[name];

    if (!child) {
      for (let field in parent) {
        if (name.startsWith(field)) {
          child = parent[field];
          break;
        }
      }

      if (!child) {
        return null;
      }
    }

    if (child._aliasOf) {
      child = parent[child._aliasOf]
    }

    return child;
  }

  _getCompatTable(type, terms) {
    let node = this._getNode(type, terms);

    if (!node) {
      return null;
    }

    if (!node.__compat) {
      for (let field in node) {
        // TODO: We don't have a way to know the context for now.
        //       Thus, we choose first context if need.
        if (field.endsWith("_context")) {
          node = node[field];
          break;
        }
      }
    }

    return node.__compat;
  }

  _getNode(type, terms) {
    let node = null;

    switch (type) {
      case _DATA_TYPE.CSS_PROPERTY: {
        node = this.mdnCompatData.css.properties;
        break;
      }
      case _DATA_TYPE.HTML_ELEMENT: {
        node = this.mdnCompatData.html.elements;
        break;
      }
    }

    if (!node) {
      return null;
    }

    for (const term of terms) {
      node = this._getChildNode(term, node);
      if (!node) {
        return null;
      }
    }

    return node;
  }

  _flattenDeeply(map, root) {
    this._flattenMap(map);

    // Move value to the root.
    if (root !== map) {
      for (let key in map) {
        if (key.includes("_")) {
          continue;
        }

        root[key] = map[key];
        delete map[key];
      }

    }

    for (let key in map) {
      if (key.includes("_")) {
        continue;
      }
      this._flattenDeeply(map[key], root);
    }
  }

  _flattenMap(map) {
    const aliases = [];
    for (let key in map) {
      if (key.includes("_")) {
        continue;
      }
      const compatData = map[key]
      this._flattenItem(aliases, key, compatData);
    }

    for (const { alias, aliasOf } of aliases) {
      if (!map[alias]) {
        map[alias] = {};
      }
      map[alias]._aliasOf = aliasOf;
      // Want to handle the entity property as same as alias property.
      map[aliasOf]._aliasOf = aliasOf;
    }
  }

  _flattenItem(aliases, key, compatData, context) {
    if (compatData.__compat) {
      for (let runtime in compatData.__compat.support) {
        const supportStates = compatData.__compat.support[runtime] || [];
        for (const { alternative_name, prefix }
          of Array.isArray(supportStates) ? supportStates : [supportStates]) {
          if (!prefix && !alternative_name) {
            continue;
          }

          const alias = alternative_name || prefix + key;
          aliases.push({ alias, aliasOf: key });
        }
      }

      return;
    }

    for (let field in compatData) {
      if (field.endsWith("_context")) {
        this._flattenItem(aliases, key, compatData[field], field);
      }
    }
  }

  _asFloatVersion(version = false) {
    if (version === true) {
      return 0;
    }
    return version === false ? Number.MAX_VALUE : parseFloat(version);
  }
}
