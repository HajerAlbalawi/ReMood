---
name: Reader age groups
description: The product decision and boundaries for ReMood age filtering.
---

ReMood uses three reader age groups: children, teens, and adults. The adults group starts at 18; there is no separate young-adult or senior group in the user-facing selector.

**Why:** The product owner asked to restore the three simple sections while correcting the adult label to 18+, so extra age bands create unnecessary confusion.

**How to apply:** Keep web, mobile, server validation, recommendation filtering, and generated API types aligned to `children`, `teen`, and `adult`. Legacy catalogue metadata may be normalized to the nearest current group.