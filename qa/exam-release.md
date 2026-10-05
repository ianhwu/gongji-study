# Exam wording release — 2026-10-05

- Removed the 852 reverse concept-lookup items from the generated bank. No active prompt contains `概念回忆`, `对应哪个考点`, or `该考点`.
- Replaced reliable items with 299 deduplicated questions using complete propositions, focused comparisons, and authored scenarios. Distractor descriptions come from the same topic and source chapter. Ages, traditional hours, months, physical phase changes, opportunity cost and Engel coefficient have explicitly authored stems and option-specific reasoning.
- Retained 422 previously authored items, including 62 multi-select questions and 91 Jilin questions. Total active bank: 721.
- Preserved all 1,152 knowledge IDs. 650 points have reviewed practice, 85 extracted statements await verification, and 417 await suitable questions. These statuses are exposed in course/coverage UI; there is no claim of complete practice coverage. Unclear statements are not standard answers.
- Retained the old questions server-side for grading drafts from a previously open tab. Question revisions prevent old option positions from being displayed as new answer text. Retired wrong-question records remain in the account and are listed as history.
- QA passed: complete-bank no-repeat practice, four shuffled explanations, single and multi grading, immediate result before network completion, account isolation, concurrent/deduplicated saves, revised and retired drafts, reference-only course controls, fixed Next dock and Jilin content.
- TypeScript check passed. Browser QA remains unavailable under the existing administrator restriction; no production fetch or browser bypass was attempted.
