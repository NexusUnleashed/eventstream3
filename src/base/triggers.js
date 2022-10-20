/* global nexmap, nexusclient */
export const triggers = [
  {
    pattern: /^You're not currently traversing to any location\.$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^You are already there!$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^You cease your movement\.$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^Carefully getting your bearings, you set off \w+ toward your goal\.$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^You have arrived at your destination!$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^You are already traversing to a location. If you wish to cancel your movement, please CLICK HERE.$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^Now now, don't be so hasty!$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
  {
    pattern: /^YYou stumble slightly as you abruptly decide to stop walking towards your goal.$/,
    action: () => {
      if (nexmap.walker.pathing) { nexusclient.current_line.gag = true; }
    }
  },
]

const fishingTriggers = [
  {
    group: 'nexfish',
    pattern: /^You feel a fish nibbling on your hook\.$/,
    action: (args) => {
      setTimeout(() => {
        nexSys.EqBalQueue.prepend(`tease line`);
      }, 2100);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^(You stagger as a fish makes a large strike at your bait\.|You see the water ripple as a fish makes a medium strike at your bait\.|You feel a fish make a small strike at your bait\.)$/,
    action: (args) => {
      setTimeout(() => {
        nexSys.EqBalQueue.prepend(`jerk pole`);
      }, 1700);
    },
  },
  {
    group: 'nexfish',
    pattern: /^Relaxing the tension on your line, you are able to reel again.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`reel line`);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^You carefully thread a hunk of octopus onto the hook of a simple fishing pole.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`cast line ${fishingDir}`);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^You quickly jerk back your fishing pole and feel the line go taut\./,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`reel line`);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^Throwing away your existing bait, you carefully thread a hunk of octopus onto the hook of a simple fishing pole\.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`cast line ${fishingDir}`);
    },
  },
  {
    group: 'nexfish',
    pattern: /^The fishing line catches on a sharp rock and is cut\.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`get hunk from bucket|bait hook with hunk`);
    },
  },
  {
    group: 'nexfish',
    pattern: /^Your line fouls and you lose your bait.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`get hunk from bucket|bait hook with hunk`);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^(You reel in the last bit of line and your struggle is over\.|With a final tug, you finish reeling in the line and land)$/,
    action: (args) => {
      //send_direct(`${fishingDir}|survey`);
      nexMap.aliases.goto(fishingTarget);
      nexSys.eventStream.removeListener(
        "nexMapPathingComplete",
        "fishingCheck"
      );
      let fishingCheck = function () {
        send_direct(`survey`);
        nexSys.eventStream.removeListener(
          "nexMapPathingComplete",
          "fishingCheck"
        );
      };
      nexSys.eventStream.registerEvent("nexMapPathingComplete", fishingCheck);
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^You have already cast your line. Reel it before you cast again\.$/,
    action: (args) => {},
  },
  {
    group: 'nexfish',
    pattern:
      /^You discern that you are in the fathomless expanse of the World Tree\.$/,
    action: (args) => {
      nexSys.eventStream.removeListener(
        "nexMapPathingComplete",
        "fishingCheck"
      );
      let fishingCheck = function () {
        nexSys.EqBalQueue.prepend(`get hunk from bucket|bait hook with hunk`);
        nexSys.eventStream.removeListener(
          "nexMapPathingComplete",
          "fishingCheck"
        );
      };

      if (current_block.at(-3).line.match(/fish /)) {
        nexMap.aliases.goto(fishingRoom);
        nexSys.eventStream.registerEvent("nexMapPathingComplete", fishingCheck);
      } else {
        printHTML('<span style="font-size:24px">ROOM IS FISHED OUT.</span>');
      }
    },
  },
  {
    group: 'nexfish',
    pattern:
      /^Slippery flora causes you to lose your footing, sending you tumbling down the savage current\.$/,
    action: (args) => {},
  },
  {
    group: 'nexfish',
    pattern:
      /^As the fish strains your line beyond its breaking point, it snaps suddenly, costing you your fish and bait\.$/,
    action: (args) => {
      nexSys.EqBalQueue.prepend(`get hunk from bucket|bait hook with hunk`);
    },
  },
  /*{
    pattern: /^$/,
    action: (args) => {

    }
  },*/
];