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

Claude Code's hook schema requires every entry in an event array to be a `{matcher, hooks: [...]}` wrapper, where `matcher` is a tool filter (empty string matches all) and `hooks` is the list of actions to run. The nine Hacker HQ entries (with empty matcher so they fire for everything) look like this when merged into `settings.hooks`:

```json
{
  "PostToolUse":        [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:3001/hook" }] }],
  "PostToolUseFailure": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:3001/hook" }] }],
  "Stop":               [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:3001/hook" }] }],
  "SubagentStop":       [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:3001/hook" }] }],
  "TaskCompleted":      [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:3001/hook" }] }],
  "SubagentStart":      [{ "matcher": "", "hooks": [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }] }],
  "TeammateIdle":       [{ "matcher": "", "hooks": [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }] }],
  "SessionStart":       [{ "matcher": "", "hooks": [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }] }],
  "SessionEnd":         [{ "matcher": "", "hooks": [{ "type": "command", "command": "curl -s -X POST http://localhost:3001/hook -H \"Content-Type: application/json\" -d @- > /dev/null 2>&1 || true" }] }]
}
```

Never write a bare `{type, url}` / `{type, command}` object directly into an event array — Claude Code will reject the whole settings file with a "hooks: Expected array, but received undefined" error and skip it entirely.

### Step 3 — Merge with Python (preserve everything else)

Use the `Bash` tool to run this Python one-shot. It loads the file, adds an HQ hook under a `{matcher: "", hooks: [...]}` wrapper in each event array (skipping if an HQ hook is already present in any wrapper), strips legacy malformed bare HQ entries, and writes back pretty-printed JSON.

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

def is_hq_http(h):
    return isinstance(h, dict) and h.get("type") == "http" and h.get("url") == HQ_URL

def is_hq_cmd(h):
    return isinstance(h, dict) and h.get("type") == "command" and h.get("command") == HQ_CMD

def merge(event_name, hq_hook, is_hq):
    arr = hooks.setdefault(event_name, [])
    # Strip legacy bare HQ entries (wrong shape — they break the settings parser)
    bare_stripped = 0
    cleaned = []
    for entry in arr:
        if is_hq(entry):
            bare_stripped += 1
            continue
        cleaned.append(entry)
    # Check whether a correctly-wrapped HQ hook already exists
    has_wrapped = any(
        isinstance(entry, dict)
        and isinstance(entry.get("hooks"), list)
        and any(is_hq(h) for h in entry["hooks"])
        for entry in cleaned
    )
    if not has_wrapped:
        cleaned.append({"matcher": "", "hooks": [hq_hook]})
        added = 1
    else:
        added = 0
    hooks[event_name] = cleaned
    return added, bare_stripped, has_wrapped

added = skipped = bare_total = 0
for ev in http_events:
    a, b, had = merge(ev, {"type": "http", "url": HQ_URL}, is_hq_http)
    added += a; bare_total += b; skipped += 1 if had else 0
for ev in cmd_events:
    a, b, had = merge(ev, {"type": "command", "command": HQ_CMD}, is_hq_cmd)
    added += a; bare_total += b; skipped += 1 if had else 0

with open(p, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

msg = f"Hacker HQ hooks: added {added}, already present {skipped}, total 9 events"
if bare_total:
    msg += f" (fixed {bare_total} legacy malformed entries)"
print(msg)
PY
```

### Step 4 — Confirm to the user

Print the count line from the Python block and tell the user:

> Hacker HQ hooks installed in `~/.claude/settings.json`. Every Claude Code session on this machine will now report activity to `http://localhost:3001/hook`. Start the relay server with `npx tsx server.ts` from the hacker_hq project to see live events.

## /uninstall-hooks

When the user invokes `/uninstall-hooks` (or asks to remove Hacker HQ hooks), run the inverse: strip only the entries that point at `localhost:3001/hook`, leave every other hook alone. The script must look inside both the modern `{matcher, hooks}` wrappers and any legacy bare entries. If a wrapper ends up with an empty `hooks` list, remove that wrapper. If an event array ends up empty, remove that event key. Do **not** delete the whole `hooks` key unless it is completely empty.

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
    new_entries = []
    for entry in hooks[ev]:
        # Legacy bare HQ entry — drop it entirely
        if is_hq(entry):
            removed += 1
            continue
        # Modern matcher-wrapped entry — strip HQ hooks from the inner list
        if isinstance(entry, dict) and isinstance(entry.get("hooks"), list):
            before = len(entry["hooks"])
            entry["hooks"] = [h for h in entry["hooks"] if not is_hq(h)]
            removed += before - len(entry["hooks"])
            if not entry["hooks"]:
                # Wrapper is now empty — drop it (don't leave {matcher:"",hooks:[]})
                continue
        new_entries.append(entry)
    hooks[ev] = new_entries
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
