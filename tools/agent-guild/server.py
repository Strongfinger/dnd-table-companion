#!/usr/bin/env python3
"""Agent guild: a tiny local server that turns Claude Code hook events into a live animated page.

How it fits together:
  Claude Code hook (curl) --POST /event--> this server --Server-Sent Events /events--> guild.html in the browser

Only the Python standard library is used, and the server listens on 127.0.0.1 only,
so nothing leaves the Mac. Events are kept in memory (never written to disk).

Run:  python3 server.py            (then open http://127.0.0.1:4777)
      AGENT_GUILD_PORT=5000 python3 server.py   to use another port
"""

import json
import os
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("AGENT_GUILD_PORT", "4777"))
HERE = os.path.dirname(os.path.abspath(__file__))
IDLE_AFTER = 30 * 60      # an actor with no events for 30 min counts as idle
FORGET_AFTER = 6 * 3600   # and disappears after 6 h
MAX_LOG = 60

# guild.html is written for claude.ai, which adds the document skeleton itself; add the same here.
PAGE_HEAD = (b'<!doctype html><html lang="th"><head><meta charset="utf-8">'
             b'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
             b'<style>body{margin:0}[hidden]{display:none!important}</style></head><body>')

lock = threading.Lock()
actors = {}               # key -> actor dict (see actor_key)
log = []                  # newest last
listeners = []            # one queue per open browser tab


def short(text, n=70):
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def base(path):
    return os.path.basename(str(path or "").rstrip("/")) or str(path or "")


def describe_tool(name, inp):
    """Short Thai description of a tool call, e.g. 'รันคำสั่ง: npm test'."""
    inp = inp if isinstance(inp, dict) else {}
    if name == "Bash":
        return "รันคำสั่ง: " + short(inp.get("description") or inp.get("command"), 60)
    if name == "Read":
        return "อ่านไฟล์ " + base(inp.get("file_path"))
    if name in ("Edit", "MultiEdit", "NotebookEdit"):
        return "แก้ไฟล์ " + base(inp.get("file_path") or inp.get("notebook_path"))
    if name == "Write":
        return "เขียนไฟล์ " + base(inp.get("file_path"))
    if name in ("Grep", "Glob"):
        return "ค้นหา " + short(inp.get("pattern"), 40)
    if name in ("Agent", "Task"):
        who = inp.get("subagent_type") or "ผู้ช่วย"
        return f"ส่งงานให้ {who}: " + short(inp.get("description"), 40)
    if name in ("WebFetch", "WebSearch"):
        return "ค้นข้อมูลบนเว็บ"
    if name.startswith("mcp__"):
        parts = name.split("__")
        return "ใช้ " + (parts[1] if len(parts) > 1 else name)
    return "ใช้ " + name


def actor_key(ev):
    """Main session -> 'session:<id>'; a subagent inside it -> 'agent:<agent_id>'."""
    if ev.get("agent_id"):
        return "agent:" + str(ev["agent_id"])
    return "session:" + str(ev.get("session_id", "?"))


def touch(ev, status=None, activity=None):
    key = actor_key(ev)
    now = time.time()
    a = actors.get(key)
    if a is None:
        a = {
            "key": key,
            "kind": "agent" if ev.get("agent_id") else "main",
            "agent_type": ev.get("agent_type") or "",
            "session": str(ev.get("session_id", "")),
            "project": base(ev.get("cwd")),
            "status": "idle",
            "activity": "",
        }
        actors[key] = a
    if ev.get("agent_type"):
        a["agent_type"] = ev["agent_type"]
    if ev.get("cwd"):
        a["project"] = base(ev["cwd"])
    if status:
        a["status"] = status
    if activity is not None:
        a["activity"] = activity
    a["updated"] = now
    return a


