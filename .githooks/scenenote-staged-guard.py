#!/usr/bin/env python3
"""Small staged-path safeguard, not a comprehensive secret scanner."""
from pathlib import PurePosixPath
import subprocess
import sys

def blocked(path):
    name = PurePosixPath(path).name.lower()
    return ((name == '.env' or name.startswith('.env.')) and name not in {'.env.example', '.env.sample', '.env.template'}) or name in {'id_rsa', 'id_ed25519'} or name.endswith(('.p12', '.pfx', '.key'))

def main():
    try:
        # Only destination paths matter. A rename is covered by its added side.
        result = subprocess.run(
            ['git', 'diff', '--cached', '--no-renames', '--name-only', '--diff-filter=AMT', '-z'],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        if result.returncode:
            print('SceneNote staged check could not read the index.', file=sys.stderr)
            return 1
        paths = result.stdout.decode('utf-8', errors='surrogateescape').split('\0')
        if any(blocked(p) for p in paths if p):
            print('SceneNote: staged environment/private-key path found. Review staged paths before committing; no file contents printed.', file=sys.stderr)
            return 1
        result = subprocess.run(
            ['git', 'diff', '--cached', '--check'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        if result.returncode:
            print('SceneNote: staged whitespace/conflict-marker check failed. Run git diff --cached --check locally.', file=sys.stderr)
            return 1
    except OSError:
        print('SceneNote staged check could not start Git; check the local Git installation and PATH.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
