"""Harbor agent: Claude Code with the Chisle plugin loaded from this repo.

Uploads the plugin (manifest, hooks, skills, commands) into each task container
and starts Claude Code with --plugin-dir, so the run exercises the real hooks:
SessionStart activation, UserPromptSubmit reminders and the PostToolUse output
compressor. Compressor stats and spill files land in CLAUDE_CONFIG_DIR, which
Harbor copies back as <trial>/agent/sessions/.

Used by run.sh:  harbor run -a chisle_agent:ChisleClaudeCode ...
"""

import json
import re
from pathlib import Path

from harbor.agents.installed.base import ApiUsageLimitError, ErrorPattern
from harbor.agents.installed.claude_code import ClaudeCode

REPO = Path(__file__).resolve().parents[2]
PLUGIN_DIR = "/opt/chisle"
PLUGIN_PARTS = (".claude-plugin", "hooks", "skills", "commands")

# Subscription-plan wording. Harbor's built-in pattern only knows "You've hit
# your usage limit", so a Pro/Max limit hit would otherwise go unclassified.
LIMIT = re.compile(
    r"You've hit your limit|You have hit your limit|"
    r"(?:5-hour|weekly|session|usage) limit reached",
    re.IGNORECASE,
)


class ChisleClaudeCode(ClaudeCode):
    ERROR_PATTERNS = [*ClaudeCode.ERROR_PATTERNS, ErrorPattern(LIMIT.pattern, ApiUsageLimitError)]

    async def install(self, environment):
        await super().install(environment)
        for part in PLUGIN_PARTS:
            await environment.upload_dir(REPO / part, f"{PLUGIN_DIR}/{part}")
        await environment.exec(command=f"chmod -R a+rX {PLUGIN_DIR}", user="root")

    def build_cli_flags(self) -> str:
        return f"{super().build_cli_flags()} --plugin-dir {PLUGIN_DIR}".strip()

    async def run(self, instruction, environment, context):
        await super().run(instruction, environment, context)
        # `claude ... | tee` exits 0 even when the plan limit stops the session,
        # so the failure never reaches ERROR_PATTERNS and the verifier would
        # grade an abandoned attempt as an ordinary fail. The last line of the
        # stream is the result event; raise so run.sh can re-run the trial.
        log = (self.environment_logs_dir / "claude-code.txt").as_posix()
        tail = await environment.exec(command=f"tail -n 1 {log}")
        last = (tail.stdout or "").strip()
        try:
            event = json.loads(last)
            text = str(event.get("result", "")) if event.get("is_error") else ""
        except ValueError:
            text = last
        if LIMIT.search(text):
            raise ApiUsageLimitError(text[:500])
