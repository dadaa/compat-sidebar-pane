"use strict";

const MDN_COMPAT_STATE = {
  DATA_NOT_FOUND: "DATA_NOT_FOUND",
  BROWSER_NOT_FOUND: "BROWSER_NOT_FOUND",
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
};

class MDNBrowserCompat {
  static get STATE() {
    return MDN_COMPAT_STATE;
  }

  /**
   * @param JSON of browser compat data of MDN
   *        https://github.com/mdn/browser-compat-data
   */
  constructor(mdnCompatData) {
    this.mdnCompatData = mdnCompatData;
    this._flattenProperties(this.mdnCompatData.css.properties);
  }

  getBrowsers() {
    return this.mdnCompatData.browsers;
  }

  hasProperty(property) {
    try {
      this._getSupportMap(property, this.mdnCompatData.css.properties);
      return true;
    } catch (_) {
      return false;
    }
  }

  getPropertyState(property, browser, version) {
    try {
      const supportMap = this._getSupportMap(property, this.mdnCompatData.css.properties);
      return this._getState(browser, version, supportMap);
    } catch (_) {
      return MDNBrowserCompat.STATE.DATA_NOT_FOUND;
    }
  }

  getPropertyValueState(property, value, browser, version) {
    const propertyCompatData = this.mdnCompatData.css.properties[property];
    try {
      const supportMap = this._getSupportMap(value, propertyCompatData);
      return this._getState(browser, version, supportMap);
    } catch (_) {
      return MDNBrowserCompat.STATE.DATA_NOT_FOUND;
    }
  }

  /**
   * @param declarations - pageStyle.getApplied()[x].rule.declarations
   * @param browsers - [{ browser: e.g. firefox, version: e.g. 68 }, ...]
   */
  getDeclarationBlockIssues(declarations, browsers) {
    const issueList = [];
    let propertyAliasMap = null;

    for (const { name: property, value, isValid, isNameValid } of declarations) {
      if (!isValid) {
        if (!isNameValid) {
          issueList.push({ property, isValid });
        } else {
          issueList.push({ property, value, isValid });
        }
        continue;
      }

      const propertyAlias = this._getPropertyAlias(property);
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

      const propertyIssues = [];
      const valueIssues = [];

      for (const browser of browsers) {
        const propertyState =
          this.getPropertyState(property, browser.name, browser.version);

        if (propertyState !== MDNBrowserCompat.STATE.SUPPORTED) {
          propertyIssues.push(browser);
          continue;
        }

        const valueState =
          this.getPropertyValueState(property, value, browser.name, browser.version);
        if (valueState === MDNBrowserCompat.STATE.UNSUPPORTED) {
          valueIssues.push(browser);
          continue;
        }
      }

      if (propertyIssues.length) {
        issueList.push({ property, unsupportedBrowsers: propertyIssues, isValid });
      }

      if (valueIssues.length) {
        issueList.push({ property, value, unsupportedBrowsers: valueIssues, isValid });
      }
    }

    if (propertyAliasMap) {
      for (const [property, aliases] of propertyAliasMap.entries()) {
        const unsupportedBrowsers = browsers.filter(b => {
          for (const alias of aliases) {
            if (this.getPropertyState(alias, b.name, b.version) ===
                MDNBrowserCompat.STATE.SUPPORTED) {
              return false;
            }
          }

          return true;
        });

        if (unsupportedBrowsers.length) {
          issueList.push({ propertyAliases: aliases, unsupportedBrowsers });
        }
      }
    }

    return issueList;
  }

  _getPropertyAlias(property) {
    const propertyCompatData = this.mdnCompatData.css.properties[property];
    return propertyCompatData._aliasOf;
  }

  _getState(browser, version, supportMap) {
    const supportList = supportMap[browser];

    if (!supportList) {
      return MDNBrowserCompat.STATE.BROWSER_NOT_FOUND;
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
        return MDNBrowserCompat.STATE.SUPPORTED;
      }
    }

    return MDNBrowserCompat.STATE.UNSUPPORTED;
  }

  _getSupportMap(target, compatDataTable) {
    let compatData = compatDataTable[target];

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

  _flattenProperties(propertyMap) {
    const aliases = [];
    for (let property in propertyMap) {
      const compatData = propertyMap[property]
      this._flattenProperty(aliases, property, compatData);
    }

    for (const { alias, aliasOf, context, runtime,
                 version_added, version_removed, flags } of aliases) {

      if (!propertyMap[alias]) {
        propertyMap[alias] = {}
      }

      let compatData;
      if (context) {
        if (!propertyMap[alias][context]) {
          propertyMap[alias][context] = {};
        }
        compatData = propertyMap[alias][context];
      } else {
        if (!propertyMap[alias]) {
          propertyMap[alias] = {};
        }
        compatData = propertyMap[alias];
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

      propertyMap[aliasOf]._aliasOf = aliasOf;
    }
  }

  _flattenProperty(aliases, property, compatData, context) {
    if (compatData.__compat) {
      for (let runtime in compatData.__compat.support) {
        const supportStates = compatData.__compat.support[runtime] || [];
        for (const { alternative_name, prefix, version_added, version_removed, flags }
          of Array.isArray(supportStates) ? supportStates : [supportStates]) {
          if (!prefix && ! alternative_name) {
            continue;
          }

          const alias = alternative_name || prefix + property;
          aliases.push({ alias, aliasOf: property, context, runtime,
                         version_added, version_removed, flags });
        }
      }

      return;
    }

    for (let field in compatData) {
      if (field.endsWith("_context")) {
        this._flattenProperty(aliases, property, compatData[field], field);
      }
    }
  }
}
