# Repository Instructions

## Parent/child navigation must form a complete loop

- When adding a document series, wizard, pager, or any other parent/child navigation, verify both directions. A child-to-parent or previous-page link does not replace the parent-to-first-child or next-page link.
- For a series with an overview at position 0, the overview must link to the first published document through the same bottom pager used by child documents.
- Verify every boundary state: overview → first document, first document → overview, each middle document → previous and next, and the final document → previous with no empty next control.
- Apply and verify the same navigation behavior in every supported locale.
- Check the rendered page or generated HTML for the actual `href`; do not consider navigation complete based only on loader data, an inline body link, or the child page implementation.
