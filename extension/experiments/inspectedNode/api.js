"use strict";

this.inspectedNode = class extends ExtensionAPI {
  getAPI(context) {
    const TYPE = {
      DOCUMENT: "document",
      NODE: "node",
    };
    const { classes: Cc, interfaces: Ci, utils: utils } = Components;
    const { Services } = Cu.import("resource://gre/modules/Services.jsm");
    const { require } = Cu.import("resource://devtools/shared/Loader.jsm");
    const { gDevTools } = require("devtools/client/framework/devtools");

    const _observers = new Map();

    const _notify = async (type, clientId) => {
      const { fire, inspector } = _observers.get(clientId);
      fire.asyncWithoutClone(type);
    }

    const _observe = async (fire, clientId) => {
      const navigator = Services.wm.getMostRecentWindow("navigator:browser");
      const tab = navigator.gBrowser.selectedTab;
      const target = await gDevTools.getTargetForTab(tab);
      const toolbox = gDevTools.getToolbox(target);

      const inspector = toolbox.getPanel("inspector");
      const nodeListener = () => {
        _notify(TYPE.NODE, clientId);
      };
      const documentListener = () => {
        _notify(TYPE.DOCUMENT, clientId);
      };
      _observers.set(clientId, { fire, inspector, documentListener, nodeListener });

      inspector.on("new-root", documentListener);
      inspector.selection.on("new-node-front", nodeListener);

      documentListener();
    };

    const _unobserve = clientId => {
      const { inspector, documentListener, nodeListener } = _observers.get(clientId);
      inspector.off("new-root", documentListener);
      inspector.selection.off("new-node-front", nodeListener);
      _observers.delete(clientId);
    };

    return {
      experiments: {
        inspectedNode: {
          async getStyle(clientId) {
            const { inspector } = _observers.get(clientId);

            const node = inspector.selection.nodeFront;
            const styles =
              await inspector.pageStyle.getApplied(node, { skipPseudo: true });
            return styles.map(({ rule }) => {
              const { actorID: ruleId, declarations } = rule;
              return { ruleId, declarations };
            });
          },

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
