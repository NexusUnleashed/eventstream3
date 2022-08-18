let Action = class {
  constructor(pattern, action, id = action.name) {
      this._pattern = pattern;
      this._action = action;
      this._id = id ?? pattern.source;
      this._enabled = true;
  }
  get pattern() { return this._pattern; }
  get action() { return this._action; }
  get id() { return this._id; }
  get enabled() { return this._enabled; }
  enable(tf) {
      if (tf) { this._enabled = true; }
      else { this._enabled = false; }
  }
};

class Nexaction {
  constructor() {
      this._actions = [];
  }

  get actions() {
      return this._actions;
  }

  handler(text) {
      for (let act of this._actions) {
          if (!act.enabled) { continue; }

          let args = text.match(act.pattern);
          if (args) {
              act.action(args);
          }
      }
  }

  add(pattern, action, id = false) {
      this._actions.push(new Action(pattern, action, id));
  }

  remove(id) {
      let index = this.actions.findIndex(e => e.id === id);
      if (index >= 0) {
          this._actions.splice(index, 1);
      } else if (Number.isInteger(id)) {
          this._actions.splice(id, 1);
      }
  }
}
window.nexaction = {
  triggers: new Nexaction(),
  aliases: new Nexaction(),
};