/* global globalThis */

const CreateTrigger = ({
  pattern,
  action,
  id,
  group,
  enabled,
  once,
  duration,
}) => {
  if (duration) {
    setTimeout(() => {
      console.log("remove");
    }, duration);
  }
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
    id = action.name,
    group = false,
    enabled = true,
    once = false,
    duration = false,
  }) => {
    triggers.push(CreateTrigger({ pattern, action, id, group, enabled, once, duration }));
  };

  const remove = (id) => {
    if (typeof id === "string") {
      let index = triggers.findIndex((e) => e.id === id);
      if (index >= 0) {
        triggers.splice(index, 1);
      }
    } else if (Number.isInteger(id)) {
      triggers.splice(id, 1);
    } else if (id instanceof RegExp) {
      let index = triggers.findIndex((e) => e.pattern.source === id.source);
      if (index >= 0) {
        triggers.splice(index, 1);
      }
    }
  };

  const process = (text) => {
    for (let trigger of triggers) {
      if (!trigger.enabled) {
        continue;
      }

      let args = text.match(trigger.pattern);
      if (args) {
        try {
          trigger.action(args);
        } catch (error) {
          console.log(trigger?.group);
          console.log(trigger.pattern);
          console.log(error);
        }

        if (trigger.once) {
          remove(trigger.id ?? trigger.pattern);
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

globalThis.nexaction = {
  triggers: CreateHandler(),
  aliases: CreateHandler(),
};

/*
{
  pattern: /^You're not currently traversing to any location\.$/,
  action: () => {
    if (nexmap.walker.pathing) {
      nexusclient.current_line.gag = true;
    }
  },
}
*/
