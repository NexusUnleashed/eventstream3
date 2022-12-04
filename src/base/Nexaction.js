/* global globalThis */

const CreateTrigger = ({ re, action, id, group, enabled, once, duration }) => {
  if (duration) {
    setTimeout(() => {
      console.log("remove");
    }, duration);
  }
  let triggerId = '';
  if (id) {
    triggerId = id;
  } else if (action.name) {
    triggerId = action.name;
  } else {
    triggerId = re.source;
  }

  return {
    re: re,
    action: action,
    id: triggerId,
    group: group,
    enabled: enabled,
    once: once,
  };
};

const CreateHandler = () => {
  const patterns = [];

  const add = ({
    re,
    action,
    id = false,
    group = false,
    enabled = true,
    once = false,
    duration = false,
  }) => {
    patterns.push(
      CreateTrigger({ re, action, id, group, enabled, once, duration })
    );
  };

  const remove = (id) => {
    if (typeof id === "string") {
      let index = patterns.findIndex((e) => e.id === id);
      if (index >= 0) {
        patterns.splice(index, 1);
      }
    } else if (Number.isInteger(id)) {
      patterns.splice(id, 1);
    } else if (id instanceof RegExp) {
      let index = patterns.findIndex((e) => e.pattern.source === id.source);
      if (index >= 0) {
        patterns.splice(index, 1);
      }
    }
  };

  const process = (text) => {
    for (let pattern of patterns) {
      if (!pattern.enabled) {
        continue;
      }

      let args = text.match(pattern.re);
      if (args) {
        try {
          pattern.action(args);
        } catch (error) {
          console.log(pattern?.group);
          console.log(pattern.re);
          console.log(error);
        }

        if (pattern.once) {
          remove(pattern.id ?? pattern.re);
        }
      }
    }
  };

  return {
    triggers: patterns,
    add: add,
    remove: remove,
    process: process,
  };
};

globalThis.nexAction = {
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
