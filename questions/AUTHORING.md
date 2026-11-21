# Question bank authoring guide

The quiz is for a fresher finishing an M.Tech, preparing for Data Analyst interviews and online
assessments in India (Bengaluru, Pune, Hyderabad, remote). Questions should feel like what she will
meet in those screens: practical, accurate, not trivia for its own sake, with a few hard ones that
test real understanding.

## File format

One JSON file per track: `questions/<track>.json`, a JSON array of objects:

```json
{
  "id": "pd-001",
  "track": "pandas",
  "topic": "groupby",
  "difficulty": "medium",
  "type": "output",
  "prompt": "What does this code print?",
  "code": "import pandas as pd\ndf = pd.DataFrame({'a': [1, 1, 2]})\nprint(df.groupby('a').size().tolist())",
  "options": ["[2, 1]", "[1, 2]", "[3]", "[1, 1, 2]"],
  "answer": [0],
  "explanation": "groupby('a').size() counts rows per group: a=1 has 2 rows, a=2 has 1."
}
```

| Field | Rules |
|---|---|
| `id` | `<prefix>-NNN`, zero-padded, unique. Prefixes: python `py`, numpy `np`, pandas `pd`, viz `viz`, cleaning `eda`, stats `st`, sklearn `sk`. |
| `track` | One of `python`, `numpy`, `pandas`, `viz`, `cleaning`, `stats`, `sklearn`. |
| `topic` | Short lowercase subtopic, e.g. `comprehensions`, `broadcasting`, `merge`, `p-values`. |
| `difficulty` | `easy`, `medium`, `hard`. Aim for about 35% easy, 45% medium, 20% hard. |
| `type` | `mcq` (one correct of 4), `output` (predict the output of `code`, one correct of 4), `multi` (select all that apply, 4-6 options, 2+ correct, 1+ wrong). |
| `prompt` | Plain text. Wrap inline code in single backticks, e.g. `` `df.loc` ``. No markdown headings, bold or links. Multi-select prompts must end with "Select all that apply." |
| `code` | Optional for `mcq`/`multi` (shown as a highlighted Python block), required for `output`. Use `\n` newlines and 4-space indents. Keep it short: ideally 3-12 lines. |
| `options` | Plain strings. For `output`, each option is the literal printed text (multi-line allowed with `\n`). Inline backticks are fine in mcq/multi options. |
| `answer` | List of 0-based indices into `options`. Vary the position of the correct answer; don't always put it first. |
| `explanation` | 1-3 sentences: why the right answer is right, and the trap in the most tempting wrong option when there is one. |

## Accuracy rules (most important)

1. Every `output` question is executed by `questions/verify.py` under two environments: current
   libraries (Python 3.12, numpy 2.5, pandas 3.1, scikit-learn 1.9) and pandas 2.2 / numpy 2.0 /
   scikit-learn 1.6. The marked option must equal the real stdout exactly, in both. Run
   `.venv/bin/python questions/verify.py <track>` from the project root and fix everything it
   reports. Don't hand back a file that fails.
2. If the snippet is meant to raise, the expected output is whatever it printed first followed by
   the exception class name on its own line, e.g. `"KeyError"` or `"[1, 2]\nTypeError"`.
3. Avoid output that differs between pandas 2 and pandas 3 or is fragile: string dtype names
   (`object` vs `str`), chained-assignment / SettingWithCopy behaviour, copy-vs-view semantics that
   Copy-on-Write changed, wide DataFrame reprs, float reprs with long tails, dict/set ordering that
   isn't guaranteed, memory addresses, random numbers without a fixed seed (prefer avoiding
   randomness entirely in output questions). Prefer printing `.tolist()`, scalars, tuples, `shape`,
   small Series, or `.to_dict()`.
4. For `mcq` and `multi` questions whose correctness depends on library behaviour, check the claim
   by running code in `.venv/bin/python` before writing it down. Statistics facts must be
   textbook-correct; when a statement is debatable, don't use it.
5. Distractors must be plausible (common mistakes), but unambiguously wrong. No "all of the above"
   or "none of the above".
6. No duplicate questions, and no near-duplicates that test the same fact with renamed variables.
   Cover the listed subtopics broadly.
