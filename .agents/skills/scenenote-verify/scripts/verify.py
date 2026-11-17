#!/usr/bin/env python3
"""Run explicit local checks or selected test files with private, concise logs."""
import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import signal
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[4]
CHECKS = {'test': ['npm', 'test'], 'typecheck': ['npm', 'run', 'typecheck'],
          'lint': ['npm', 'run', 'lint'], 'build': ['npm', 'run', 'build']}
TOOLS = {'test': 'tsx/dist/loader.mjs', 'typecheck': 'typescript/bin/tsc',
         'lint': 'eslint/bin/eslint.js', 'build': 'expo/bin/cli'}


class VerificationEnvironmentError(Exception):
    def __init__(self, message, check_started=False):
        super().__init__(message)
        self.check_started = check_started


class VerificationInterrupted(Exception):
    def __init__(self, signum):
        self.signum = signum


def interrupt(signum, _frame):
    raise VerificationInterrupted(signum)


def selected_tests(parser, paths):
    selected = []
    for value in paths or []:
        path = (ROOT / value).resolve()
        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            parser.error('--tests must stay inside the SceneNote repository')
        allowed = bool(relative.parts) and (relative.parts[0] in {'src', 'scripts'} or relative.parts[:2] == ('supabase', 'functions'))
        if not allowed or not path.is_file() or not path.name.endswith('.test.ts'):
            parser.error('--tests requires existing src/, scripts/ or supabase/functions/ *.test.ts files; expand globs first')
        if str(path) not in selected:
            selected.append(str(path))
    return selected


def execute(command, log, timeout, environment=None):
    started = time.monotonic()
    process = None
    try:
        with log.open('w', encoding='utf-8') as output:
            os.chmod(log, 0o600)
            try:
                process = subprocess.Popen(command, cwd=ROOT, stdout=output,
                                           stderr=subprocess.STDOUT,
                                           env=environment,
                                           start_new_session=os.name == 'posix')
            except OSError as error:
                output.write(str(error) + '\n')
                raise VerificationEnvironmentError(
                    f'cannot start {Path(command[0]).name}; inspect {log.name}') from error

            def stop():
                try:
                    if os.name == 'posix':
                        os.killpg(process.pid, signal.SIGKILL)
                    else:
                        process.kill()
                except ProcessLookupError:
                    pass
                finally:
                    process.wait()

            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                stop()
                output.write('\nCheck exceeded its time limit.\n')
                code = 124
            except BaseException:
                stop()
                raise
    except OSError as error:
        raise VerificationEnvironmentError(
            f'cannot create or write {log.name} ({error.strerror or type(error).__name__})',
            check_started=process is not None) from error
    return code, round(time.monotonic() - started, 2)


