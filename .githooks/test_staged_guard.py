#!/usr/bin/env python3
"""Exercise the installed staged guard through commits in temporary repositories."""

from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
GUARD = PROJECT_ROOT / ".githooks/scenenote-staged-guard.py"
INSTALLER = PROJECT_ROOT / ".githooks/install.py"
PRIVATE_FIXTURE = "fixture-private-value-do-not-print"


class Repository:
    def __init__(self, root):
        self.root = Path(root)
        self.env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.env.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull})
        self.git("init", "--quiet", "--template=")
        self.git("config", "user.name", "SceneNote hook test")
        self.git("config", "user.email", "hook-test@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")

    def git(self, *args, check=True, input=None):
        result = subprocess.run(
            ["git", *args], cwd=self.root, env=self.env, input=input,
            text=True, capture_output=True,
        )
        if check and result.returncode:
            raise AssertionError(f"git {args!r} failed: {result.stderr}")
        return result

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def stage(self, *paths):
        self.git("add", "--", *paths)

    def install_hook(self):
        (self.root / ".githooks").mkdir(exist_ok=True)
        shutil.copyfile(GUARD, self.root / ".githooks/scenenote-staged-guard.py")
        shutil.copyfile(INSTALLER, self.root / ".githooks/install.py")
        result = self.install()
        if result.returncode:
            raise AssertionError(result.stderr)

    def install(self, *args):
        return subprocess.run(
            ["python3", str(self.root / ".githooks/install.py"), *args],
            cwd=self.root, env=self.env, text=True, capture_output=True,
        )

    def commit(self):
        return self.git("commit", "--quiet", "-m", "isolated hook fixture", check=False)


@contextmanager
def repository(seed=None):
    with tempfile.TemporaryDirectory(prefix="scenenote-staged-guard-") as directory:
        repo = Repository(directory)
        for path, text in (seed or {"README.md": "fixture\n"}).items():
            repo.write(path, text)
            repo.stage(path)
        repo.git("commit", "--quiet", "-m", "fixture baseline")
        repo.install_hook()
        yield repo


