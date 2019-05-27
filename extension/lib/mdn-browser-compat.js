"use strict";

const MDN_COMPAT_STATE = {
  DATA_NOT_FOUND: "DATA_NOT_FOUND",
  BROWSER_NOT_FOUND: "DATA_NOT_FOUND",
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
}
