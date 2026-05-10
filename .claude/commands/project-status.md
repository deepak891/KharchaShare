# Project Status — KharchaShare

Read `docs/FEATURES.md` and report the current project status.
Structure your answer as follows:

---

## What to report

### 1. Built and working
List every ✅ feature from `docs/FEATURES.md`. For each:
- What it does (one line)
- Which file(s) implement it

### 2. Partially built
List every 🚧 item. For each:
- What's done
- What's missing
- Effort to complete (small / medium / large)

### 3. Planned but not started
List every 📋 item from the "What's Next" section.
Group by: **Quick wins** (can be done in one session) vs **Larger features** (multi-session).

### 4. Known technical debt
Report any of these if present:
- Mock data still used in a screen that has real API endpoints available
- `TODO` or `FIXME` comments
- Hardcoded values that should come from config/constants
- In-memory storage that needs database backing
- Missing error handling
- TypeScript errors or `any` types

### 5. Recommended next steps
Based on what's built and what's planned, suggest the best 2-3 features to tackle next.
Consider: user value, dependencies (what must be built before X), and effort.

---

## Format

Be concise. Use tables where they help. No paragraph prose — bullet points and tables only.
End with a one-line overall assessment: "MVP is X% complete — the main gap is Y."
