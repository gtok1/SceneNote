#!/usr/bin/env python3
"""Install the SceneNote pre-commit guard without replacing an existing hook."""

import argparse
import os
from pathlib import Path
import subprocess
import sys


WRAPPER = """#!/bin/sh
# SceneNote staged-only guard. No commit, push, network or deployment operations.
root=$(git rev-parse --show-toplevel) || exit 1
exec python3 "$root/.githooks/scenenote-staged-guard.py"
"""


def git(root, *arguments):
    return subprocess.run(
        ["git", *arguments], cwd=root, text=True, capture_output=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Report installation status without changing files")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    guard = root / ".githooks/scenenote-staged-guard.py"
    if not guard.is_file():
        print("SceneNote hook: staged guard is missing.", file=sys.stderr)
        return 2
    try:
        try:
            compile(guard.read_bytes(), "<SceneNote staged guard>", "exec")
        except SyntaxError:
            print("SceneNote hook: staged guard is not valid Python; installation was preserved.", file=sys.stderr)
            return 2
        top = git(root, "rev-parse", "--show-toplevel")
        if top.returncode or Path(top.stdout.strip()).resolve() != root:
            print("SceneNote hook: run from a complete SceneNote Git checkout.", file=sys.stderr)
            return 2
        configured = git(root, "config", "--get", "core.hooksPath")
        if configured.returncode not in (0, 1):
            print("SceneNote hook: could not read Git hook configuration.", file=sys.stderr)
            return 2
        if configured.returncode == 0:
            print("SceneNote hook: core.hooksPath is configured; existing configuration was preserved.", file=sys.stderr)
            return 2
        resolved = git(root, "rev-parse", "--git-path", "hooks")
        if resolved.returncode:
            print("SceneNote hook: could not locate Git hooks.", file=sys.stderr)
            return 2
        hooks = Path(resolved.stdout.strip())
        if not hooks.is_absolute():
            hooks = root / hooks
        if hooks.is_symlink():
            print("SceneNote hook: existing hook directory symlink was preserved.", file=sys.stderr)
            return 2
        hook = hooks / "pre-commit"
        if hook.is_symlink():
            print("SceneNote hook: existing pre-commit symlink was preserved.", file=sys.stderr)
            return 2
        if hook.exists():
            if not hook.is_file() or hook.read_text() != WRAPPER:
                print("SceneNote hook: existing pre-commit hook was preserved.", file=sys.stderr)
                return 2
            if not os.access(hook, os.X_OK):
                if args.check:
                    print("SceneNote hook: installed wrapper is not executable.", file=sys.stderr)
                    return 1
                hook.chmod(hook.stat().st_mode | 0o100)
            print("SceneNote hook: active.")
            return 0
        if args.check:
            print("SceneNote hook: not installed.", file=sys.stderr)
            return 1
        hooks.mkdir(parents=True, exist_ok=True)
        # Exclusive creation preserves a hook installed concurrently by another process.
        with hook.open("x") as output:
            output.write(WRAPPER)
        hook.chmod(0o755)
        print("SceneNote hook: installed.")
        return 0
    except (OSError, UnicodeError):
        print("SceneNote hook: installation could not be completed; inspect local Git hook permissions.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
