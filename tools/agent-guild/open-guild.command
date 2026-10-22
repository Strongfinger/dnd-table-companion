#!/bin/bash
# Double-click on the Mac: starts the guild server (if it isn't running) and opens the page.
cd "$(dirname "$0")"
PORT="${AGENT_GUILD_PORT:-4777}"
if curl -s -m 1 -o /dev/null "http://127.0.0.1:$PORT/"; then
  open "http://127.0.0.1:$PORT/"
  exit 0
fi
(sleep 1; open "http://127.0.0.1:$PORT/") &
python3 server.py
