export const nexSkills = [
    {
        id: "warp",
        firstPerson:
          /^You reach out and clench a fist before (?<target>.+?), who screams and doubles over in agony as \w+ skin suddenly bubbles with gangrenous growths\.$/,
        secondPerson: false,
        thirdPerson:
          /^(?<user>\w+?) reaches out and clenches a fist before (?<target>.+?), who screams and doubles over in agony as \w+ skin suddenly bubbles with gangrenous growths\.$/,
        profession: "occultist",
        skill: "occultism",
        balance: "equilibrium",
        afflictions: [],
        length: 3.0,
      },
  {
    id: "gut",
    firstPerson:
      /^You rip into (?<target>.+?) with your massive, deadly claws\.$/,
    secondPerson: false,
    thirdPerson:
      /^(?<user>\w+?) rips into (?<target>.+?) with \w+ massive, deadly claws\.$/,
    profession: "dragon",
    skill: "dragoncraft",
    balance: "balance",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "incantation",
    firstPerson:
      /^Drawing from the well of your puissance, you invoke a dramatic chant in the dragon tongue. Your voice resonates with each word, culminating in a wave of magical energy that you bend to your will and thrust towards (?<target>.+), bombarding \w+ with the ancient power\.$/,
    secondPerson: false,
    thirdPerson:
      /^A resonant vibration emanates from (?<user>\w+) as \w+ invokes a rumbling, sonorous chant in the dragon tongue. As the sound increases, (?<target>.+) jerks violently, \w+ body wracked by an unseen force\.$/,
    profession: "dragon",
    skill: "dragoncraft",
    balance: "equilibrium",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "glaciate",
    firstPerson:
      /^You breathe a column of icy air at (?<target>.+)'s head, stunning \w+\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: ["stun"],
    length: 3.0,
  },
  {
    id: "frostrive",
    firstPerson:
      /^(?<target>.+)'s translucent shield cracks and fades away as you breathe an icy blast at it\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "override",
    firstPerson:
      /^You barrel into (?<target>.+) and knock \w+ to the ground before stomping over \w+ prone form\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "tailsmash",
    firstPerson:
      /^You flick your tail at (?<target>.+), dismissively brushing aside the paltry shield protecting \w+\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "ague",
    firstPerson:
      /^You let loose a steady stream of cold air around (?<target>.+), who begins to shiver uncontrollably\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "dragonchill",
    firstPerson:
      /^You form small chunks of ice in your enormous maw, then spit them at (?<target>.+) in a barrage\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "dragonchill",
    firstPerson: /^You breathe a wave of icy air at (?<target>.+)\.$/,
    secondPerson: false,
    thirdPerson: false,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
  {
    id: "corrode",
    firstPerson: false,
    secondPerson: false,
    thirdPerson:
      /^(?<user>\w+) opens \w+ gigantic maw and spews acid on (?<target>.+)\. \w+ is too clumsy to dodge and is covered in the corrosive slime\.$/,
    profession: "dragon",
    skill: "attainment",
    balance: "battlerage",
    afflictions: [],
    length: 3.0,
  },
];

const checkSkills = (line) => {
  const text = line;
  let result = false;

  for (let i = 0; i < nexSkills.length; i++) {
    const element = nexSkills[i];
    const checks = [];
    if (
      element.profesion === GMCP.Char.Status.class ||
      GMCP.Char.Status.class.toLowerCase().indexOf(element.profession)
    ) {
      checks.push(element.firstPerson);
    }
    checks.push(element.secondPerson, element.thirdPerson);

    for (const check of checks) {
      result = text.match(check);
      if (result) {
        break;
      }
    }

    if (result) {
      result.groups.skill = element.id;
      eventStream.raiseEvent("nexSkillMatch", {
        matches: result,
        skill: element,
      });
      break;
    }
  }

  return result ? result : false;
};

const nexSkillEvent = (args) => {
    console.log(args);
    console.log(`${args.matches.groups.user||'Self'} - ${args.skill.id} - ${args.matches.groups.target || 'Self'}`);
    nexGui.msg.actionMsg((args.matches.groups.user||'Self'), args.skill.id, (args.matches.groups.target || 'Self'));
}
eventStream.removeListener('nexSkillMatch', 'nexSkillEvent');
eventStream.registerEvent('nexSkillMatch', nexSkillEvent);