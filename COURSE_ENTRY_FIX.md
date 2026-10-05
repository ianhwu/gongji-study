# Course entry repair (2026-10-02)

The live version 1 course navigation showed an uninitialized lesson. This release changes only its navigation handler to populate the selected course before displaying the lesson view. All deployed document text and question data remain byte-identical to version 1.

The complete account-backed edition remains in commit 58c4e488133de1000e262fbb58b10c757bbc2c8f and in the separate site checkout. It is not published by this static repair. Its disclosure audience is still awaiting an explicit user choice. To publish that edition later, restore its hosting manifest, migrations and build script, remove the repair-only baseline, and rebuild and save it as a new version.

Reproduce static output: python3 repair-course.py
Regression check: node verify-course.mjs
