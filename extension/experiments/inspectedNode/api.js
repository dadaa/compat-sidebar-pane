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
      const url = inspector.target.targetForm.url;
      fire.asyncWithoutClone(type, url);
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

      const changesFront = await inspector.target.getFront("changes");
      changesFront.on("clear-changes", nodeListener);
      changesFront.on("remove-change", nodeListener);
      changesFront.on("add-change", nodeListener);

      documentListener();
    };

    const _unobserve = async (clientId) => {
      const { inspector, documentListener, nodeListener } = _observers.get(clientId);
      inspector.off("new-root", documentListener);
      inspector.selection.on("new-node-front", nodeListener);

      const changesFront = await inspector.target.getFront("changes");
      changesFront.off("clear-changes", nodeListener);
      changesFront.off("remove-change", nodeListener);
      changesFront.off("add-change", nodeListener);

      _observers.delete(clientId);
    };

    const _setRemovable = (declarations, property, value, isRemovable) => {
      for (const declaration of declarations) {
        if (declaration.name === property && declaration.value === value) {
          declaration.isRemovable = isRemovable;
          return;
        }
      }
    };

    return {
      experiments: {
        inspectedNode: {
          async getStyle(clientId) {
            const { inspector } = _observers.get(clientId);

            const node = inspector.selection.nodeFront;
            const styles =
              await inspector.pageStyle.getApplied(node, { skipPseudo: true });

            const changesFront = await inspector.target.getFront("changes");
            const changes = await changesFront.allChanges();

            return styles.map(({ rule }) => {
              const { actorID: ruleId } = rule;
              let { declarations } = rule;

              // Mark properties which are removable.
              for (const { id, add, remove } of changes) {
                if (ruleId !== id) {
                  continue;
                }

                if (add && remove) {
                  // Maybe update the property?
                  continue;
                }

                if (add) {
                  for (const { property, value } of add) {
                    _setRemovable(declarations, property, value, false);
                  }
                } else if (remove) {
                  for (const { property, value } of remove) {
                    _setRemovable(declarations, property, value, true);
                  }
                }
              }

              declarations = declarations.filter(d => !d.isRemovable);
              return declarations.length ? { ruleId, declarations } : null;
            }).filter(rule => !!rule);
          },

          async getElement(clientId) {
            const { inspector } = _observers.get(clientId);
            const node = inspector.selection.nodeFront;
            return node.tagName;
          },

          async highlightCSS(searchTerm, clientId) {
            const { inspector } = _observers.get(clientId);
            inspector.getPanel("ruleview").view.setFilterStyles(searchTerm);
          },

          async highlightHTML(searchTerm, clientId) {
            const { inspector } = _observers.get(clientId);
            inspector.searchBox.value = searchTerm;
            inspector.search.doFullTextSearch(searchTerm, false);
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