def handle(ev):
    """Update the actors for one hook event. Returns (actor, log text) or (None, None)."""
    name = ev.get("hook_event_name", "")
    if name == "SessionStart":
        return touch(ev, "idle", "เปิด session ใหม่"), "เปิด session ใหม่"
    if name == "UserPromptSubmit":
        return touch(ev, "working", "อ่านคำสั่งของ Tan"), "ได้รับคำสั่งจาก Tan"
    if name == "PreToolUse":
        text = describe_tool(ev.get("tool_name", ""), ev.get("tool_input"))
        return touch(ev, "working", text), text
    if name == "PostToolUse":
        a = touch(ev)
        if a["status"] == "waiting":     # permission was granted and the tool ran
            a["status"] = "working"
            return a, "ได้รับอนุญาตแล้ว ทำงานต่อ"
        return a, None
    if name == "PermissionRequest":
        text = "ขออนุญาต: " + describe_tool(ev.get("tool_name", ""), ev.get("tool_input"))
        return touch(ev, "waiting", text), text
    if name == "Notification":
        kind = ev.get("notification_type", "")
        if kind in ("permission_prompt", "elicitation_dialog", "agent_needs_input"):
            text = short(ev.get("message") or "รอ Tan ตอบ", 60)
            return touch(ev, "waiting", text), text
        if kind == "idle_prompt":
            return touch(ev, "idle", "รอคำสั่งถัดไป"), None
        return None, None
    if name == "SubagentStart":
        return touch(ev, "working", "เริ่มงาน"), "เริ่มงาน"
    if name == "SubagentStop":
        return touch(ev, "idle", "ส่งงานแล้ว"), "ส่งงานแล้ว"
    if name == "Stop":
        a = touch(ev, "idle", "ตอบเสร็จแล้ว")
        for other in actors.values():    # subagents of a finished turn are done too
            if other["kind"] == "agent" and other["session"] == a["session"] and other["status"] != "idle":
                other["status"], other["activity"] = "idle", "ส่งงานแล้ว"
        return a, "ตอบเสร็จแล้ว"
    if name == "SessionEnd":
        key = actor_key(ev)
        a = actors.pop(key, None)
        if a:
            for k in [k for k, o in actors.items() if o["session"] == a["session"]]:
                actors.pop(k)
            a = dict(a, status="gone")
        return a, "ปิด session"
    return None, None


def sweep():
    now = time.time()
    for key, a in list(actors.items()):
        age = now - a.get("updated", now)
        if age > FORGET_AFTER:
            actors.pop(key)
        elif age > IDLE_AFTER and a["status"] != "idle":
            a["status"], a["activity"] = "idle", ""


def snapshot():
    sweep()
    return {"type": "snapshot", "actors": list(actors.values()), "log": log[-MAX_LOG:]}


def broadcast(msg):
    data = json.dumps(msg, ensure_ascii=False)
    for q in list(listeners):
        q.put(data)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    def do_POST(self):
        if self.path != "/event":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            ev = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            ev = {}
        with lock:
            actor, text = handle(ev) if isinstance(ev, dict) else (None, None)
            entry = None
            if actor and text:
                entry = {"t": time.time(), "key": actor["key"], "agent_type": actor["agent_type"],
                         "kind": actor["kind"], "project": actor["project"], "status": actor["status"], "text": text}
                log.append(entry)
                del log[:-MAX_LOG]
            if actor:
                broadcast({"type": "update", "actor": actor, "log": entry})
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with open(os.path.join(HERE, "guild.html"), "rb") as f:
                body = PAGE_HEAD + f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            q = queue.Queue()
            with lock:
                listeners.append(q)
                first = json.dumps(snapshot(), ensure_ascii=False)
            try:
                self.wfile.write(f"data: {first}\n\n".encode())
                self.wfile.flush()
                while True:
                    try:
                        data = q.get(timeout=20)
                        self.wfile.write(f"data: {data}\n\n".encode())
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")   # keeps the connection open
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                with lock:
                    listeners.remove(q)
            return
        self.send_error(404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.daemon_threads = True
    print(f"กิลด์ Agent พร้อมแล้ว: เปิด http://127.0.0.1:{PORT} (กด Ctrl+C เพื่อปิด)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
