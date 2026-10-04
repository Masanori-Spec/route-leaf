# Compiler method

1. Bound the ZIP before extraction, reject unsafe paths, encrypted/multipart inputs, macros, external links, DTDs and formula cells. Read worksheet cells with a strict XML parser.
2. Parse only the explicit profile. Combine each question's relevance with its ancestor group conditions. Resolve references only to already-declared required single-choice questions and existing nonempty choice codes. No JavaScript evaluation or arbitrary XPath is used.
3. Traverse source order. An irrelevant controller has no answer at all. Branch over a select's choices only when that field is syntactically referenced in some later relevance expression. Other selects retain all answer choices on their card but have one shared continuation.
4. Count complete reachable assignments to those routing controls. Different assignments may yield the same question sequence. This is not a minimal path/sequence count or semantic dead-expression optimizer. Abort above 512 histories.
5. Build continuations backward and intern identical tuples of source-question index and destination identities. This creates a reduced directed acyclic graph. Identical prompts alone are not sufficient to merge cards: every outgoing answer destination must also match.
6. Sort surviving nodes by source question position, assign C01… IDs and two cards per booklet page. Abort above 80 cards. Every target points forward or to END.
7. Validate glyph coverage and measure every printed label, group breadcrumb, hint, choice and destination with the embedded font. If any card or answer row overflows, reject before exporting.

The manifest retains original question identity independently of card identity. Unreachable questions are reported and retain one answer-sheet row. Card variants never create extra answer-sheet rows.

Suffix interning is established graph engineering. No new graph algorithm or patent novelty is claimed.
