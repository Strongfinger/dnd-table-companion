# Bundled game data

## srd-monsters.json

A slim list of the 341 monsters in the **System Reference Document 5.2.1** (2024 rules),
used by the combat tracker's monster quick-add. Each entry keeps only: id, name, size, type,
CR, XP, AC, HP (average and dice), speed, and the six ability scores.

- **Source:** [5e-bits/5e-database](https://github.com/5e-bits/5e-database),
  `src/2024/en/5e-SRD-Monsters.json` (downloaded 2026-10-11, 1,342,885 bytes,
  SHA-256 `34ec39f2b384a5e1ed11ac6d9e17601a19579ed67fd1775d21588d186714346f`).
- **Made by:** a one-off script that reads the file as plain data, checks every value's type
  and range, and writes only the fields above. The raw file is not kept in this repo.
- **Corrections:** XP is checked against the CR → XP table (`src/rules/challenge.ts`).
  The source had Archmage (CR 12) at 8,000 XP; corrected to 8,400.
- **Forms:** Vampire and the lycanthropes have one entry per form (e.g. "Werewolf, Hybrid Form"),
  which is why there are 341 entries rather than ~331 creatures.
- **License:** This work includes material from the System Reference Document 5.2.1
  ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
  The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License,
  available at https://creativecommons.org/licenses/by/4.0/legalcode.
- **Note:** the data has no initiative field, so the app uses the DEX modifier as the
  initiative bonus. Many 2024 stat blocks add their Proficiency Bonus (or twice it) to
  Initiative, e.g. Lich, adult dragons, Archmage; the DM can adjust the number when adding.
