# Custom SVG Illustration Creation

> Create bespoke SVG illustrations for game development UI — spellbook icons, character type portraits, achievement badges, module headers, and decorative elements.
> Trigger: `/illustration` or user request to create/generate illustration, icon, badge, or decorative SVG

---

## Overview

Creates **inline SVG illustrations** embedded directly in React components, using the project's color system and design tokens. Illustrations are purely decorative visual elements that enhance the UI's identity — NOT functional charts or data visualizations.

**Design philosophy:**
- Game-dev aesthetic — dark backgrounds with glowing accents, sci-fi/fantasy fusion
- Minimal but impactful — clean linework with strategic color pops
- Scalable — all illustrations use viewBox and work at any size
- Theme-aware — colors reference the project's chart-colors system
- Performance — no external assets, no canvas, pure SVG with optional CSS animations

---

## Procedure

### Step 1: Understand the Request

1. **Identify the illustration type** from these archetypes:
   - **Icon/Badge** — Small (24-64px), single concept, used in lists/headers (e.g., spell school icon, weapon type badge)
   - **Panel Header** — Wide banner illustration (300x80-ish), decorative accent for section headers
   - **Character Portrait** — Medium (120-200px), stylized silhouette or emblem for character types
   - **Achievement Ring** — Circular with progress/status indication, celebratory
   - **Module Emblem** — Represents a game system (combat, loot, AI, etc.), used as module identity
   - **Decorative Divider** — Horizontal ornamental separator between sections

2. **Determine the color palette** from the project's chart-colors:
   ```tsx
   import { MODULE_COLORS, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_PINK, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
   ```

Ask the user:
> "I'll create a **[type]** illustration for **[context]**. Should I use **[suggested accent color]** or do you have a preference?"

### Step 2: Design the SVG

**Mandatory design rules:**
- Use `viewBox` with integer coordinates (e.g., `viewBox="0 0 100 100"`)
- Background: transparent (inherits from container)
- Primary linework: `stroke="currentColor"` for theme adaptation, or accent color
- Glow effects: `filter: drop-shadow(0 0 Npx color)` — NOT SVG filters (for performance)
- Gradients: Use `<linearGradient>` or `<radialGradient>` with `id` prefixed by illustration name to avoid conflicts
- Animations: CSS keyframes or framer-motion, NOT SMIL `<animate>` tags
- All colors must come from `@/lib/chart-colors` imports, never hardcoded hex
- Use `opacity` and color mixing (`${color}20`, `${color}80`) for depth layers
- Include `aria-hidden="true"` since illustrations are decorative

**Layering technique for depth:**
1. Background glow layer (radial gradient, very low opacity ~5-10%)
2. Structural shapes (geometric forms, paths)
3. Detail accents (small highlights, dots, line segments)
4. Foreground glow (drop-shadow on key elements)

**Style guide:**
- Prefer geometric shapes over organic curves
- Use dashed/dotted strokes for secondary elements (`strokeDasharray`)
- Corner radius on rects: 2-4px for small, 6-8px for large
- Line weight: 1-1.5px for detail, 2-3px for primary structure
- Small decorative circles (r=1-2) at intersections for "node" aesthetic

### Step 3: Create the Component

Create the illustration as an exported React component in the appropriate location:

**File location rules:**
- If for a specific unique-tab: same directory as the tab component
- If shared across modules: `src/components/ui/illustrations/`
- If for a specific module: `src/components/modules/[category]/illustrations/`

**Component template:**
```tsx
'use client';

import { ACCENT_CYAN, ACCENT_VIOLET } from '@/lib/chart-colors';

interface IllustrationNameProps {
  size?: number;
  accent?: string;
  className?: string;
}

export function IllustrationName({ size = 64, accent = ACCENT_CYAN, className }: IllustrationNameProps) {
  const id = `ill-name-${size}`; // unique gradient ID
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.15} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Background glow */}
      <circle cx={50} cy={50} r={45} fill={`url(#${id}-glow)`} />
      {/* Structure */}
      {/* ... illustration paths ... */}
    </svg>
  );
}
```

### Step 4: Wire into the UI

1. Import the illustration in the target component
2. Place it with appropriate sizing and positioning
3. Add hover/interaction effects if contextually appropriate:
   - Scale on hover: `className="transition-transform hover:scale-105"`
   - Glow pulse: CSS animation on the outer glow layer
   - Color shift: change accent prop on state change

### Step 5: Verify

1. Run `npx tsc --noEmit` — zero errors
2. Confirm the illustration renders at multiple sizes (32, 64, 128px)
3. Confirm colors adapt when accent prop changes
4. Confirm `aria-hidden="true"` is present

### Step 6: Present

Show the user:
- **What was created:** Component name, file location
- **Color palette used:** Which accent colors
- **Sizes tested:** Confirm scalability
- **Usage example:** One-liner import + JSX

---

## Illustration Recipes

### Spellbook / Ability Icon
- Open book shape with radiating energy lines
- Central rune/glyph (geometric, not text)
- Accent glow emanating from the book

### Character Type Emblem
- Stylized shield/crest shape
- Inner icon representing archetype (sword, staff, shield, bow)
- Accent border with corner flourishes

### Weapon Type Badge
- Circular frame with dashed outer ring
- Central weapon silhouette
- Small stat indicators around the perimeter

### Achievement Ring
- Concentric circles with progress arc
- Central icon/number
- Particle dots orbiting at the edge
- Optional: animated rotation on the outer ring

### Module Header Banner
- Wide aspect ratio (4:1 or 5:1)
- Horizontal line art with accent nodes
- Central module icon, flanking decorative geometry
- Subtle grid pattern background

### Loot Rarity Frame
- Tiered border glow intensity (common→legendary)
- Corner ornaments that scale with rarity
- Inner highlight gradient

---

## Notes

- Never use external image assets or `<image>` tags — pure SVG paths/shapes only
- Keep path data readable — break complex paths into named sub-elements
- For complex illustrations, extract path data to a const outside the component
- Illustrations should look good on both the dark PoF theme AND potential light themes (use opacity-based coloring)
- Test at 32px minimum — if detail is lost, simplify the design
- Maximum 50 SVG elements per illustration to keep render performance tight
