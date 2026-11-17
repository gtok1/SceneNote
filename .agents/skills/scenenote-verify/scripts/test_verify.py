#!/usr/bin/env python3
"""Exercise the CLI in isolated fixtures without running npm or application code."""
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
import unittest

SOURCE = Path(__file__).with_name('verify.py')


class VerifyCliTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='scenenote-verify-fixture-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.script = self.root / '.agents/skills/scenenote-verify/scripts/verify.py'
        self.script.parent.mkdir(parents=True)
        shutil.copy2(SOURCE, self.script)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.log_root = self.root / 'logs'
        self.log_root.mkdir()
        self.trace = self.root / 'trace.jsonl'
        self.control = self.root / 'control.json'
        self.control.write_text('{}')
        wrapper = f'''#!{sys.executable}
import json, os, pathlib, subprocess, sys, time
root = pathlib.Path(__file__).resolve().parents[1]
name = pathlib.Path(__file__).name
args = sys.argv[1:]
with (root / 'trace.jsonl').open('a') as output:
    output.write(json.dumps([name, args, str(pathlib.Path.cwd())]) + '\\n')
control = json.loads((root / 'control.json').read_text())
if args == ['--version']:
    if control.get('startup_fail') == name:
        print('fixture loader failure', file=sys.stderr)
        sys.exit(134)
    if control.get('disable_after_version') == name:
        pathlib.Path(__file__).chmod(0o644)
    print('v24.22.2' if name == 'node' else '11.0.0')
    sys.exit(0)
(root / 'check-pid').write_text(str(os.getpid()))
if control.get('disable_after_check') == name:
    pathlib.Path(__file__).chmod(0o644)
print('private fixture command output')
if control.get('spawn_descendant'):
    child_source = (
        'import pathlib,time; root=pathlib.Path(' + repr(str(root)) + '); '
        '(root / "descendant-started").write_text("started"); '
        'time.sleep(1.5); '
        '(root / "descendant-finished").write_text("kept running")'
    )
    subprocess.Popen([sys.executable, '-c', child_source])
if control.get('timeout'):
    time.sleep(5)
sys.exit(control.get('check_exit', 0))
'''
        for name in ['node', 'npm']:
            path = self.bin / name
            path.write_text(wrapper)
            path.chmod(0o755)
        for tool in ['tsx/dist/loader.mjs', 'typescript/bin/tsc', 'eslint/bin/eslint.js', 'expo/bin/cli']:
            path = self.root / 'node_modules' / tool
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('// isolated fixture\n')
        self.test_file = self.root / 'src/utils/선택 test.test.ts'
        self.test_file.parent.mkdir(parents=True)
        self.test_file.write_text('// isolated fixture\n')
        self.environment = dict(os.environ, PATH=str(self.bin), TMPDIR=str(self.log_root))

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(self.script), *args], cwd=self.root,
                              env=self.environment, capture_output=True, text=True, timeout=20)

    def run_faulted_cli(self, fault, *args):
        program = '''
import errno, pathlib, runpy, sys, tempfile
from unittest import mock
script, fault = sys.argv[1:3]
sys.argv = [script, *sys.argv[3:]]
original_open = pathlib.Path.open
class FailedClose:
    def __init__(self, output):
        self.output = output
    def __enter__(self):
        return self.output
    def __exit__(self, *_args):
        self.output.close()
        raise OSError(errno.ENOSPC, 'fixture log close failed')
def open_log(path, *args, **kwargs):
    if fault == 'preflight-close' and path.name == 'node-version.log':
        return FailedClose(original_open(path, *args, **kwargs))
    if path.name == ('node-version.log' if fault == 'open' else 'lint.log'):
        raise OSError(errno.ENOSPC, 'fixture log storage unavailable')
    return original_open(path, *args, **kwargs)
if fault == 'directory':
    patcher = mock.patch.object(tempfile, 'mkdtemp', side_effect=OSError(errno.ENOSPC, 'fixture log storage unavailable'))
elif fault == 'summary':
    patcher = mock.patch.object(pathlib.Path, 'write_text', side_effect=OSError(errno.ENOSPC, 'fixture summary storage unavailable'))
else:
    patcher = mock.patch.object(pathlib.Path, 'open', open_log)
with patcher:
    runpy.run_path(script, run_name='__main__')
'''
        return subprocess.run([sys.executable, '-c', program, str(self.script), fault, *args],
                              cwd=self.root, env=self.environment,
                              capture_output=True, text=True, timeout=20)

    def calls(self):
        if not self.trace.exists():
            return []
        return [json.loads(line) for line in self.trace.read_text().splitlines()]

    def set_control(self, **values):
        self.control.write_text(json.dumps(values))

    def preferred_runtime(self, with_npm=True):
        directory = self.root / 'known good runtime/bin'
        directory.mkdir(parents=True)
        for name in ['node'] + (['npm'] if with_npm else []):
            source = (self.bin / name).read_text()
            source = source.replace('root = pathlib.Path(__file__).resolve().parents[1]',
                                    'root = pathlib.Path(' + repr(str(self.root)) + ')')
            source = source.replace("if control.get('startup_fail') == name:", 'if False:')
            source = source.replace("str(pathlib.Path.cwd())]", "str(pathlib.Path.cwd()), os.environ.get('PATH', '')]")
            path = directory / name
            path.write_text(source)
            path.chmod(0o755)
        return directory

    def test_explicit_runtime_bypasses_broken_default_without_mutating_parent_path(self):
        preferred = self.preferred_runtime()
        self.set_control(startup_fail='node')
        original_path = self.environment['PATH']
        result = self.run_cli('--node-bin', str(preferred), '--only', 'lint')
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn('lint: PASS', result.stdout)
        self.assertTrue(all(call[3] == str(preferred) + os.pathsep + original_path for call in self.calls()))
        self.assertEqual(self.environment['PATH'], original_path)
        summary = json.loads(next(self.log_root.glob('scenenote-verify-*/summary.json')).read_text())
        self.assertEqual(summary[0]['command'], [str(preferred / 'npm'), 'run', 'lint'])
        self.assertEqual(summary[0]['runtime']['node'], str(preferred / 'node'))

    def test_explicit_runtime_plan_reports_exact_executable_without_running(self):
        preferred = self.preferred_runtime()
        result = self.run_cli('--node-bin', str(preferred), '--tests', str(self.test_file), '--only', 'test', '--plan')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(str(preferred / 'node'), result.stdout)
        self.assertIn('--import tsx --test', result.stdout)
        self.assertEqual(self.calls(), [])
        self.assertEqual(list(self.log_root.iterdir()), [])

    def test_explicit_runtime_requires_its_own_npm_for_npm_checks(self):
        preferred = self.preferred_runtime(with_npm=False)
        result = self.run_cli('--node-bin', str(preferred), '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('npm', result.stderr)
        self.assertEqual(self.calls(), [])

    def test_explicit_runtime_selected_test_does_not_require_npm(self):
        preferred = self.preferred_runtime(with_npm=False)
        result = self.run_cli('--node-bin', str(preferred), '--tests', str(self.test_file), '--only', 'test')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(all(call[0] == 'node' for call in self.calls()))

    def test_explicit_runtime_rejects_invalid_or_nonexecutable_node_before_checks(self):
        preferred = self.preferred_runtime()
        (preferred / 'node').chmod(0o644)
        for path in [self.root / 'missing-runtime', self.test_file, preferred]:
            with self.subTest(path=path):
                result = self.run_cli('--node-bin', str(path), '--only', 'lint')
                self.assertEqual(result.returncode, 2)
                self.assertEqual(self.calls(), [])

    def test_no_arguments_cannot_run_full_suite(self):
        result = self.run_cli()
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.calls(), [])

    def test_plan_is_read_only_and_selects_three_checks(self):
        result = self.run_cli('--tests', str(self.test_file), '--plan')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(result.stdout.splitlines()), 3)
        self.assertIn('--test', result.stdout)
        self.assertEqual(self.calls(), [])
        self.assertEqual(list(self.log_root.iterdir()), [])

    def test_selected_file_is_exact_and_output_is_concise(self):
        result = self.run_cli('--tests', str(self.test_file), str(self.test_file), '--only', 'test')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(result.stdout.splitlines()), 1)
        self.assertNotIn('private fixture command output', result.stdout + result.stderr)
        calls = self.calls()
        self.assertEqual(calls[0][:2], ['node', ['--version']])
        self.assertEqual(calls[1][1], ['--import', 'tsx', '--test', str(self.test_file)])
        self.assertTrue(all(call[2] == str(self.root) for call in calls))
        logs = list(self.log_root.glob('scenenote-verify-*'))
        self.assertEqual(len(logs), 1)
        self.assertEqual(stat.S_IMODE(logs[0].stat().st_mode), 0o700)
        self.assertTrue(all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in logs[0].iterdir()))
        self.assertIn('private fixture command output', (logs[0] / 'test.log').read_text())
        summary = json.loads((logs[0] / 'summary.json').read_text())
        self.assertEqual(summary[0]['test_scope'], [str(self.test_file)])

    def test_explicit_full_checks_and_build_run_once_in_order(self):
        result = self.run_cli('--only', 'test', 'typecheck', 'lint', 'test', '--build')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call[1] for call in self.calls()][2:],
                         [['test'], ['run', 'typecheck'], ['run', 'lint'], ['run', 'build']])
        self.assertEqual(len(result.stdout.splitlines()), 4)

    def test_build_alone_does_not_add_other_checks(self):
        result = self.run_cli('--build')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call[1] for call in self.calls()][2:], [['run', 'build']])
        self.assertEqual(len(result.stdout.splitlines()), 1)

    def test_selected_test_does_not_require_npm(self):
        (self.bin / 'npm').unlink()
        result = self.run_cli('--tests', str(self.test_file), '--only', 'test')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(all(call[0] == 'node' for call in self.calls()))

    def test_invalid_paths_fail_before_running_commands(self):
        outside = self.root.parent / 'outside.test.ts'
        link = self.test_file.with_name('escape.test.ts')
        link.symlink_to(outside)
        for value in ['.', '../outside.test.ts', 'src/utils/missing.test.ts', 'package.json', str(link)]:
            with self.subTest(path=value):
                result = self.run_cli('--tests', value)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(self.calls(), [])

    def test_tests_cannot_be_silently_ignored(self):
        result = self.run_cli('--tests', str(self.test_file), '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.calls(), [])

    def test_node_startup_failure_prevents_checks(self):
        self.set_control(startup_fail='node')
        result = self.run_cli('--only', 'test', 'typecheck', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('environment: FAIL', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertEqual(len(self.calls()), 1)

    def test_npm_startup_failure_prevents_checks(self):
        self.set_control(startup_fail='npm')
        result = self.run_cli('--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('npm startup failed', result.stdout)
        self.assertEqual(len(self.calls()), 2)

    def test_missing_node_is_environment_failure_without_ambient_fallback(self):
        (self.bin / 'node').unlink()
        result = self.run_cli('--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('node unavailable', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertEqual(self.calls(), [])

    def test_missing_npm_prevents_full_checks_without_ambient_fallback(self):
        (self.bin / 'npm').unlink()
        result = self.run_cli('--only', 'test')
        self.assertEqual(result.returncode, 2)
        self.assertIn('npm unavailable', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertEqual(len(self.calls()), 1)

    def test_missing_tool_is_environment_failure(self):
        (self.root / 'node_modules/tsx/dist/loader.mjs').unlink()
        result = self.run_cli('--tests', str(self.test_file), '--only', 'test')
        self.assertEqual(result.returncode, 2)
        self.assertIn('local dependency missing', result.stdout)
        self.assertEqual(len(self.calls()), 1)

    def test_check_failure_does_not_hide_later_results(self):
        self.set_control(check_exit=3)
        result = self.run_cli('--only', 'typecheck', 'lint')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(result.stdout.splitlines()), 2)
        self.assertIn('typecheck: FAIL (exit 3', result.stdout)
        self.assertIn('lint: FAIL (exit 3', result.stdout)
        self.assertNotIn('environment: FAIL', result.stdout)

    def test_real_check_exit_127_is_not_a_launch_failure(self):
        self.set_control(check_exit=127)
        result = self.run_cli('--only', 'lint')
        self.assertEqual(result.returncode, 1)
        self.assertIn('lint: FAIL (exit 127', result.stdout)
        self.assertNotIn('environment: FAIL', result.stdout)

    def test_launch_failure_after_preflight_is_environment_failure(self):
        self.set_control(disable_after_version='npm')
        result = self.run_cli('--only', 'lint')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('environment: FAIL (cannot start npm', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertNotIn('lint: FAIL', result.stdout)
        self.assertTrue(all(call[1] == ['--version'] for call in self.calls()))

    def test_later_launch_failure_preserves_completed_result(self):
        self.set_control(disable_after_check='npm')
        result = self.run_cli('--only', 'typecheck', 'lint')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('typecheck: PASS', result.stdout)
        self.assertIn('verification: INCOMPLETE (1 checks completed', result.stdout)
        self.assertNotIn('NOT RUN', result.stdout)

    def test_log_directory_failure_is_environment_failure(self):
        result = self.run_faulted_cli('directory', '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('environment: FAIL (log directory creation failed', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertEqual(result.stderr, '')
        self.assertEqual(self.calls(), [])

    def test_preflight_log_open_failure_is_environment_failure(self):
        result = self.run_faulted_cli('open', '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('environment: FAIL (cannot create or write node-version.log', result.stdout)
        self.assertIn('NOT RUN', result.stdout)
        self.assertEqual(result.stderr, '')
        self.assertEqual(self.calls(), [])

    def test_preflight_log_close_failure_does_not_claim_requested_checks_ran(self):
        result = self.run_faulted_cli('preflight-close', '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('NOT RUN', result.stdout)
        self.assertNotIn('INCOMPLETE', result.stdout)
        self.assertEqual(result.stderr, '')
        self.assertEqual(len(self.calls()), 1)

    def test_later_log_open_failure_preserves_completed_result(self):
        result = self.run_faulted_cli('check-log', '--only', 'typecheck', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('typecheck: PASS', result.stdout)
        self.assertIn('verification: INCOMPLETE (1 checks completed', result.stdout)
        self.assertNotIn('NOT RUN', result.stdout)
        self.assertEqual(result.stderr, '')
        self.assertEqual(len(self.calls()), 3)

    def test_summary_failure_does_not_hide_completed_check(self):
        result = self.run_faulted_cli('summary', '--only', 'lint')
        self.assertEqual(result.returncode, 2)
        self.assertIn('lint: PASS', result.stdout)
        self.assertIn('environment: FAIL (summary creation failed', result.stdout)
        self.assertIn('verification: INCOMPLETE (1 checks completed', result.stdout)
        self.assertNotIn('NOT RUN', result.stdout)
        self.assertEqual(result.stderr, '')

    def test_timeout_is_a_failed_check(self):
        self.set_control(timeout=True)
        result = self.run_cli('--only', 'lint', '--timeout', '1')
        self.assertEqual(result.returncode, 1)
        self.assertIn('lint: FAIL (exit 124', result.stdout)

    @unittest.skipUnless(os.name == 'posix', 'descendant cleanup uses POSIX process groups')
    def test_timeout_stops_descendants_and_preserves_unrelated_process(self):
        self.set_control(timeout=True, spawn_descendant=True)
        sentinel = self.root / 'unrelated-finished'
        unrelated = subprocess.Popen(
            [sys.executable, '-c',
             'import pathlib,sys,time; time.sleep(2); pathlib.Path(sys.argv[1]).write_text("finished")',
             str(sentinel)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        try:
            result = self.run_cli('--only', 'lint', '--timeout', '1')
            self.assertEqual(result.returncode, 1)
            self.assertIn('lint: FAIL (exit 124', result.stdout)
            self.assertTrue((self.root / 'descendant-started').exists())
            self.assertEqual(unrelated.wait(timeout=5), 0)
            time.sleep(0.3)
            self.assertTrue(sentinel.exists())
            self.assertFalse((self.root / 'descendant-finished').exists())
        finally:
            if unrelated.poll() is None:
                unrelated.kill()
                unrelated.wait()

    @unittest.skipUnless(os.name == 'posix', 'signal cleanup uses POSIX process groups')
    def test_signals_stop_descendants_and_preserve_unrelated_process(self):
        self.set_control(timeout=True, spawn_descendant=True)
        for signum in [signal.SIGINT, signal.SIGTERM]:
            with self.subTest(signal=signum):
                marker = self.root / 'descendant-started'
                marker.unlink(missing_ok=True)
                sentinel = self.root / 'unrelated-finished'
                sentinel.unlink(missing_ok=True)
                unrelated = subprocess.Popen(
                    [sys.executable, '-c',
                     'import pathlib,sys,time; time.sleep(2); pathlib.Path(sys.argv[1]).write_text("finished")',
                     str(sentinel)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                runner = subprocess.Popen(
                    [sys.executable, str(self.script), '--only', 'lint', '--timeout', '10'],
                    cwd=self.root, env=self.environment, stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, text=True)
                try:
                    deadline = time.monotonic() + 5
                    while not marker.exists() and time.monotonic() < deadline:
                        time.sleep(0.02)
                    self.assertTrue(marker.exists(), 'fixture descendant failed to start')
                    runner.send_signal(signum)
                    stdout, stderr = runner.communicate(timeout=5)
                    self.assertEqual(runner.returncode, 128 + signum, stderr)
                    self.assertIn(f'checks: CANCELLED ({signal.Signals(signum).name})', stdout)
                    self.assertEqual(stderr, '')
                    self.assertEqual(unrelated.wait(timeout=5), 0)
                    self.assertTrue(sentinel.exists())
                    self.assertFalse((self.root / 'descendant-finished').exists())
                finally:
                    if runner.poll() is None:
                        runner.kill()
                        runner.communicate()
                    pid_file = self.root / 'check-pid'
                    if pid_file.exists():
                        try:
                            os.killpg(int(pid_file.read_text()), signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                    if unrelated.poll() is None:
                        unrelated.kill()
                        unrelated.wait()

    def test_remote_and_restart_commands_are_rejected(self):
        for command in ['backend:deploy', 'smoke:edge', 'restart']:
            with self.subTest(command=command):
                result = self.run_cli('--only', command)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(self.calls(), [])


if __name__ == '__main__':
    unittest.main()
