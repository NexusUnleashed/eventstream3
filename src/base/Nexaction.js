const CreateTrigger = ({ pattern, action, id = action.name, group = false, enabled = true, once = false }) => {
  return {
    pattern: pattern,
    action: action,
    id: id ?? pattern.source,
    group: group,
    enabled: enabled,
    once: once,
  };
};

const CreateHandler = () => {
  const triggers = [];

  const add = ({ pattern, action, id = false }) => {
    triggers.push(CreateTrigger({ pattern, action, id }));
  };

  const remove = (id) => {
    let index = this.actions.findIndex((e) => e.id === id);
    if (index >= 0) {
      this._actions.splice(index, 1);
    } else if (Number.isInteger(id)) {
      this._actions.splice(id, 1);
    }
  };

  const process = (text) => {
    for (let trigger of triggers) {
      if (!trigger.enabled) {
        continue;
      }

      let args = text.match(trigger.pattern);
      if (args) {
        trigger.action(args);
      }
    }
  };

  return {
    triggers: triggers,
    add: add,
    remove: remove,
    process: process,
  };
};
window.nexaction = {
  triggers: CreateHandler(),
  aliases: CreateHandler(),
};
