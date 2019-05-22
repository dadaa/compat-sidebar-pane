"use strict";

this.inspectedNode = class extends ExtensionAPI {
  getAPI(context) {
    const { classes: Cc, interfaces: Ci, utils: utils } = Components;
    const { Services } = Cu.import("resource://gre/modules/Services.jsm");
    const { require } = Cu.import("resource://devtools/shared/Loader.jsm");
    const { gDevTools } = require("devtools/client/framework/devtools");

    const _observers = new WeakMap();

    const _notify = async (inspector, fire) => {
      const node = inspector.selection.nodeFront;
      const pageStyle = await inspector.getPageStyle();
      const styles = await pageStyle.getApplied(node, { skipPseudo: true });
      const declarations = [];
      for (const style of styles) {
        declarations.push(...style.rule.declarations);
      }
      fire.asyncWithoutClone(declarations);
    }

    const _observe = async (fire) => {
      const navigator = Services.wm.getMostRecentWindow("navigator:browser");
      const tab = navigator.gBrowser.selectedTab;
      const target = await gDevTools.getTargetForTab(tab);
      const toolbox = gDevTools.getToolbox(target);
      const inspector = toolbox.inspector;
      const listener = () => {
        _notify(inspector, fire);
      };
      inspector.on("new-root", listener);
      inspector.selection.on("new-node-front", listener);

      _notify(inspector, fire);

      _observers.set(fire, { inspector, listener });
    };

    const _unobserve = fire => {
      const { inspector, listener } = _observers.get(fire);
      inspector.off("new-root", listener);
      inspector.selection.off("new-node-front", listener);
      _observers.delete(fire);
    };

    return {
      experiments: {
        inspectedNode: {
          onChange: new ExtensionCommon.EventManager({
            context,
            name: "experiments.inspectedNode.onChange",
            register: fire => {
              _observe(fire);

              return () => {
                _unobserve(fire);
              };
            },
          }).api()
        },
      },
    };
  }
}