def preflight(checks, logs, environment=None):
    search_path = environment['PATH'] if environment is not None else None
    for executable in ['node'] + (['npm'] if checks != ['selected-test'] else []):
        resolved = shutil.which(executable, path=search_path)
        if not resolved:
            return f'{executable} unavailable; select a working local Node/npm PATH or --node-bin DIR'
        command = [resolved if environment is not None else executable, '--version']
        code, _ = execute(command, logs / (executable + '-version.log'), 15, environment)
        if code:
            return f'{executable} startup failed; inspect {executable}-version.log and select a working local Node/npm PATH or --node-bin DIR'
    for name in checks:
        tool = TOOLS['test' if name == 'selected-test' else name]
        if not (ROOT / 'node_modules' / tool).is_file():
            return 'local dependency missing: node_modules/' + tool + '; review npm ci requirements'
    return None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', choices=CHECKS)
    parser.add_argument('--tests', nargs='+', metavar='FILE', help='exact *.test.ts paths; defaults to test + typecheck + lint')
    parser.add_argument('--build', action='store_true', help='include the local web export')
    parser.add_argument('--plan', action='store_true', help='print commands without executing or creating logs')
    parser.add_argument('--node-bin', metavar='DIR', help='use Node/npm from this directory for this run only')
    parser.add_argument('--timeout', type=int, default=900, help='seconds per check (default: 900)')
    args = parser.parse_args()
    if not args.only and not args.tests and not args.build:
        parser.error('choose --tests FILE... or --only CHECK...; full tests require --only test')
    if args.timeout < 1:
        parser.error('--timeout must be positive')
    tests = selected_tests(parser, args.tests)
    checks = list(dict.fromkeys(args.only or (['test', 'typecheck', 'lint'] if tests else [])))
    if tests and 'test' not in checks:
        parser.error('--tests requires test in --only')
    if args.build and 'build' not in checks:
        checks.append('build')
    node_bin = Path(args.node_bin).expanduser().resolve() if args.node_bin else None
    environment = None
    if node_bin is not None:
        executables = ['node'] + (['npm'] if checks != ['test'] or not tests else [])
        for executable in executables:
            candidate = node_bin / executable
            if not candidate.is_file() or not os.access(candidate, os.X_OK):
                parser.error(f'--node-bin requires an executable {executable} in the selected directory')
        environment = dict(os.environ, PATH=str(node_bin) + os.pathsep + os.environ.get('PATH', ''))
    commands = {name: (['node', '--import', 'tsx', '--test', *tests]
                       if name == 'test' and tests else CHECKS[name]) for name in checks}
    if node_bin is not None:
        commands = {name: [str(node_bin / command[0]), *command[1:]] for name, command in commands.items()}
    if args.plan:
        for name, command in commands.items():
            print(f'{name}: {shlex.join(command)}')
        return 0
    logs = None
    results = []
    phase = 'log directory creation'
    previous_handlers = {}
    try:
        for signum in [signal.SIGINT, signal.SIGTERM]:
            previous_handlers[signum] = signal.signal(signum, interrupt)
        logs = Path(tempfile.mkdtemp(prefix='scenenote-verify-'))
        os.chmod(logs, 0o700)
        phase = 'environment preflight'
        environment_error = preflight(['selected-test' if name == 'test' and tests else name for name in checks], logs, environment)
        if environment_error:
            raise VerificationEnvironmentError(environment_error)
        failed = False
        search_path = environment['PATH'] if environment is not None else None
        runtime = {name: shutil.which(name, path=search_path) for name in ['node', 'npm']
                   if name == 'node' or any(command[0].endswith('npm') for command in commands.values())}
        for name in checks:
            phase = name
            log = logs / (name + '.log')
            code, duration = execute(commands[name], log, args.timeout, environment)
            print(f'{name}: {"PASS" if code == 0 else "FAIL"} (exit {code}, {duration}s); log={log}', flush=True)
            results.append({'check': name, 'exit_code': code, 'seconds': duration, 'log': str(log),
                            'test_scope': tests if name == 'test' else None,
                            'command': commands[name], 'runtime': runtime})
            failed |= code != 0
        phase = 'summary creation'
        summary = logs / 'summary.json'
        summary.write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
        os.chmod(summary, 0o600)
        return int(failed)
    except (VerificationInterrupted, KeyboardInterrupt) as error:
        signum = error.signum if isinstance(error, VerificationInterrupted) else signal.SIGINT
        location = f'; logs={logs}' if logs is not None else ''
        print(f'checks: CANCELLED ({signal.Signals(signum).name}){location}', flush=True)
        return 128 + signum
    except (VerificationEnvironmentError, OSError) as error:
        reason = str(error) if isinstance(error, VerificationEnvironmentError) else f'{phase} failed ({error.strerror or type(error).__name__})'
        location = f'; logs={logs}' if logs is not None else ''
        print(f'environment: FAIL ({reason}){location}', flush=True)
        if results or (phase in checks and getattr(error, 'check_started', False)):
            print(f'verification: INCOMPLETE ({len(results)} checks completed; inspect available logs)', flush=True)
        else:
            print('checks: NOT RUN (environment check failed)', flush=True)
        return 2
    finally:
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)

if __name__ == '__main__':
    raise SystemExit(main())
