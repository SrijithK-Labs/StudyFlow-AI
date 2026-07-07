"""
Module 15 — Code Executor
Sandboxed code execution for programming lessons.
Supports Python execution with timeout and safety checks.
"""
import subprocess
import tempfile
import os
import ast
import re
from dataclasses import dataclass, field


@dataclass
class CodeExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float
    success: bool
    language: str = "python"
    error_type: str = ""


# ── Safety: blocked imports and builtins ────────────────────────

BLOCKED_IMPORTS = {
    "os", "sys", "subprocess", "shutil", "pathlib",
    "socket", "http", "urllib", "requests",
    "ctypes", "importlib", "code", "compile",
}

BLOCKED_BUILTINS = {
    "exec", "eval", "compile", "__import__",
    "open", "globals", "locals", "vars",
    "breakpoint", "exit", "quit",
}


class CodeExecutor:
    """
    Executes code in a sandboxed subprocess with timeout.
    """

    def __init__(self, timeout_seconds: int = 10):
        self.timeout = timeout_seconds

    def extract_code_blocks(self, text: str) -> list[dict]:
        """Extract code blocks from markdown text."""
        pattern = r'```(\w+)?\n(.*?)```'
        matches = re.findall(pattern, text, re.DOTALL)
        blocks = []
        for lang, code in matches:
            lang = (lang or "python").lower()
            if lang in ("python", "py"):
                blocks.append({"language": "python", "code": code.strip()})
            elif lang in ("javascript", "js"):
                blocks.append({"language": "javascript", "code": code.strip()})
        return blocks

    def validate_python(self, code: str) -> tuple[bool, str]:
        """Static safety check for Python code."""
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {e}"

        for node in ast.walk(tree):
            # Check imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    mod = alias.name.split(".")[0]
                    if mod in BLOCKED_IMPORTS:
                        return False, f"Blocked import: {alias.name}"

            if isinstance(node, ast.ImportFrom):
                if node.module:
                    mod = node.module.split(".")[0]
                    if mod in BLOCKED_IMPORTS:
                        return False, f"Blocked import: {node.module}"

            # Check function calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in BLOCKED_BUILTINS:
                        return False, f"Blocked function: {node.func.id}"

        return True, "OK"

    async def execute(self, code: str, language: str = "python") -> CodeExecutionResult:
        """Execute code in a sandboxed subprocess."""
        if language == "python":
            return self._execute_python(code)
        elif language == "javascript":
            return self._execute_javascript(code)
        else:
            return CodeExecutionResult(
                stdout="", stderr=f"Unsupported language: {language}",
                exit_code=1, execution_time_ms=0, success=False,
                language=language, error_type="unsupported",
            )

    def _execute_python(self, code: str) -> CodeExecutionResult:
        # Safety check
        valid, msg = self.validate_python(code)
        if not valid:
            return CodeExecutionResult(
                stdout="", stderr=f"Safety check failed: {msg}",
                exit_code=1, execution_time_ms=0, success=False,
                language="python", error_type="safety",
            )

        import time
        start = time.time()

        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False, encoding="utf-8"
            ) as f:
                f.write(code)
                tmp_path = f.name

            result = subprocess.run(
                ["python", tmp_path],
                capture_output=True, text=True,
                timeout=self.timeout,
            )

            elapsed_ms = round((time.time() - start) * 1000, 2)

            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            return CodeExecutionResult(
                stdout=result.stdout[:5000],
                stderr=result.stderr[:2000],
                exit_code=result.returncode,
                execution_time_ms=elapsed_ms,
                success=(result.returncode == 0),
                language="python",
                error_type="" if result.returncode == 0 else "runtime",
            )

        except subprocess.TimeoutExpired:
            elapsed_ms = round((time.time() - start) * 1000, 2)
            return CodeExecutionResult(
                stdout="", stderr=f"Execution timed out ({self.timeout}s limit)",
                exit_code=-1, execution_time_ms=elapsed_ms,
                success=False, language="python", error_type="timeout",
            )
        except Exception as e:
            elapsed_ms = round((time.time() - start) * 1000, 2)
            return CodeExecutionResult(
                stdout="", stderr=str(e),
                exit_code=-1, execution_time_ms=elapsed_ms,
                success=False, language="python", error_type="exception",
            )

    def _execute_javascript(self, code: str) -> CodeExecutionResult:
        import time
        start = time.time()

        try:
            result = subprocess.run(
                ["node", "-e", code],
                capture_output=True, text=True,
                timeout=self.timeout,
            )
            elapsed_ms = round((time.time() - start) * 1000, 2)

            return CodeExecutionResult(
                stdout=result.stdout[:5000],
                stderr=result.stderr[:2000],
                exit_code=result.returncode,
                execution_time_ms=elapsed_ms,
                success=(result.returncode == 0),
                language="javascript",
                error_type="" if result.returncode == 0 else "runtime",
            )

        except FileNotFoundError:
            return CodeExecutionResult(
                stdout="", stderr="Node.js not installed",
                exit_code=-1, execution_time_ms=0,
                success=False, language="javascript", error_type="missing_runtime",
            )
        except subprocess.TimeoutExpired:
            elapsed_ms = round((time.time() - start) * 1000, 2)
            return CodeExecutionResult(
                stdout="", stderr=f"Execution timed out ({self.timeout}s limit)",
                exit_code=-1, execution_time_ms=elapsed_ms,
                success=False, language="javascript", error_type="timeout",
            )
        except Exception as e:
            elapsed_ms = round((time.time() - start) * 1000, 2)
            return CodeExecutionResult(
                stdout="", stderr=str(e),
                exit_code=-1, execution_time_ms=elapsed_ms,
                success=False, language="javascript", error_type="exception",
            )


# Global singleton
code_executor = CodeExecutor()
