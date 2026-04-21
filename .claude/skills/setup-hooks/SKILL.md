---
name: setup-hooks
description: Configure Claude Code hooks to report agent activity to the Hacker HQ dashboard. Adds global hooks to ~/.claude/settings.json so every Claude Code session auto-reports to the relay server.
user-invocable: true
allowed-tools: Read, Edit, Write, Bash
---

# setup-hooks

Install Hacker HQ dashboard reporting hooks into the user's **global** Claude Code settings (`~/.claude/settings.json`). Once installed, every Claude Code session on this machine will report tool use, stops, subagent lifecycle, and session boundaries to the relay server at `http://localhost:3001/hook`.

## What this skill does

1. Reads `~/.claude/settings.json` (creates it with `{}` if missing).
2. Parses the JSON while preserving every existing key (`permissions`, `env`, `model`, pre-existing hooks, etc.).
3. Merges nine Hacker HQ entries into the `hooks` object:
   - **HTTP hooks** (`type: "http"`, `url: "http://localhost:3001/hook"`): `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `TaskCompleted`
   - **Command hooks** (`type: "command"`, `command: curl ...`): `SubagentStart`, `TeammateIdle`, `SessionStart`, `SessionEnd`
4. Appends to any existing event array — never overwrites another hook.
5. Writes the merged JSON back to `~/.claude/settings.json`.
6. Prints a confirmation with the count of hooks added (and which were already present).

## Steps for the invoking agent

Follow these steps exactly. Do not install extra hooks or modify unrelated keys.

### Step 1 — Load settings

```bash
SETTINGS="$HOME/.claude/settings.json"
if [ ! -f "$SETTINGS" ]; then
  mkdir -p "$HOME/.claude"
  echo '{}' > "$SETTINGS"
fi
```

Then use the `Read` tool on `$SETTINGS` to inspect current contents before editing.

### Step 2 — Define the target hooks

The nine entries to merge into `settings.hooks`:

```json
{
  "PostToolUse":        [{ "type": "http", "url": "http://localhost:3001/hook" }],
  "PostToolUseFailure": [{ "type": "http", "url": "http://localhost:3001/hook" }],
  "Stop":               [{ "type": "http", "url": "http://localhost:3001/hook" }],
  "SubagentStop":       [{ "type": "http", "url": "http://localhost:3001/hook" }],
  "TaskCompleted":      [{ "type": "http", "url": "http://localhost:3001/hook" }],
  "SubagentStart":      [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }],
  "TeammateIdle":       [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }],
  "SessionStart":       [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }],
  "SessionEnd":         [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }]
}
```

### Step 3 — Merge with Python (preserve everything else)

Use the `Bash` tool to run this Python one-shot. It loads the file, merges per-event arrays (skipping duplicates that match URL or command), and writes back pretty-printed JSON.

```bash
python3 - <<'PY'
import json, os, sys
p = os.path.expanduser("~/.claude/settings.json")
with open(p) as f:
    data = json.load(f)

HQ_URL = "http://localhost:3001/hook"
HQ_CMD = 'curl -s -X POST http://localhost:3001/hook -H "Content-Type: application/json" -d @- > /dev/null 2>&1 || true'

http_events = ["PostToolUse", "PostToolUseFailure", "Stop", "SubagentStop", "TaskCompleted"]
cmd_events  = ["SubagentStart", "TeammateIdle", "SessionStart", "SessionEnd"]

hooks = data.setdefault("hooks", {})
added, skipped = 0, 0

def has_http(arr):
    return any(isinstance(h, dict) and h.get("type") == "http" and h.get("url") == HQ_URL for h in arr)

def has_cmd(arr):
    return any(isinstance(h, dict) and h.get("type") == "command" and h.get("command") == HQ_CMD for h in arr)

for ev in http_events:
    arr = hooks.setdefault(ev, [])
    if has_http(arr):
        skipped += 1
    else:
        arr.append({"type": "http", "url": HQ_URL})
        added += 1

for ev in cmd_events:
    arr = hooks.setdefault(ev, [])
    if has_cmd(arr):
        skipped += 1
    else:
        arr.append({"type": "command", "command": HQ_CMD})
        added += 1

with open(p, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Hacker HQ hooks: added {added}, already present {skipped}, total 9 events")
PY
```

### Step 4 — Confirm to the user

Print the count line from the Python block and tell the user:

> Hacker HQ hooks installed in `~/.claude/settings.json`. Every Claude Code session on this machine will now report activity to `http://localhost:3001/hook`. Start the relay server with `npx tsx server.ts` from the hacker_hq project to see live events.

## /uninstall-hooks

When the user invokes `/uninstall-hooks` (or asks to remove Hacker HQ hooks), run the inverse: strip only the entries that point at `localhost:3001/hook`, leave every other hook alone. Do **not** delete the whole `hooks` key.

```bash
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
with open(p) as f:
    data = json.load(f)

hooks = data.get("hooks", {})
removed = 0

def is_hq(h):
    if not isinstance(h, dict):
        return False
    if h.get("type") == "http" and "localhost:3001/hook" in (h.get("url") or ""):
        return True
    if h.get("type") == "command" and "localhost:3001/hook" in (h.get("command") or ""):
        return True
    return False

for ev in list(hooks.keys()):
    before = len(hooks[ev])
    hooks[ev] = [h for h in hooks[ev] if not is_hq(h)]
    removed += before - len(hooks[ev])
    if not hooks[ev]:
        del hooks[ev]

if not hooks and "hooks" in data:
    del data["hooks"]

with open(p, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Removed {removed} Hacker HQ hook entries from ~/.claude/settings.json")
PY
```

## Rules for the invoking agent

- **Never overwrite** existing event arrays — always append.
- **Never remove** non-Hacker-HQ hooks during uninstall. Match strictly by URL/command containing `localhost:3001/hook`.
- **Preserve** all other top-level keys (`permissions`, `env`, `model`, MCP config, etc.).
- If JSON parsing fails, **stop and report the error** — do not attempt to rewrite a malformed file.
- This skill targets **global** settings at `~/.claude/settings.json`. Do not touch project-level `.claude/settings.json` or `settings.local.json`.
