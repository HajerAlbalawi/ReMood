---
name: Expo web preview compatibility
description: Platform-specific Expo modules can break the shared web preview even when installed.
---

Keep optional native-only media features out of the shared Expo route unless their web bundle path has been verified, or isolate them behind a platform-safe boundary.

**Why:** The Expo web preview in this workspace produced an unknown Metro module error when the main route imported the installed image-picker module.

**How to apply:** Prefer the core route to use web-safe React Native and Expo primitives; add native media access only after testing iOS, Android, and web bundling separately.