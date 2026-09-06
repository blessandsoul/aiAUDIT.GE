# Conversation width repair

One 1080px shared cap for conversation and composer; grid explicitly uses
minmax(0,1fr) so intrinsic content cannot shrink its column. Mobile padding and
the initial landing composer remain unchanged. No audit/lead/API logic changed.

Chrome CUA rendered checks on localhost:3350:

| Viewport | Conversation | Composer | Page horizontal overflow |
| --- | --- | --- | --- |
| 1920 | 1080 | 1080 | none |
| 1440 | 1080 | 1080 | none |
| 768 | 728 | 728 | none |
| 390 | 362 | 362 | none |
| 360 | 332 | 332 | none |
| 320 | 292 | 292 | none |

Desktop and 390px screenshots visually reviewed. A 600-character unbroken input
at 320px did not expand the page/composer. Viewport override reset after checks.
One synthetic audit message, no lead/contact submission. This verifies this layout
change, not physical phone dictation or every report/modal/device state.
