const CreateTrigger = ({
  pattern,
  action,
  id = action.name,
  group = false,
  enabled = true,
  once = false,
}) => {
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

  const add = ({
    pattern,
    action,
    id = false,
    group = false,
    enabled = true,
    once = false,
  }) => {
    triggers.push(CreateTrigger({ pattern, action, id, group, enabled, once }));
  };

  const remove = (id) => {
    let index = triggers.findIndex((e) => e.id === id);
    if (index >= 0) {
      triggers.splice(index, 1);
    } else if (Number.isInteger(id)) {
      triggers.splice(id, 1);
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
        if (trigger.once) {
          remove(trigger.id ?? trigger.pattern.source)
        }
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
