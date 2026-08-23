# Design System — Fusion92 Brand

**Relocated whole from `CLAUDE.md` on 2026-08-23** by the second extraction
pass, under §13 r41 remedy 3. **This file is live reference — it is NOT the
archive, and r40 does not apply to it.** CLAUDE.md keeps the section heading and
a pointer so existing `§12` citations still resolve.

---


### Colors
```typescript
export const F92 = {
  orange:  '#F47920',   // Primary accent, H1 headings
  navy:    '#1E2D6B',   // Secondary, H2 headings, table headers
  dark:    '#1A1A2E',   // Body text
  gray:    '#6B7280',   // Muted text
  lgray:   '#9CA3AF',   // Placeholder text
  warm:    '#FEF6EE',   // Alt table rows, light backgrounds
  border:  '#E8D5C4',   // Warm borders
  white:   '#FFFFFF',
} as const;
```

F92 atom logo is reproduced as inline SVG in `components/layout/f92-logo.tsx`
using orange/navy/tan rings plus a blue nucleus ring and white core. Scales
freely, transparent background.

### Severity Color Coding
```
Critical → red-600    (#DC2626)
High     → orange-500 (#F97316)
Medium   → yellow-500 (#EAB308)
Low      → gray-400   (#9CA3AF)
```

### Log Status Color Coding
```
Open                 → blue-500
In Progress          → indigo-500
Blocked              → red-500
Pending Verification → yellow-500
Resolved             → green-500
```

---

