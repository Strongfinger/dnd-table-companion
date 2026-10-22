#!/usr/bin/env python3
"""Add (or remove) the agent-guild hooks in Claude Code's user settings (~/.claude/settings.json).

  python3 install.py              add the hooks (a backup of settings.json is saved first)
  python3 install.py --uninstall  remove only the agent-guild hooks

Each hook only sends the event to the local guild server with curl, in the background.
If the server is not running, curl fails quietly and Claude Code carries on as normal.
"""

import json
import os
import shutil
import sys
import time

PORT = int(os.environ.get("AGENT_GUILD_PORT", "4777"))
SETTINGS = os.path.expanduser("~/.claude/settings.json")
MARK = "#agent-guild"
EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest",
          "Notification", "SubagentStart", "SubagentStop", "Stop", "SessionEnd"]
COMMAND = (f"curl -s -m 2 -o /dev/null -H 'Content-Type: application/json' "
           f"--data-binary @- http://127.0.0.1:{PORT}/event || true {MARK}")


def is_ours(group):
    return any(MARK in str(h.get("command", "")) for h in group.get("hooks", []))


def main():
    uninstall = "--uninstall" in sys.argv
    settings = {}
    if os.path.exists(SETTINGS):
        with open(SETTINGS, encoding="utf-8") as f:
            settings = json.load(f)
        backup = f"{SETTINGS}.backup-{time.strftime('%Y%m%d-%H%M%S')}"
        n = 1
        while os.path.exists(backup):  # never overwrite an older backup
            backup = f"{SETTINGS}.backup-{time.strftime('%Y%m%d-%H%M%S')}-{n}"
            n += 1
        shutil.copy2(SETTINGS, backup)
        print("สำรอง settings เดิมไว้ที่", backup)
    hooks = settings.setdefault("hooks", {})
    for event in EVENTS:
        groups = [g for g in hooks.get(event, []) if not is_ours(g)]
        if not uninstall:
            groups.append({"hooks": [{"type": "command", "command": COMMAND, "async": True, "timeout": 5}]})
        if groups:
            hooks[event] = groups
        else:
            hooks.pop(event, None)
    if not hooks:
        settings.pop("hooks")
    os.makedirs(os.path.dirname(SETTINGS), exist_ok=True)
    with open(SETTINGS, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("ลบ hook ของกิลด์แล้ว" if uninstall else f"ติดตั้ง hook ของกิลด์แล้ว ({len(EVENTS)} event) มีผลกับ session ใหม่ของ Claude Code")


if __name__ == "__main__":
    main()
