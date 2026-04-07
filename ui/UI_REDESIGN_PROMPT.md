# Astro Tools UI Redesign Prompt

## Overview
Transform the Astro Tools UI from a minimal neutral aesthetic to a vibrant, casual, modern design inspired by GlossGenius and KULT brand colors. Maintain the current structure and functionality while elevating the visual design.

## Design Direction
- **Tone**: Casual, friendly, approachable (not corporate)
- **Inspiration**: GlossGenius design system + KULT brand color palette
- **Philosophy**: Bold, strategic use of color for highlights and emphasis; keep interactions clean and functional

---

## Color Palette (KULT Brand)
Use these colors strategically for highlights, tags, and decorative elements:
- **Orange/Coral**: `#FF6B35` or `#FF7A45` (primary accent)
- **Pink/Magenta**: `#FF1493` or `#E91E8C` (secondary accent)
- **Cyan/Turquoise**: `#00D9FF` or `#00CED1` (tertiary accent)
- **Beige/Cream**: `#F5DEB3` or `#F5E6D3` (warm neutral)
- **Blue**: `#1E40AF` or `#2563EB` (additional accent)

Background remains light beige (#f7f7f6); use colors as accents, not backgrounds.

---

## Key Changes

### 1. Sidebar
- **Change from**: Dark sidebar (neutral-950)
- **Change to**: Light sidebar design like GlossGenius
  - Light background (off-white/light gray)
  - Dark text for nav items
  - Colored highlights/badges for active states
  - More visual interest than current dark sidebar
  - Keep the same navigation structure and functionality

### 2. Gradient Accent Bars
- Add thin gradient bars on top of main cards/sections
  - Input Form card: colored gradient stripe on top
  - Preview Panel card: colored gradient stripe on top
  - Other cards/sections: gradient stripes (can vary colors)
  - Use KULT colors in the gradient (e.g., orange to pink, cyan to blue)
  - Keep thin and elegant (8-12px height suggested)

### 3. Main Action Buttons
- **Keep black** for primary CTAs (e.g., "Generate Facebook Post", "Start")
- Add subtle hover/active states with colored accents if appropriate
- Maintain the strong, clear call-to-action feel

### 4. Tags & Highlights
- Follow GlossGenius tag design:
  - Small colored badge pills (e.g., "AI", "Custom")
  - Use KULT colors for different tag types
  - Include icons or small visual indicators where relevant
  - Examples: AI-generated tags (orange), Custom tags (pink), etc.

### 5. Illustrations & Icons
- Add GlossGenius-style illustrations:
  - Playful, colorful illustrations for empty states
  - Icons for features/sections (e.g., article, image, caption)
  - Use in empty preview areas, feature highlights, or onboarding moments
  - Match the casual, friendly tone

### 6. Typography & Text
- Keep Inter font and existing hierarchy
- Maintain readability and contrast
- Casual language where appropriate to match new tone

---

## What Stays the Same
- Overall layout structure (sidebar + main content)
- Component hierarchy and functionality
- Form logic and submission flow
- Preview panel and result handling
- History panel structure

---

## Implementation Notes

### For Each Component:

**Sidebar.tsx**
- Redesign to match GlossGenius light sidebar
- Update colors from dark to light
- Add colored highlights for active navigation
- Keep the same tools and functionality

**InputForm.tsx**
- Add gradient bar on top of the card
- Style tags with KULT colors (e.g., AI badge in orange)
- Keep form structure and inputs the same
- Add subtle visual improvements

**PreviewPanel.tsx**
- Add gradient bar on top of the card
- Add placeholder illustrations for empty states (GG style)
- Keep the same functionality and layout

**ResultPreview.tsx**
- Use colored tags/badges for different content types
- Add playful illustrations or icons
- Maintain the same result display

**App.tsx & General**
- Update card backgrounds if needed (subtle tints of KULT colors OK, but keep readable)
- Add gradient bars to any other major sections
- Update success/error states with new color palette if needed

### CSS/Tailwind Updates
- Create new color utilities or use inline Tailwind colors for KULT palette
- Define the gradient bar as a reusable component/utility
- Consider new animations using the GlossGenius-inspired style (smooth, playful)

---

## Design Checklist
- [ ] Sidebar redesigned to light GlossGenius style
- [ ] Thin gradient accent bars added to main cards
- [ ] KULT colors used strategically (tags, accents, highlights)
- [ ] Black maintained for main action buttons
- [ ] GlossGenius-style illustrations/icons integrated
- [ ] Casual, friendly tone reflected in copy and interactions
- [ ] All functionality preserved
- [ ] Mobile responsiveness maintained
- [ ] Contrast and accessibility verified

---

## Inspiration References
- **GlossGenius**: Colorful cards, light sidebar, playful illustrations, friendly tone
- **KULT brand**: Vibrant color palette, modern aesthetic, bold accents
- **Overall goal**: Make Astro Tools feel modern, inviting, and fun while maintaining professional functionality

---

## Notes for Claude Code
- This is a UI/UX redesign focused on visual improvements
- No backend changes or logic modifications needed
- Prioritize visual impact with strategic use of color
- Keep the design clean and not overwrought (not every element needs color)
- Test on mobile to ensure responsive design holds up
- **Use the impeccable `/delight` skill for success states** — add joy moments to confirmations, approvals, and completion screens
- Consider using the impeccable `/colorize` and `/animate` skills for further refinement