class StagedGuardTests(unittest.TestCase):
    def assert_silent_success(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def assert_blocked(self, repo, result, reason):
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(reason, result.stderr)
        self.assertNotIn(PRIVATE_FIXTURE, result.stdout + result.stderr)
        self.assertEqual(repo.git("rev-list", "--count", "HEAD").stdout.strip(), "1")

    def test_clean_commit_is_silent(self):
        with repository() as repo:
            repo.write("src/clean.ts", "export const value = 1;\n")
            repo.stage("src/clean.ts")
            self.assert_silent_success(repo.commit())

    def test_sensitive_paths_are_blocked_without_printing_contents(self):
        paths = [
            ".env", ".env.local", "config/.env.production", "nested/.ENV.TEST",
            "keys/id_rsa", "keys/id_ed25519", "keys/client.key", "keys/client.P12",
            "keys/client.pfx", "한국어/비밀\n파일.key",
        ]
        for path in paths:
            with self.subTest(path=path), repository() as repo:
                repo.write(path, PRIVATE_FIXTURE + "\n")
                repo.stage(path)
                self.assert_blocked(repo, repo.commit(), "environment/private-key path")

    def test_environment_examples_and_public_key_are_allowed(self):
        with repository() as repo:
            paths = [".env.example", "config/.env.sample", ".env.template", "keys/id_ed25519.pub"]
            for path in paths:
                repo.write(path, "PLACEHOLDER=value\n")
                repo.stage(path)
            self.assert_silent_success(repo.commit())

    def test_trailing_whitespace_is_blocked_without_printing_contents(self):
        with repository() as repo:
            repo.write("src/whitespace.ts", PRIVATE_FIXTURE + "  \n")
            repo.stage("src/whitespace.ts")
            self.assert_blocked(repo, repo.commit(), "whitespace/conflict-marker")

    def test_conflict_markers_are_blocked(self):
        with repository() as repo:
            repo.write("src/conflict.ts", "<<<<<<< local\n" + PRIVATE_FIXTURE + "\n=======\nremote\n>>>>>>> remote\n")
            repo.stage("src/conflict.ts")
            self.assert_blocked(repo, repo.commit(), "whitespace/conflict-marker")

    def test_clean_staged_content_ignores_unstaged_whitespace(self):
        with repository() as repo:
            repo.write("src/partial.ts", "const value = 1;\n")
            repo.stage("src/partial.ts")
            repo.write("src/partial.ts", PRIVATE_FIXTURE + "  \n")
            repo.write(".env.local", PRIVATE_FIXTURE + "\n")
            self.assert_silent_success(repo.commit())
            self.assertEqual(repo.git("show", "HEAD:src/partial.ts").stdout, "const value = 1;\n")

    def test_dirty_staged_content_remains_blocked_when_worktree_fixed(self):
        with repository() as repo:
            repo.write("src/partial.ts", PRIVATE_FIXTURE + "  \n")
            repo.stage("src/partial.ts")
            repo.write("src/partial.ts", "const value = 1;\n")
            self.assert_blocked(repo, repo.commit(), "whitespace/conflict-marker")

    def test_commit_only_checks_the_index_git_will_commit(self):
        with repository() as repo:
            repo.write("src/clean.ts", "export const value = 1;\n")
            repo.write(".env.local", PRIVATE_FIXTURE + "\n")
            repo.stage("src/clean.ts", ".env.local")
            result = repo.git(
                "commit", "--quiet", "--only", "src/clean.ts", "-m", "isolated partial commit",
                check=False,
            )
            self.assert_silent_success(result)
            self.assertEqual(repo.git("diff", "--cached", "--name-only").stdout, ".env.local\n")

    def test_sensitive_symlink_changed_to_regular_file_is_blocked(self):
        with tempfile.TemporaryDirectory(prefix="scenenote-staged-typechange-") as directory:
            repo = Repository(directory)
            repo.write("README.md", "fixture\n")
            (repo.root / ".env").symlink_to("README.md")
            repo.stage("README.md", ".env")
            repo.git("commit", "--quiet", "-m", "fixture baseline")
            repo.install_hook()
            (repo.root / ".env").unlink()
            repo.write(".env", PRIVATE_FIXTURE + "\n")
            repo.stage(".env")
            self.assertEqual(repo.git("diff", "--cached", "--name-status").stdout, "T\t.env\n")
            self.assert_blocked(repo, repo.commit(), "environment/private-key path")

    def test_staged_secret_deletion_is_allowed(self):
        with repository({".env.local": PRIVATE_FIXTURE + "\n"}) as repo:
            repo.git("rm", "--quiet", "--", ".env.local")
            self.assert_silent_success(repo.commit())

    def test_rename_to_secret_path_is_blocked(self):
        with repository({"settings.txt": PRIVATE_FIXTURE + "\n"}) as repo:
            repo.git("mv", "--", "settings.txt", ".env.production")
            self.assert_blocked(repo, repo.commit(), "environment/private-key path")

    def test_rename_away_from_secret_path_is_allowed(self):
        with repository({".env.local": "PLACEHOLDER=value\n"}) as repo:
            repo.git("mv", "--", ".env.local", ".env.example")
            self.assert_silent_success(repo.commit())

    def test_safe_unicode_and_newline_paths_are_allowed(self):
        with repository() as repo:
            path = "메모/장면\n기록.txt"
            repo.write(path, "깨끗한 기록\n")
            repo.stage(path)
            self.assert_silent_success(repo.commit())

    def test_git_failure_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory(prefix="scenenote-staged-no-repo-") as directory:
            result = subprocess.run(
                ["python3", str(GUARD)], cwd=directory, text=True, capture_output=True,
                env={key: value for key, value in os.environ.items() if not key.startswith("GIT_")},
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("could not read the index", result.stderr)

    def test_missing_git_fails_without_a_traceback(self):
        with tempfile.TemporaryDirectory(prefix="scenenote-staged-no-git-") as directory:
            env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
            env["PATH"] = directory
            result = subprocess.run(
                [sys.executable, str(GUARD)], cwd=directory, env=env,
                text=True, capture_output=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("could not start Git", result.stderr)
            self.assertNotIn("Traceback", result.stderr)
            self.assertNotIn(PRIVATE_FIXTURE, result.stdout + result.stderr)

    def test_install_is_idempotent_and_check_does_not_write(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            baseline = (hook.read_bytes(), hook.stat().st_mtime_ns, hook.stat().st_mode)
            self.assertEqual(repo.install().returncode, 0)
            self.assertEqual(repo.install("--check").returncode, 0)
            self.assertEqual((hook.read_bytes(), hook.stat().st_mtime_ns, hook.stat().st_mode), baseline)

    def test_unrelated_hook_is_preserved(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            hook.write_text("#!/bin/sh\nexit 77\n")
            baseline = hook.read_bytes()
            result = repo.install()
            self.assertEqual(result.returncode, 2)
            self.assertIn("existing pre-commit hook was preserved", result.stderr)
            self.assertEqual(hook.read_bytes(), baseline)

    def test_custom_hook_configuration_is_preserved(self):
        with repository() as repo:
            repo.git("config", "core.hooksPath", "custom-hooks")
            custom = repo.root / "custom-hooks"
            result = repo.install()
            self.assertEqual(result.returncode, 2)
            self.assertIn("core.hooksPath is configured", result.stderr)
            self.assertFalse(custom.exists())
            self.assertEqual(repo.git("config", "--get", "core.hooksPath").stdout.strip(), "custom-hooks")

    def test_symlink_hook_is_preserved(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            hook.unlink()
            target = repo.root / "existing-hook"
            target.write_text("#!/bin/sh\nexit 77\n")
            hook.symlink_to(target)
            result = repo.install()
            self.assertEqual(result.returncode, 2)
            self.assertTrue(hook.is_symlink())
            self.assertEqual(target.read_text(), "#!/bin/sh\nexit 77\n")

    def test_shared_symlink_hook_directory_is_preserved(self):
        with repository() as repo, tempfile.TemporaryDirectory(prefix="scenenote-shared-hooks-") as target:
            hooks = repo.root / ".git/hooks"
            (hooks / "pre-commit").unlink()
            hooks.rmdir()
            hooks.symlink_to(target, target_is_directory=True)
            marker = Path(target) / "existing-file"
            marker.write_text("preserve shared setup\n")
            for options in ((), ("--check",)):
                with self.subTest(options=options):
                    result = repo.install(*options)
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("hook directory symlink was preserved", result.stderr)
                    self.assertTrue(hooks.is_symlink())
                    self.assertEqual(list(Path(target).iterdir()), [marker])
                    self.assertEqual(marker.read_text(), "preserve shared setup\n")

    def test_separate_git_directory_installation_and_commit(self):
        with tempfile.TemporaryDirectory(prefix="scenenote-separate-git-") as directory:
            root = Path(directory)
            checkout = root / "checkout"
            checkout.mkdir()
            repo = Repository(checkout)
            git_dir = root / "metadata"
            repo.git("init", "--quiet", "--separate-git-dir", str(git_dir))
            repo.install_hook()
            self.assertTrue((git_dir / "hooks/pre-commit").is_file())
            self.assertEqual(repo.install("--check").returncode, 0)
            repo.write("README.md", "fixture\n")
            repo.stage("README.md")
            self.assert_silent_success(repo.commit())

    def test_invalid_guard_syntax_is_not_active_and_does_not_write(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            baseline = (hook.read_bytes(), hook.stat().st_mtime_ns, hook.stat().st_mode)
            repo.write(".githooks/scenenote-staged-guard.py", "def invalid " + PRIVATE_FIXTURE + "\n")
            for options in ((), ("--check",)):
                with self.subTest(options=options):
                    result = repo.install(*options)
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("staged guard is not valid Python", result.stderr)
                    self.assertNotIn("active", result.stdout)
                    self.assertNotIn(PRIVATE_FIXTURE, result.stdout + result.stderr)
                    self.assertNotIn("Traceback", result.stderr)
                    self.assertEqual((hook.read_bytes(), hook.stat().st_mtime_ns, hook.stat().st_mode), baseline)

    def test_check_for_missing_hook_does_not_install(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            hook.unlink()
            result = repo.install("--check")
            self.assertEqual(result.returncode, 1)
            self.assertIn("not installed", result.stderr)
            self.assertFalse(hook.exists())

    def test_known_nonexecutable_wrapper_can_be_reactivated(self):
        with repository() as repo:
            hook = repo.root / ".git/hooks/pre-commit"
            hook.chmod(0o644)
            self.assertEqual(repo.install("--check").returncode, 1)
            self.assertEqual(repo.install().returncode, 0)
            self.assertTrue(os.access(hook, os.X_OK))


if __name__ == "__main__":
    unittest.main()
