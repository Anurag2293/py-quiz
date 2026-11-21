"""Validate the question bank and run every predict-the-output snippet.

Usage:
    .venv/bin/python questions/verify.py [track ...]

For each `output` question the snippet is executed in a fresh interpreter under
both .venv (current pandas/numpy) and .venv-pandas2 (pandas 2.2). The captured
stdout must equal the correct option exactly (after normalisation), must match
in both environments, and must not equal any distractor. If the snippet raises,
the exception class name is appended to stdout, so an option such as
"KeyError" or "[1, 2]\nTypeError" can be the expected answer.
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "questions"
ENVS = {
    "current": ROOT / ".venv" / "bin" / "python",
    "pandas2": ROOT / ".venv-pandas2" / "bin" / "python",
}

TRACKS = {
    "python": "py",
    "numpy": "np",
    "pandas": "pd",
    "viz": "viz",
    "cleaning": "eda",
    "stats": "st",
    "sklearn": "sk",
}
DIFFICULTIES = {"easy", "medium", "hard"}
TYPES = {"mcq", "output", "multi"}

RUNNER = r"""
import sys, warnings, os
os.environ.setdefault("MPLBACKEND", "Agg")
warnings.filterwarnings("ignore")
src = sys.stdin.read()
g = {"__name__": "__main__"}
try:
    exec(compile(src, "<snippet>", "exec"), g)
except BaseException as e:
    sys.stdout.flush()
    print(type(e).__name__)
"""


def normalise(text: str) -> str:
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    return "\n".join(lines).strip("\n")


def run_snippet(python: Path, code: str) -> str:
    proc = subprocess.run(
        [str(python), "-I", "-c", RUNNER],
        input=code,
        capture_output=True,
        text=True,
        timeout=60,
        cwd="/tmp",
        env={"PATH": "/usr/bin:/bin", "MPLBACKEND": "Agg", "PYTHONHASHSEED": "0"},
    )
    return normalise(proc.stdout)


def check_schema(q: dict, track: str, errors: list[str]) -> None:
    qid = q.get("id", "<missing id>")

    def err(msg: str) -> None:
        errors.append(f"{qid}: {msg}")

    prefix = TRACKS[track]
    if not isinstance(q.get("id"), str) or not q["id"].startswith(prefix + "-"):
        err(f"id must start with '{prefix}-'")
    if q.get("track") != track:
        err(f"track must be '{track}'")
    if q.get("difficulty") not in DIFFICULTIES:
        err("difficulty must be easy/medium/hard")
    if q.get("type") not in TYPES:
        err("type must be mcq/output/multi")
    if not isinstance(q.get("prompt"), str) or len(q["prompt"].strip()) < 10:
        err("prompt missing or too short")
    if "code" in q and (not isinstance(q["code"], str) or not q["code"].strip()):
        err("code, when present, must be a non-empty string")
    if not isinstance(q.get("explanation"), str) or len(q["explanation"].strip()) < 15:
        err("explanation missing or too short")
    if not isinstance(q.get("topic"), str) or not q["topic"].strip():
        err("topic missing")
    opts = q.get("options")
    if not isinstance(opts, list) or not all(isinstance(o, str) and o.strip() for o in opts):
        err("options must be a list of non-empty strings")
        return
    if len(set(normalise(o) for o in opts)) != len(opts):
        err("duplicate options")
    ans = q.get("answer")
    if not isinstance(ans, list) or not ans or not all(isinstance(a, int) for a in ans):
        err("answer must be a non-empty list of option indices")
        return
    if any(a < 0 or a >= len(opts) for a in ans) or len(set(ans)) != len(ans):
        err("answer index out of range or repeated")
    t = q.get("type")
    if t in ("mcq", "output"):
        if len(ans) != 1:
            err(f"{t} must have exactly one correct answer")
        if not 3 <= len(opts) <= 5:
            err(f"{t} must have 3-5 options")
    if t == "multi":
        if not 4 <= len(opts) <= 6:
            err("multi must have 4-6 options")
        if not 2 <= len(ans) < len(opts):
            err("multi must have at least 2 correct answers and at least 1 wrong one")
        if "select all" not in q.get("prompt", "").lower():
            err("multi prompt must say 'Select all that apply'")
    if t == "output" and not q.get("code"):
        err("output question needs code")


def main(selected: list[str]) -> int:
    tracks = selected or list(TRACKS)
    errors: list[str] = []
    all_q: list[dict] = []
    for track in tracks:
        path = QDIR / f"{track}.json"
        if not path.exists():
            print(f"[skip] {path.name} not found")
            continue
        try:
            qs = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{path.name}: invalid JSON: {e}")
            continue
        for q in qs:
            check_schema(q, track, errors)
        all_q.extend(qs)

    ids = Counter(q.get("id") for q in all_q)
    errors += [f"{i}: duplicate id" for i, n in ids.items() if n > 1]
    prompts = Counter(normalise(q.get("prompt", "") + "\n" + q.get("code", "")) for q in all_q)
    errors += [f"duplicate prompt+code: {p[:60]!r}" for p, n in prompts.items() if n > 1]

    outputs = [q for q in all_q if q.get("type") == "output" and q.get("code")]

    def verify(q: dict) -> list[str]:
        errs = []
        results = {name: run_snippet(py, q["code"]) for name, py in ENVS.items() if py.exists()}
        cur = results.get("current")
        if len(set(results.values())) > 1:
            errs.append(f"{q['id']}: output differs between environments: {results!r}")
        opts = [normalise(o) for o in q["options"]]
        correct = opts[q["answer"][0]] if q["answer"] and q["answer"][0] < len(opts) else None
        if cur != correct:
            errs.append(f"{q['id']}: actual output {cur!r} != marked answer {correct!r}")
        for i, o in enumerate(opts):
            if i != q["answer"][0] and o == cur:
                errs.append(f"{q['id']}: distractor {i} equals the actual output")
        return errs

    with ThreadPoolExecutor(max_workers=8) as pool:
        for errs in pool.map(verify, outputs):
            errors += errs

    by_track = Counter(q.get("track") for q in all_q)
    by_diff = Counter((q.get("track"), q.get("difficulty")) for q in all_q)
    by_type = Counter((q.get("track"), q.get("type")) for q in all_q)
    for t in tracks:
        if by_track[t]:
            d = {k: by_diff[(t, k)] for k in ("easy", "medium", "hard")}
            ty = {k: by_type[(t, k)] for k in ("mcq", "output", "multi")}
            print(f"{t:9s} {by_track[t]:4d}  {d}  {ty}")
    print(f"total     {len(all_q):4d}  output snippets run: {len(outputs)}")

    if errors:
        print(f"\n{len(errors)} problem(s):")
        for e in errors:
            print("  -", e)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
