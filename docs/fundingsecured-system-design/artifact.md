# FundingSecured system-design template contract

## Reference

- Retained source: `/Users/adityadas/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-system-design/assets/reference.docx`
- SHA-256: `13504f6c221a42c1726460a9e865e563355539ff97d702d6c9b2267b4b261d76`
- Rendered pages: 7; sections: 1.
- Evidence: `/tmp/fundingsecured-system-design/template-reference-render` and `/tmp/fundingsecured-system-design/template-style-evidence.json`.

## Page system

- US Letter portrait, 8.5 x 11 inches.
- Margins: 0.70 inch left/right/top and 0.62 inch bottom.
- One section, new-page start, different first page enabled. Header/footer are not linked.
- First page is an airy cover with title, three metadata columns, and a compact three-row metadata table. The optional related-docs row is intentionally removed so the cover remains intact. Later pages use a centered blue-gray footer.

## Typography and palette

- Embedded Helvetica Neue family controls the document. Body text is dark slate; headings use navy `#0B2F52`; secondary labels use blue-gray `#5B7085`.
- Preserve each source paragraph's run properties, alignment, spacing, keep behavior, numbering, and direct formatting. Replacement content goes into the first existing text run; remaining placeholder runs are cleared.
- Section headings retain the source's numbered heading treatment. Table headers retain navy fill with white bold type. Alternating body rows retain the pale-blue and near-white fills.

## Lists, tables, and components

- Preserve all nine source tables, their explicit widths, column grids, cell margins, fills, and border rules. The cover table retains its source styling with the optional related-docs row removed.
- Preserve the existing alphabetic numbering definitions for request lifecycle, guarantees, security, and open questions.
- Replace the single architecture image in-place without changing its relationship or drawing geometry.
- Preserve title block, metadata strip, caption, all recurring page furniture, footnote, and final milestone table.

## Content flow and slot map

1. Cover: product name, RFC title, status, owner, date, authors, reviewers, related docs, and US biomedical funding scope.
2. Abstract; goals and non-goals; background and problem statement.
3. Proposed architecture figure and five core components.
4. Request lifecycle; primary `FundingOpportunity` data contract; grounding guarantees.
5. Consistency/replay; security/privacy; operational readiness.
6. Alternatives; open decisions; milestone-based next steps.

Editable slots are direct body paragraphs and cells in `word/document.xml`, the image payload at `word/media/image1.png`, and the recurring footer text in `word/footer1.xml`. All headers, embedded fonts, numbering, styles, theme, relationships, footnotes, section properties, and drawing anchors are preserve-only.

## Package preservation

- Preserve-only parts: `_rels/.rels`, `[Content_Types].xml`, `word/header1.xml`, `word/header2.xml`, `word/footer2.xml`, `word/footnotes.xml`, `word/numbering.xml`, `word/settings.xml`, `word/fontTable.xml`, `word/_rels/fontTable.xml.rels`, `word/styles.xml`, `word/_rels/document.xml.rels`, `word/theme/theme1.xml`, and all eight embedded font files.
- Editable parts: `word/document.xml`, `word/footer1.xml`, and `word/media/image1.png`.
- Baseline package has 24 parts. No relationships, opaque parts, content controls, comments, or custom XML are present.

## Fidelity gates

- Retained reference must remain byte-for-byte unchanged at the recorded SHA-256.
- Final output must retain one section, original page geometry, embedded fonts, all nine tables, numbering, headers/footers, footnote, and the original image relationship.
- Render-and-diff must show only expected content reflow, architecture-image replacement, and footer/title changes.
- Every final page must be visually inspected for clipped text, broken tables, missing glyphs, accidental placeholders, and footer drift.
