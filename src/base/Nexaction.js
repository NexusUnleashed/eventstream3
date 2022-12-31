/* global globalThis */
import crypto from "crypto";

const CreateTrigger = ({
  regex,
  action,
  id,
  group,
  enabled,
  once,
  duration,
}) => {
  if (duration) {
    setTimeout(() => {
      globalThis.nexAction.triggers.remove(id);
    }, duration);
  }
  let reflexId = "";
  if (id) {
    reflexId = id;
  } else if (action.name !== "action") {
    reflexId = action.name;
  } else {
    reflexId = regex.source;
  }

  return {
    regex: regex,
    action: action,
    id: reflexId,
    group: group,
    enabled: enabled,
    once: once,
  };
};

const CreateHandler = () => {
  const reflexes = [];

  const add = ({
    regex,
    action,
    id = crypto.randomUUID(),
    group = false,
    enabled = true,
    once = false,
    duration = false,
  }) => {
    reflexes.push(
      CreateTrigger({ regex, action, id, group, enabled, once, duration })
    );
  };

  const remove = (id) => {
    if (typeof id === "string") {
      let index = reflexes.findIndex((e) => e.id === id);
      if (index >= 0) {
        reflexes.splice(index, 1);
      }
    } else if (Number.isInteger(id)) {
      reflexes.splice(id, 1);
    } else if (id instanceof RegExp) {
      let index = reflexes.findIndex((e) => e.reflex.source === id.source);
      if (index >= 0) {
        reflexes.splice(index, 1);
      }
    }
  };

  const process = (text) => {
    for (let reflex of reflexes) {
      if (reflex.enabled === false) {
        continue;
      }

      let args = text.match(reflex.regex);
      if (args) {
        try {
          reflex.action(args);
        } catch (error) {
          console.log(reflex?.group);
          console.log(reflex.regex);
          console.log(error);
        }

        if (reflex.once) {
          remove(reflex.id ?? reflex.regex);
        }
      }
    }
  };

  const clear = () => {
    reflexes.length = 0;
  };

  const enable = (id, group = true) => {
    if (group) {
      reflexes.filter((e) => e.group === id).forEach((e) => (e.enabled = true));
    } else {
      reflexes.filter((e) => e.id === id).forEach((e) => (e.enabled = true));
    }
  };

  const disable = (id, group = true) => {
    if (group) {
      reflexes
        .filter((e) => e.group === id)
        .forEach((e) => (e.enabled = false));
    } else {
      reflexes.filter((e) => e.id === id).forEach((e) => (e.enabled = false));
    }
  };

  return {
    reflexes: reflexes,
    add: add,
    remove: remove,
    process: process,
    clear: clear,
    enable: enable,
    disable: disable,
  };
};

globalThis.nexAction = {
  triggers: CreateHandler(),
  aliases: CreateHandler(),
};

/*
{
  reflex: /^You're not currently traversing to any location\.$/,
  action: () => {
    if (nexmap.walker.pathing) {
      nexusclient.current_line.gag = true;
    }
  },
}
*/
