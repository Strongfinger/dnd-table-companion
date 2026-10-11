// Real character from the DM's table, used to check the rules engine against a paper sheet.
// Test data only: never import this from app/UI code (it must not ship in the app).
// Non-SRD options (Variant Human, Soldier, Alert) are stored as plain text only.

export const boom = {
  name: 'Boom',
  player: 'Boom',
  className: 'Fighter',
  level: 2,
  race: 'Variant Human', // non-SRD
  background: 'Soldier', // non-SRD
  scores: { str: 17, dex: 13, con: 14, int: 8, wis: 10, cha: 13 },
  hp: { max: 19, method: 'rolled', laterLevelRolls: [5] }, // level 2: rolled 5 on d10
  armor: 'Chain Mail',
  ac: 16,
  speed: 30,
  saveProficiencies: ['str', 'con'],
  skillProficiencies: ['Athletics', 'Insight', 'Intimidation', 'Persuasion'],
  feats: ['Alert'], // non-SRD: +5 initiative
  fightingStyle: 'Great Weapon Fighting',
  features: ['Fighting Style', 'Second Wind', 'Action Surge'],
  weapons: [{ name: 'Greatsword', damage: '2d6', damageType: 'slashing', ability: 'str', proficient: true }],
} as const
