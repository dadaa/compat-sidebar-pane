"use strict";

const _MDN_COMPAT_STATE = {
  DATA_NOT_FOUND: "DATA_NOT_FOUND",
  BROWSER_NOT_FOUND: "BROWSER_NOT_FOUND",
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
    return _MDN_COMPAT_STATE;
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

  hasCSSProperty(property) {
    try {
      this._getSupportMap(property, this.mdnCompatData.css.properties);
      return true;
    } catch (_) {
      return false;
    }
  }

  hasHTMLElement(element) {
    try {
      this._getSupportMap(element, this.mdnCompatData.html.elements);
      return true;
    } catch (_) {
      return false;
    }
  }

  getCSSPropertyState(property, browser, version) {
    try {
      const supportMap = this._getSupportMap(property, this.mdnCompatData.css.properties);
      return this._getState(browser, version, supportMap);
    } catch (_) {
      return MDNBrowserCompat.COMPAT_STATE.DATA_NOT_FOUND;
    }
  }

  getCSSValueState(property, value, browser, version) {
    let propertyCompatData = this.mdnCompatData.css.properties[property];

    if (propertyCompatData._aliasOf) {
      propertyCompatData = this.mdnCompatData.css.properties[propertyCompatData._aliasOf];
    }

    try {
      const supportMap = this._getSupportMap(value, propertyCompatData, true);
      return this._getState(browser, version, supportMap);
    } catch (_) {
      return MDNBrowserCompat.COMPAT_STATE.DATA_NOT_FOUND;
    }
  }

  getHTMLElementState(element, browser, version) {
    try {
      const supportMap = this._getSupportMap(element, this.mdnCompatData.html.elements);
      return this._getState(browser, version, supportMap);
    } catch (_) {
      return MDNBrowserCompat.COMPAT_STATE.DATA_NOT_FOUND;
    }
  }

  /**
   * @param declarations - pageStyle.getApplied()[x].rule.declarations
   * @param browsers - [{ browser: e.g. firefox, version: e.g. 68 }, ...]
   */
  getDeclarationBlockIssues(declarations, browsers) {
    const { COMPAT_STATE, ISSUE_TYPE } = MDNBrowserCompat;
    const issueList = [];
    let propertyAliasMap = null;
    let valueAliasMap = null;

    for (const { name: property, value, isValid, isNameValid } of declarations) {
      if (!isValid) {
        if (!isNameValid) {
          issueList.push({ type: ISSUE_TYPE.CSS_PROPERTY_INVALID, property });
        } else {
          issueList.push({ type: ISSUE_TYPE.CSS_VALUE_INVALID, property, value });
        }
        continue;
      }

      const propertyAlias = this._getCSSPropertyAlias(property);
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

      const valueAlias = this._getCSSValueAlias(property, value);
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
        const propertyState =
          this.getCSSPropertyState(property, browser.name, browser.version);

        if (propertyState !== COMPAT_STATE.SUPPORTED) {
          propertyUnsupportedBrowsers.push(browser);
          continue;
        }

        const valueState =
          this.getCSSValueState(property, value, browser.name, browser.version);
        if (valueState === COMPAT_STATE.UNSUPPORTED ||
            valueState === COMPAT_STATE.BROWSER_NOT_FOUND) {
          valueUnsupportedBrowsers.push(browser);
          continue;
        }
      }

      if (propertyUnsupportedBrowsers.length) {
        issueList.push(
          { type: ISSUE_TYPE.CSS_PROPERTY_NOT_SUPPORT,
            property,
            unsupportedBrowsers: propertyUnsupportedBrowsers });
      }

      if (valueUnsupportedBrowsers.length) {
        issueList.push(
          { type: ISSUE_TYPE.CSS_VALUE_NOT_SUPPORT,
            property,
            value,
            unsupportedBrowsers: valueUnsupportedBrowsers });
      }
    }

    if (propertyAliasMap) {
      for (const [property, aliases] of propertyAliasMap.entries()) {
        const unsupportedBrowsers = browsers.filter(b => {
          for (const alias of aliases) {
            if (this.getCSSPropertyState(alias, b.name, b.version) ===
              COMPAT_STATE.SUPPORTED) {
              return false;
            }
          }

          return true;
        });

        if (unsupportedBrowsers.length) {
          issueList.push({ type: ISSUE_TYPE.CSS_PROPERTY_ALIASES_NOT_COVER,
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
            const state = this.getCSSValueState(property, alias, b.name, b.version);
            if (state !== COMPAT_STATE.UNSUPPORTED &&
                state !== COMPAT_STATE.BROWSER_NOT_FOUND) {
              return false;
            }
          }

          return true;
        });

        if (unsupportedBrowsers.length) {
          issueList.push({ type: ISSUE_TYPE.CSS_VALUE_ALIASES_NOT_COVER,
                           property,
                           valueAliases: aliases,
                           unsupportedBrowsers });
        }
      }
    }

    return issueList;
  }

  getHTMLElementIssues(elements, browsers) {
    const { COMPAT_STATE, ISSUE_TYPE } = MDNBrowserCompat;
    const issueList = [];

    for (const element of elements) {
      if (!this.hasHTMLElement(element)) {
        issueList.push({ type: ISSUE_TYPE.HTML_ELEMENT_INVALID, element });
        continue;
      }

      const unsupportedBrowsers = browsers.filter(b => {
        const state = this.getHTMLElementState(element, b.name, b.version);
        return state !== COMPAT_STATE.SUPPORTED;
      });

      if (unsupportedBrowsers.length) {
        issueList.push(
          { type: ISSUE_TYPE.HTML_ELEMENT_NOT_SUPPORT, element, unsupportedBrowsers });
      }
    }

    return issueList;
  }

  _getCSSPropertyAlias(property) {
    const propertyCompatData = this.mdnCompatData.css.properties[property];
    return propertyCompatData._aliasOf;
  }

  _getCSSValueAlias(property, value) {
    const compatData = this.mdnCompatData.css.properties[property];
    for (let key in compatData) {
      if (value.startsWith(key)) {
        return compatData[key]._aliasOf;
      }
    }
  }

  _getState(browser, version, supportMap) {
    const supportList = supportMap[browser];

    if (!supportList) {
      return MDNBrowserCompat.COMPAT_STATE.BROWSER_NOT_FOUND;
    }

    version = parseFloat(version);

    for (const support of Array.isArray(supportList) ? supportList : [supportList]) {
      // Ignore things that have prefix or flags
      if (support.prefix || support.flags) {
        continue;
      }

      const addedVersion = this._asFloatVersion(support.version_added);
      const removedVersion = this._asFloatVersion(support.version_removed);

      if (addedVersion <= version && version < removedVersion) {
        return MDNBrowserCompat.COMPAT_STATE.SUPPORTED;
      }
    }

    return MDNBrowserCompat.COMPAT_STATE.UNSUPPORTED;
  }

  _getSupportMap(target, compatDataTable, isValue) {
    target = target.toLowerCase();

    let compatData = compatDataTable[target];

    if (!compatData && isValue) {
      for (let key in compatDataTable) {
        if (target.startsWith(key)) {
          compatData = compatDataTable[key];
          break;
        }
      }
    }

    if (!compatData) {
      throw new Error(`${ target } data was not found`);
    }

    for (let field in compatData) {
      if (field === "__compat") {
        break;
      }

      // TODO: We don't have a way to know the context for now.
      //       Thus, we choose first context if need.
      if (field.endsWith("_context")) {
        compatData = compatData[field];
        break;
      }
    }

    if (!compatData.__compat) {
      throw new Error(`${ target } __compat dir was not found`);
    }

    if (!compatData.__compat.support) {
      throw new Error(`${ target } __compat.support dir was not found`);
    }

    return compatData.__compat.support;
  }

  _asFloatVersion(version = false) {
    if (version === true) {
      return 0;
    }
    return version === false ? Number.MAX_VALUE : parseFloat(version);
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

    for (const { alias, aliasOf, context, runtime,
                 version_added, version_removed, flags } of aliases) {

      if (!map[alias]) {
        map[alias] = {}
      }

      let compatData;
      if (context) {
        if (!map[alias][context]) {
          map[alias][context] = {};
        }
        compatData = map[alias][context];
      } else {
        if (!map[alias]) {
          map[alias] = {};
        }
        compatData = map[alias];
      }

      if (!compatData.__compat) {
        compatData.__compat = {};
      }

      if (!compatData.__compat.support) {
        compatData.__compat.support = {};
      }

      compatData._aliasOf = aliasOf;

      const support = compatData.__compat.support;
      if (!support[runtime]) {
        support[runtime] = [];
      } else if (!Array.isArray(support[runtime])) {
        support[runtime] = [support[runtime]];
      }

      const supportList = support[runtime];
      supportList.push({
        version_added, version_removed, flags,
      });

      // Want to handle the entity property as same as alias property.
      map[aliasOf]._aliasOf = aliasOf;
    }
  }

  _flattenItem(aliases, key, compatData, context) {
    if (compatData.__compat) {
      for (let runtime in compatData.__compat.support) {
        const supportStates = compatData.__compat.support[runtime] || [];
        for (const { alternative_name, prefix, version_added, version_removed, flags }
          of Array.isArray(supportStates) ? supportStates : [supportStates]) {
          if (!prefix && !alternative_name) {
            continue;
          }

          const alias = alternative_name || prefix + key;
          aliases.push({ alias, aliasOf: key, context, runtime,
                         version_added, version_removed, flags });
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
}
