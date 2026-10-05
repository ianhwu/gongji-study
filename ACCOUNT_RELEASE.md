# Account release (2026-10-02)

This release adds a visible account entry, dispatch-owned ChatGPT sign-in/sign-out, server-checked progress APIs, per-user D1 persistence, legacy browser record import and continuous random practice.

It uses exactly the modules, questions and source pages from the already published baseline. The unpublished expanded edition stays in the separate site checkout. No new PDF text is added to the public site by this release.

Hosting uses a Worker and the DB binding. Initial migration 0000_vengeful_owl creates study_progress. Source SQL is schema-only and is applied by Sites before the Worker is published.

Check current functionality with node qa/verify.mjs. Build generated pages with python3 build.py before the normal Sites Worker build. Do not run the old repair-course.py to build a login release.
