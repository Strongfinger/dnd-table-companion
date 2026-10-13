// Tables (and two small stat blocks) inside the SRD 5.2.1 magic item texts, written out by hand from the official
// PDF, one row per line, cells split by " | ". The PDF's text puts table cells in the wrong order (two-column
// tables side by side, cells broken over lines), so scripts/srd/magic-items.mjs swaps each table's lines for
// these rows.
//
// Per item id, a list of:
//   { from, to, rows }  the PDF lines from the first `from` to the last `to` (exact lines, spaces trimmed)
//                       become `rows`;
//                       magic-items.mjs checks the rows use the same words as the lines they replace
//   { after, rows }     the rows are added after the line `after` (a table the PDF prints on another page)
//   check: false        skip that check (stat blocks, where the MOD and SAVE column headers are left out)

const rollTable = (header, rows) => [header, ...rows]

const DAMAGE_TYPES = [
  '1d10 | Damage Type',
  '1 | Acid', '2 | Cold', '3 | Fire', '4 | Force', '5 | Lightning',
  '6 | Necrotic', '7 | Poison', '8 | Psychic', '9 | Radiant', '10 | Thunder',
]
const damageTypeTable = { from: '1d10 Damage Type 1d10 Damage Type', to: '5 Lightning 10 Thunder', rows: DAMAGE_TYPES }

const spellTable = (from, to, rows) => ({ from, to, rows: ['Spell | Charge Cost', ...rows] })

