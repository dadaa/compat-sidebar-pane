"use strict";

this.inspectedNode = class extends ExtensionAPI {
  getAPI(context) {
    const { classes: Cc, interfaces: Ci, utils: utils } = Components;
    const { Services } = Cu.import("resource://gre/modules/Services.jsm");
    const { require } = Cu.import("resource://devtools/shared/Loader.jsm");
    const { gDevTools } = require("devtools/client/framework/devtools");

    const _observers = new Map();

    const _notify = async (clientId) => {
      const { fire, inspector } = _observers.get(clientId);

      const node = inspector.selection.nodeFront;
      const styles = await inspector.pageStyle.getApplied(node, { skipPseudo: true });
      const declarations = [];
      for (const { rule } of styles) {
        declarations.push(
          ...rule.declarations.map(d => Object.assign(d, { ruleId: rule.actorID })));
      }
      fire.asyncWithoutClone(declarations);
    }

    const _observe = async (fire, clientId) => {
      const navigator = Services.wm.getMostRecentWindow("navigator:browser");
      const tab = navigator.gBrowser.selectedTab;
      const target = await gDevTools.getTargetForTab(tab);
      const toolbox = gDevTools.getToolbox(target);

      const inspector = toolbox.getPanel("inspector");
      const listener = () => {
        _notify(clientId);
      };
      _observers.set(clientId, { fire, inspector, listener });

      inspector.on("new-root", listener);
      inspector.selection.on("new-node-front", listener);

      _notify(clientId);
    };

    const _unobserve = clientId => {
      const { inspector, listener } = _observers.get(clientId);
      inspector.off("new-root", listener);
      inspector.selection.off("new-node-front", listener);
      _observers.delete(clientId);
    };

    return {
      experiments: {
        inspectedNode: {
          async highlight(ruleId, clientId) {
            const { inspector } = _observers.get(clientId);
            const { highlightElementRule } = inspector.getPanel("ruleview").view;
            highlightElementRule(ruleId);
          },

          onChange: new ExtensionCommon.EventManager({
            context,
            name: "experiments.inspectedNode.onChange",
            register: (fire, clientId) => {
              _observe(fire, clientId);

              return () => {
                _unobserve(clientId);
              };
            },
          }).api()
        },
      },
    };
  }
}
