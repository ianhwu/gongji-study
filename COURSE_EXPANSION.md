# Course expansion (2026-10-05)

The original course UI showed just 36 outline cards. This update brings 13 study units, 78 overview cards, 328 source reading chapters and 554 source-derived knowledge-heading navigation entries into the course UI. Course navigation opens the complete chapter reading surface, supports source selection and title search, PDF page jumps and full-book reading, including covers and appendices.

All 1878 pages are accessible through full-book ranges. The raw public data.js payload is byte-identical to the already published baseline. The 72 published questions are unchanged. This reorganizes the existing public document corpus; it does not upload or extract new PDF text. Additional unpublished quiz questions remain in the separate site checkout.

Logged-in readers can save chapter positions and learned status through the existing study_progress table. No production migration changes are introduced. Existing user records are retained. Asset hashes in the HTML prevent stale script versions after updates.

Checked every chapter range and knowledge-heading source reference; exercised all 328 chapter render paths, keyword filtering, source switching, PDF page jumps, persisted chapter progress and the existing account/quiz flows. Types and Worker build are also checked.