export const TABLES = {
  'ammunition-of-slaying': [{
    from: '1d100 Creature Type 1d100 Creature Type', to: '46–50 Humanoids 91–00 Undead',
    rows: rollTable('1d100 | Creature Type', [
      '01–10 | Aberrations', '11–15 | Beasts', '16–20 | Celestials', '21–25 | Constructs', '26–35 | Dragons',
      '36–45 | Elementals', '46–50 | Humanoids', '51–60 | Fey', '61–70 | Fiends', '71–75 | Giants',
      '76–80 | Monstrosities', '81–85 | Oozes', '86–90 | Plants', '91–00 | Undead',
    ]),
  }],
  'amulet-of-the-planes': [{
    from: '1d100 Destination', to: '91–00 Random location on the Astral Plane',
    rows: rollTable('1d100 | Destination', [
      '01–60 | Random location on the plane you named',
      '61–70 | Random location on an Inner Plane determined by rolling 1d6: on a 1, the Plane of Air; on a 2, the Plane of Earth; on a 3, the Plane of Fire; on a 4, the Plane of Water; on a 5, the Feywild; on a 6, the Shadowfell',
      '71–80 | Random location on an Outer Plane determined by rolling 1d8: on a 1, Arborea; on a 2, Arcadia; on a 3, the Beastlands; on a 4, Bytopia; on a 5, Elysium; on a 6, Mechanus; on a 7, Mount Celestia; on an 8, Ysgard',
      '81–90 | Random location on an Outer Plane determined by rolling 1d8: on a 1, the Abyss; on a 2, Acheron; on a 3, Carceri; on a 4, Gehenna; on a 5, Hades; on a 6, Limbo; on a 7, the Nine Hells; on an 8, Pandemonium',
      '91–00 | Random location on the Astral Plane',
    ]),
  }],
  'apparatus-of-the-crab': [{
    after: 'Levers table.',
    rows: [
      'Apparatus of the Crab Levers',
      'Lever | Up | Down',
      "1 | Legs extend, allowing the apparatus to walk and swim. | Legs retract, reducing the apparatus's Speed and Swim Speed to 0 and making it unable to benefit from bonuses to speed.",
      '2 | Forward window shutter opens. | Forward window shutter closes.',
      '3 | Side window shutters open (two per side). | Side window shutters close (two per side).',
      '4 | Two claws extend from the front side of the apparatus. | The claws retract.',
      '5 | Each extended claw makes the following melee attack: +8 to hit, reach 5 ft. Hit: 7 (2d6) Bludgeoning damage. | Each extended claw makes the following melee attack: +8 to hit, reach 5 ft. Hit: The target has the Grappled condition (escape DC 15).',
      '6 | The apparatus walks or swims forward provided its legs are extended. | The apparatus walks or swims backward provided its legs are extended.',
      '7 | The apparatus turns 90 degrees counterclockwise provided its legs are extended. | The apparatus turns 90 degrees clockwise provided its legs are extended.',
      '8 | Eyelike fixtures emit Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. | The light turns off.',
      "9 | The apparatus sinks up to 20 feet if it's in liquid. | The apparatus rises up to 20 feet if it's in liquid.",
      '10 | The rear hatch unseals and opens. | The rear hatch closes and seals.',
    ],
  }],
  'armor-of-resistance': [
    damageTypeTable,
    // The Apparatus of the Crab Levers table is printed here, at the top of the next page (moved to its item).
    { from: 'Apparatus of the Crab Levers', to: '10 The rear hatch unseals and opens. The rear hatch closes and seals.', rows: [], check: false },
  ],
  'bag-of-beans': [{
    from: '1d100 Effect', to: 'of existence.',
    rows: rollTable('1d100 | Effect', [
      '01 | 5d4 toadstools sprout. If a creature eats a toadstool, roll any die. On an odd roll, the eater must succeed on a DC 15 Constitution saving throw or take 5d6 Poison damage and have the Poisoned condition for 1 hour. On an even roll, the eater gains 5d6 Temporary Hit Points for 1 hour.',
      "02–10 | A geyser erupts and spouts water, beer, mayonnaise, tea, vinegar, wine, or oil (GM's choice) 30 feet into the air for 1d4 minutes.",
      '11–20 | A Treant sprouts. Roll any die. On an odd roll, the treant is Chaotic Evil. On an even roll, the treant is Chaotic Good.',
      '21–30 | An animate but immobile stone statue in your likeness rises and makes verbal threats against you. If you leave it and others come near, it describes you as the most heinous of villains and directs the newcomers to find and attack you. If you are on the same plane of existence as the statue, it knows where you are. The statue becomes inanimate after 24 hours.',
      '31–40 | A campfire with green flames springs forth and burns for 24 hours or until it is extinguished.',
      '41–50 | Three Shrieker Fungi sprout.',
      "51–60 | 1d4 + 4 bright-pink toads crawl forth. Whenever a toad is touched, it transforms into a Large or smaller monster of the GM's choice that acts in accordance with its alignment and nature. The monster remains for 1 minute, then disappears in a puff of bright-pink smoke.",
      '61–70 | A hungry Bulette burrows up and attacks.',
      '71–80 | A fruit tree grows. It has 1d10 + 20 fruit, 1d8 of which act as randomly determined potions. The tree vanishes after 1 hour. Picked fruit remains, retaining any magic for 30 days.',
      '81–90 | A nest of 1d4 + 3 rainbow-colored eggs springs up. Any creature that eats an egg makes a DC 20 Constitution saving throw. On a successful save, a creature permanently increases its lowest ability score by 1, randomly choosing among equally low scores. On a failed save, the creature takes 10d6 Force damage from an internal explosion.',
      "91–95 | A pyramid with a 60-foot-square base bursts upward. Inside is a burial chamber containing a Mummy, a Mummy Lord, or some other Undead of the GM's choice. Its sarcophagus contains treasure of the GM's choice.",
      "96–00 | A giant beanstalk sprouts, growing to a height of the GM's choice. The top leads where the GM chooses, such as to a great view, a cloud giant's castle, or another plane of existence.",
    ]),
  }],
  'bag-of-tricks': [{
    from: 'Gray Bag of Tricks', to: '4 Axe Beak 8 Tiger',
    rows: [
      'Gray Bag of Tricks',
      '1d8 | Creature',
      '1 | Weasel', '2 | Giant Rat', '3 | Badger', '4 | Boar', '5 | Panther', '6 | Giant Badger', '7 | Dire Wolf', '8 | Giant Elk',
      'Rust Bag of Tricks',
      '1d8 | Creature',
      '1 | Rat', '2 | Owl', '3 | Mastiff', '4 | Goat', '5 | Giant Goat', '6 | Giant Boar', '7 | Lion', '8 | Brown Bear',
      'Tan Bag of Tricks',
      '1d8 | Creature',
      '1 | Jackal', '2 | Ape', '3 | Baboon', '4 | Axe Beak', '5 | Black Bear', '6 | Giant Weasel', '7 | Giant Hyena', '8 | Tiger',
    ],
  }],
  'belt-of-giant-strength': [{
    from: 'Belt Str. Rarity', to: 'Belt of Giant Strength (storm) 29 Legendary',
    rows: [
      'Belt | Str. | Rarity',
      'Belt of Giant Strength (hill) | 21 | Rare',
      'Belt of Giant Strength (frost or stone) | 23 | Very Rare',
      'Belt of Giant Strength (fire) | 25 | Very Rare',
      'Belt of Giant Strength (cloud) | 27 | Legendary',
      'Belt of Giant Strength (storm) | 29 | Legendary',
    ],
  }],
  'candle-of-invocation': [{
    from: '1d100 Outer Plane 1d100 Outer Plane', to: '47–54 Elysium 96–00 Ysgard',
    rows: rollTable('1d100 | Outer Plane', [
      '01–05 | Abyss', '06–10 | Acheron', '11–17 | Arborea', '18–25 | Arcadia', '26–33 | Beastlands', '34–41 | Bytopia',
      '42–46 | Carceri', '47–54 | Elysium', '55–59 | Gehenna', '60–64 | Hades', '65–69 | Limbo', '70–77 | Mechanus',
      '78–85 | Mount Celestia', '86–90 | Nine Hells', '91–95 | Pandemonium', '96–00 | Ysgard',
    ]),
  }],
  'carpet-of-flying': [{
    from: '1d100 Size Capacity Fly Speed', to: '81–00 6 ft. × 9 ft. 800 lb. 30 feet',
    rows: rollTable('1d100 | Size | Capacity | Fly Speed', [
      '01–20 | 3 ft. × 5 ft. | 200 lb. | 80 feet',
      '21–55 | 4 ft. × 6 ft. | 400 lb. | 60 feet',
      '56–80 | 5 ft. × 7 ft. | 600 lb. | 40 feet',
      '81–00 | 6 ft. × 9 ft. | 800 lb. | 30 feet',
    ]),
  }],
  'cube-of-force': [{
    from: 'Cube of Force Faces', to: 'Wall of Force 5',
    rows: [
      'Cube of Force Faces', 'Spell | Charge Cost',
      'Mage Armor | 1', 'Shield | 1', 'Tiny Hut | 3', 'Private Sanctum | 4', 'Resilient Sphere | 4', 'Wall of Force | 5',
    ],
  }],
  'deck-of-illusions': [{
    from: 'Deck of Illusions', to: '“Monsters.”',
    rows: [
      'Deck of Illusions',
      '1d100 | Illusion*',
      '01–03 | Adult Red Dragon', '04–06 | Archmage', '07–09 | Assassin', '10–12 | Bandit Captain', '13–15 | Basilisk',
      '16–18 | Berserker', '19–21 | Bugbear Warrior', '22–24 | Cloud Giant', '25–27 | Druid', '28–30 | Erinyes',
      '31–33 | Ettin', '34–36 | Fire Giant', '37–39 | Frost Giant', '40–42 | Gnoll Warrior', '43–45 | Goblin Warrior',
      '46–48 | Guardian Naga', '49–51 | Hill Giant', '52–54 | Hobgoblin Warrior', '55–57 | Incubus', '58–60 | Iron Golem',
      '61–63 | Knight', '64–66 | Kobold Warrior', '67–69 | Lich', '70–72 | Medusa', '73–75 | Night Hag', '76–78 | Ogre',
      '79–81 | Oni', '82–84 | Priest', '85–87 | Succubus', '88–90 | Troll', '91–93 | Veteran Warrior', '94–96 | Wyvern',
      '97–00 | The card drawer',
      '*Stat blocks for these creatures (except the card drawer) appear in "Monsters."',
    ],
  }],
  'dragon-scale-mail': [{
    from: 'Dragon Resistance Dragon Resistance', to: 'Copper Acid White Cold',
    rows: [
      'Dragon | Resistance',
      'Black | Acid', 'Blue | Lightning', 'Brass | Fire', 'Bronze | Lightning', 'Copper | Acid',
      'Gold | Fire', 'Green | Poison', 'Red | Fire', 'Silver | Cold', 'White | Cold',
    ],
  }],
  'efreeti-bottle': [{
    from: '1d10 Effect', to: 'loses its magic.',
    rows: rollTable('1d10 | Effect', [
      '1 | The efreeti attacks you. After fighting for 5 rounds, the efreeti disappears, and the bottle loses its magic.',
      "2–9 | The efreeti understands your languages and obeys your commands for 1 hour, after which it returns to the bottle, and a new stopper contains it. The stopper can't be removed for 24 hours. The next two times the bottle is opened, the same effect occurs. If the bottle is opened a fourth time, the efreeti escapes and disappears, and the bottle loses its magic.",
      '10 | The efreeti understands your languages and can cast Wish once for you. It disappears when it grants the wish or after 1 hour, and the bottle loses its magic.',
    ]),
  }],
  'elemental-gem': [{
    from: 'Gem Summoned Elemental', to: 'Yellow diamond Earth Elemental',
    rows: [
      'Gem | Summoned Elemental',
      'Blue sapphire | Air Elemental', 'Emerald | Water Elemental', 'Red corundum | Fire Elemental', 'Yellow diamond | Earth Elemental',
    ],
  }],
  'feather-token': [{
    from: 'Feather Tokens', to: '91–00 Whip Rare',
    rows: [
      'Feather Tokens',
      '1d100 | Token | Rarity',
      '01–20 | Anchor | Uncommon', '21–35 | Bird | Rare', '36–50 | Fan | Uncommon',
      '51–65 | Swan boat | Rare', '66–90 | Tree | Uncommon', '91–00 | Whip | Rare',
    ],
  }],
  'figurine-of-wondrous-power': [{
    from: 'Giant Fly', to: 'CR 0 (XP 0; PB +2)',
    rows: [
      'Giant Fly',
      'Large Beast, Unaligned',
      'AC 11 | Initiative +1 (11)',
      'HP 19 (3d10 + 3)',
      'Speed 30 ft., Fly 60 ft.',
      'Str 14 (+2, save +2) | Dex 13 (+1, save +1) | Con 13 (+1, save +1)',
      'Int 2 (−4, save −4) | Wis 10 (+0, save +0) | Cha 3 (−4, save −4)',
      'Senses Darkvision 60 ft., Passive Perception 10',
      'Languages None',
      'CR 0 (XP 0; PB +2)',
    ],
    check: false,
  }],
  'horn-of-valhalla': [{
    from: '1d100 Horn Type Spirits Requirement', to: 'Martial weapons',
    rows: rollTable('1d100 | Horn Type | Spirits | Requirement', [
      '01–40 | Silver | 2 | None',
      '41–75 | Brass | 3 | Proficiency with all Simple weapons',
      '76–90 | Bronze | 4 | Training with all Medium armor',
      '91–00 | Iron | 5 | Proficiency with all Martial weapons',
    ]),
  }],
  'manual-of-golems': [{
    from: '1d20 Golem Time Cost', to: '19–20 Stone Golem 90 days 80,000 GP',
    rows: rollTable('1d20 | Golem | Time | Cost', [
      '1–5 | Clay Golem | 30 days | 65,000 GP',
      '6–17 | Flesh Golem | 60 days | 50,000 GP',
      '18 | Iron Golem | 120 days | 100,000 GP',
      '19–20 | Stone Golem | 90 days | 80,000 GP',
    ]),
  }],
  'mysterious-deck': [
    {
      from: 'Mysterious Deck', to: '97–00 97–00 Void',
      rows: [
        'Mysterious Deck',
        '1d100 (13-Card Deck) | 1d100 (22-Card Deck) | Card',
        '— | 01–05 | Balance', '— | 06–10 | Comet', '— | 11–14 | Donjon', '01–08 | 15–18 | Euryale', '— | 19–23 | Fates',
        '09–16 | 24–27 | Flames', '— | 28–31 | Fool', '— | 32–36 | Gem', '17–24 | 37–41 | Jester', '25–32 | 42–46 | Key',
        '33–40 | 47–51 | Knight', '41–48 | 52–56 | Moon', '— | 57–60 | Puzzle', '49–56 | 61–64 | Rogue', '57–64 | 65–68 | Ruin',
        '— | 69–73 | Sage', '65–72 | 74–77 | Skull', '73–80 | 78–82 | Star', '81–88 | 83–87 | Sun', '— | 88–91 | Talons',
        '89–96 | 92–96 | Throne', '97–00 | 97–00 | Void',
      ],
    },
    {
      from: 'Avatar of Death', to: 'Necrotic damage.',
      rows: [
        'Avatar of Death',
        'Medium Undead, Neutral evil',
        'AC 20 | Initiative +3 (13)',
        'HP Half the HP maximum of its summoner',
        'Speed 60 ft., Fly 60 ft. (hover)',
        'Str 16 (+3, save +3) | Dex 16 (+3, save +3) | Con 16 (+3, save +3)',
        'Int 16 (+3, save +3) | Wis 16 (+3, save +3) | Cha 16 (+3, save +3)',
        'Immunities Necrotic, Poison; Charmed, Exhaustion, Frightened, Paralyzed, Petrified, Poisoned, Unconscious',
        'Senses Truesight 60 ft., Passive Perception 13',
        'Languages All languages known to its summoner',
        "CR None (XP 0; PB equals its summoner's)",
        'Traits',
        'Incorporeal Movement. The avatar can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.',
        'Actions',
        "Multiattack. The avatar makes a number of Reaping Scythe attacks equal to half the summoner's Proficiency Bonus (rounded up).",
        'Reaping Scythe. Melee Attack Roll: Automatic hit, reach 5 ft. Hit: 7 (1d8 + 3) Slashing damage plus 4 (1d8) Necrotic damage.',
      ],
      check: false,
    },
  ],
  'necklace-of-prayer-beads': [{
    from: '1d20 Bead Spell', to: 'Wind Walk',
    rows: rollTable('1d20 | Bead | Spell', [
      '1–6 | Bead of Blessing | Bless',
      '7–12 | Bead of Curing | Cure Wounds (level 2 version)',
      '13–16 | Bead of Favor | Greater Restoration',
      '17–18 | Bead of Smiting | Shining Smite',
      '19 | Bead of Summons | Guardian of Faith',
      '20 | Bead of Wind Walking | Wind Walk',
    ]),
  }],
  'potion-of-giant-strength': [{
    from: 'Potion Str. Rarity', to: 'Potion of Giant Strength (storm) 29 Legendary',
    rows: [
      'Potion | Str. | Rarity',
      'Potion of Giant Strength (hill) | 21 | Uncommon',
      'Potion of Giant Strength (frost or stone) | 23 | Rare',
      'Potion of Giant Strength (fire) | 25 | Rare',
      'Potion of Giant Strength (cloud) | 27 | Very Rare',
      'Potion of Giant Strength (storm) | 29 | Legendary',
    ],
  }],
  'potions-of-healing': [{
    from: 'Potion HP Regained Rarity', to: '10d4 + 20 Very Rare',
    rows: [
      'Potion | HP Regained | Rarity',
      'Potion of Healing | 2d4 + 2 | Common',
      'Potion of Healing (greater) | 4d4 + 4 | Uncommon',
      'Potion of Healing (superior) | 8d4 + 8 | Rare',
      'Potion of Healing (supreme) | 10d4 + 20 | Very Rare',
    ],
  }],
  'potion-of-resistance': [damageTypeTable],
  'ring-of-elemental-command': [{
    from: 'Plane Spells (Charges)', to: '(3 charges), Water Walk (2 charges)',
    rows: [
      'Plane | Spells (Charges)',
      'Air | Chain Lightning (3 charges), Feather Fall (0 charges), Gust of Wind (2 charges), Wind Wall (1 charge)',
      'Earth | Earthquake (5 charges), Stone Shape (2 charges), Stoneskin (3 charges), Wall of Stone (3 charges)',
      'Fire | Burning Hands (1 charge), Fireball (2 charges), Fire Storm (4 charges), Wall of Fire (3 charges)',
      'Water | Create or Destroy Water (1 charge), Ice Storm (2 charges), Tsunami (5 charges), Wall of Ice (3 charges), Water Walk (2 charges)',
    ],
  }],
  'ring-of-resistance': [{
    from: '1d10 Damage Type Gemstone', to: '10 Thunder Spinel',
    rows: rollTable('1d10 | Damage Type | Gemstone', [
      '1 | Acid | Pearl', '2 | Cold | Tourmaline', '3 | Fire | Garnet', '4 | Force | Sapphire', '5 | Lightning | Citrine',
      '6 | Necrotic | Jet', '7 | Poison | Amethyst', '8 | Psychic | Jade', '9 | Radiant | Topaz', '10 | Thunder | Spinel',
    ]),
  }],
  'ring-of-shooting-stars': [{
    from: 'Number of', to: '2 5d4 4 2d4',
    rows: [
      'Number of Spheres | Lightning Damage',
      '1 | 4d12', '2 | 5d4', '3 | 2d6', '4 | 2d4',
    ],
  }],
  'robe-of-useful-items': [{
    from: '1d100 Patch', to: '97–00 Portable Ram',
    rows: rollTable('1d100 | Patch', [
      '01–08 | Bag of 100 GP',
      '09–15 | Silver coffer (1 foot long, 6 inches wide and deep) worth 500 GP',
      '16–22 | Iron door (up to 10 feet wide and 10 feet high, barred on one side of your choice), which you can place in an opening you can reach; it conforms to fit the opening, attaching and hinging itself',
      '23–30 | 10 gems worth 100 GP each',
      '31–44 | Wooden ladder (24 feet long)',
      '45–51 | Riding Horse with a Riding Saddle',
      '52–59 | Open pit (a 10-foot Cube), which you can place on the ground within 10 feet of yourself',
      '60–68 | 4 Potions of Healing',
      '69–75 | Rowboat (12 feet long)',
      '76–83 | Spell Scroll containing one spell of level 1, 2, or 3 (your choice)',
      '84–90 | 2 Mastiffs',
      '91–96 | Window (2 feet by 4 feet, up to 2 feet deep), which you can place on a vertical surface you can reach',
      '97–00 | Portable Ram',
    ]),
  }],
  'spell-scroll': [{
    from: 'Spell Level Rarity Save DC Attack Bonus', to: '9 Legendary 19 +11',
    rows: [
      'Spell Level | Rarity | Save DC | Attack Bonus',
      'Cantrip | Common | 13 | +5', '1 | Common | 13 | +5', '2 | Uncommon | 13 | +5', '3 | Uncommon | 15 | +7',
      '4 | Rare | 15 | +7', '5 | Rare | 17 | +9', '6 | Very Rare | 17 | +9', '7 | Very Rare | 18 | +10',
      '8 | Very Rare | 18 | +10', '9 | Legendary | 19 | +11',
    ],
  }],
  'sphere-of-annihilation': [{
    from: '1d100 Result', to: 'to a random plane of existence.',
    rows: rollTable('1d100 | Result', [
      '01–50 | The sphere is destroyed.',
      '51–85 | The sphere moves through the portal or into the extradimensional space.',
      '86–00 | A spatial rift sends the sphere and each creature and object within 180 feet of the sphere to a random plane of existence.',
    ]),
  }],
  'staff-of-fire': [{
    from: 'Spell', to: 'Fireball 3',
    rows: ['Spell | Charge Cost', 'Burning Hands | 1', 'Fireball | 3', 'Wall of Fire | 4'],
  }],
  'staff-of-frost': [{
    from: 'Spell', to: 'Fog Cloud 1 Wall of Ice 4',
    rows: ['Spell | Charge Cost', 'Cone of Cold | 5', 'Fog Cloud | 1', 'Ice Storm | 4', 'Wall of Ice | 4'],
  }],
  'staff-of-healing': [{
    from: 'Spell Charge Cost', to: 'Mass Cure Wounds 5',
    rows: [
      'Spell | Charge Cost',
      'Cure Wounds | 1 charge per spell level (maximum 4 for a level 4 spell)',
      'Lesser Restoration | 2',
      'Mass Cure Wounds | 5',
    ],
  }],
  'staff-of-power': [spellTable('Spell', 'Wall of Force 5', [
    'Cone of Cold | 5', 'Fireball (level 5 version) | 5', 'Globe of Invulnerability | 6', 'Hold Monster | 5', 'Levitate | 2',
    'Lightning Bolt (level 5 version) | 5', 'Magic Missile | 1', 'Ray of Enfeeblement | 1', 'Wall of Force | 5',
  ])],
  'staff-of-swarming-insects': [spellTable('Spell Charge', 'Insect Plague 5', ['Giant Insect | 4', 'Insect Plague | 5'])],
  'staff-of-the-magi': [{
    ...spellTable('Spell', 'Web 2', [
      'Arcane Lock | 0', 'Conjure Elemental | 7', 'Detect Magic | 0', 'Dispel Magic | 3', 'Enlarge/Reduce | 0',
      'Fireball (level 7 version) | 7', 'Flaming Sphere | 2', 'Ice Storm | 4', 'Invisibility | 2', 'Knock | 2', 'Light | 0',
      'Lightning Bolt (level 7 version) | 7', 'Mage Hand | 0', 'Passwall | 5', 'Plane Shift | 7',
      'Protection from Evil and Good | 0', 'Telekinesis | 5', 'Wall of Fire | 4', 'Web | 2',
    ]),
  }],
  'staff-of-the-woodlands': [spellTable('Spell Charge', 'Wall of Thorns 6', [
    'Animal Friendship | 1', 'Awaken | 5', 'Barkskin | 2', 'Locate Animals or Plants | 2', 'Pass without Trace | 2',
    'Speak with Animals | 1', 'Speak with Plants | 3', 'Wall of Thorns | 6',
  ])],
  'wand-of-binding': [spellTable('Spell Charge', 'Hold Person 2', ['Hold Monster | 5', 'Hold Person | 2'])],
  'wand-of-fear': [spellTable('Spell', 'Fear (60-foot Cone) 3', ['Command ("flee" or "grovel" only) | 1', 'Fear (60-foot Cone) | 3'])],
  'wand-of-wonder': [{
    from: 'Wand of Wonder Effects', to: 'magic.',
    rows: [
      'Wand of Wonder Effects',
      '1d100 | Effect',
      '01–20 | You cast a spell originating from the chosen point. Roll 1d10 to determine the spell: on a 1–2, Darkness; on a 3–4, Faerie Fire; on a 5–6, Fireball; on a 7–8, Slow; on a 9–10, Stinking Cloud.',
      '21–25 | Nothing happens at the chosen point of origin. Instead, you have the Stunned condition until the start of your next turn, believing something awesome just happened.',
      '26–30 | You cast Gust of Wind. The Line created by the spell extends from you to the chosen point of origin.',
      '31–35 | Nothing happens at the chosen point of origin. Instead, you take 1d6 Psychic damage.',
      '36–40 | Heavy rain falls for 1 minute in a 120-foot-high, 60-foot-radius Cylinder centered on the chosen point of origin. During that time, the area of effect is Lightly Obscured.',
      '41–45 | A cloud of 600 oversized butterflies fills a 60-foot-high, 30-foot-radius Cylinder centered on the chosen point of origin. The butterflies remain for 10 minutes, during which time the area of effect is Heavily Obscured.',
      '46–50 | You cast Lightning Bolt. The Line created by the spell extends from you to the chosen point of origin.',
      "51–55 | The creature closest to the chosen point of origin is enlarged as if you had cast Enlarge/Reduce on it. If the target isn't you and can't be affected by that spell, you become the target instead.",
      "56–60 | A magically formed creature appears in an unoccupied space as close to the chosen point of origin as possible. The creature isn't under your control, acts as it normally would, and disappears after 1 hour or when it drops to 0 Hit Points. Roll 1d4 to determine which creature appears. On a 1, a Rhinoceros appears; on a 2, an Elephant appears; and on a 3–4, a Rat appears.",
      "61–64 | Grass covers a 60-foot-radius circle of ground, with the center of that circle as close to the chosen point of origin as possible. Grass that's already there grows to ten times its normal size and remains overgrown for 1 minute.",
      "65–68 | An object of the GM's choice disappears into the Ethereal Plane. The object must be neither worn nor carried, within 120 feet of the chosen point of origin, and no larger than 10 feet in any dimension. If there are no such objects in range, nothing happens.",
      '69–72 | Nothing happens at the chosen point of origin. Instead, you shrink as if you had cast Enlarge/Reduce on yourself and remain in that state for 1 minute.',
      '73–77 | Leaves grow from the creature nearest to the chosen point of origin. Unless they are picked off, the leaves turn brown and fall off after 24 hours.',
      '78–82 | Nothing happens at the chosen point of origin. Instead, a burst of colorful, shimmering light extends from you in a 30-foot Emanation. Each creature in the area must succeed on a DC 15 Constitution saving throw or have the Blinded condition for 1 minute. A creature repeats the save at the end of each of its turns, ending the effect on itself on a success.',
      '83–87 | Nothing happens at the chosen point of origin. Instead, you cast Invisibility on yourself.',
      "88–92 | Nothing happens at the chosen point of origin. Instead, a stream of 1d4 × 10 gems, each worth 1 GP, shoots from the wand's tip in a Line 30 feet long and 5 feet wide toward the chosen point of origin. Each gem deals 1 Bludgeoning damage, and the total damage of the gems is divided equally among all creatures in the Line.",
      "93–97 | You cast Polymorph, targeting the creature closest to the chosen point of origin. Roll 1d4 to determine the target's new form. On a 1, the new form is a Black Bear; on a 2, the new form is a Giant Wasp; on a 3–4, the new form is a Frog.",
      '98–00 | The creature closest to the chosen point of origin makes a DC 15 Constitution saving throw. On a failed save, the creature has the Restrained condition and begins to turn to stone. While Restrained in this way, the creature repeats the save at the end of its next turn. On a successful save, the effect ends. On a failed save, the creature has the Petrified condition instead of the Restrained condition. The petrification lasts until the creature is freed by the Greater Restoration spell or similar magic.',
    ],
  }],
}
