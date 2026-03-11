---
name: interface-feel-better
description: Apply high-impact interface polish details for web UI quality. Use when building or reviewing user-facing UI, refining micro-interactions, improving visual rhythm, or when the user asks for smoother animations, better typography, cleaner alignment, and more polished component feel.
---

# Interface Feel Better

Use this skill to turn "good enough" UI into polished UI through small, compounding details.

## When To Apply

Apply this skill when the user asks to:

- polish UI
- improve UX quality
- refine motion or micro-interactions
- make components feel more premium
- review visual details and interface feel

## Default Workflow

1. Identify the highest-impact screen/component first (avoid broad shotgun edits).
2. Run a micro-polish pass using the checklist below.
3. Keep changes subtle and cumulative; avoid dramatic redesign unless requested.
4. Prefer interruptible interactions and accessible defaults.
5. Document exactly what changed and why it improves feel.

## Micro-Polish Checklist

### Typography and Numbers

- Use `text-wrap: balance` for headings and short UI copy where line breaks look awkward.
- Consider global `-webkit-font-smoothing: antialiased` for crisper macOS rendering.
- Apply `font-variant-numeric: tabular-nums` for dynamic counters, timers, and metrics to reduce layout jitter.

### Shape and Visual Rhythm

- Use concentric radius for nested surfaces:
  - `outerRadius = innerRadius + padding`
- Keep nested card/input/chip radii visually consistent instead of arbitrary values.

### Motion and Interaction

- Prefer CSS transitions for user-driven interactions that should remain interruptible.
- Use keyframes for staged, one-shot sequences (not toggle interactions).
- For contextual icon swaps, animate opacity + slight scale + subtle blur.
- Use staggered enter for grouped content (title, description, actions), not one large block animation.
- Keep exit animations more subtle than enter animations.

### Alignment and Spacing

- Align optically, not only geometrically, especially icon + text pairs.
- Adjust icon-side padding/margins slightly when exact geometric centering looks off.

### Surfaces and Depth

- Prefer subtle layered shadows over hard borders for light surfaces.
- Add low-opacity image outlines (`1px`, ~10% alpha) for separation on mixed backgrounds.

## Implementation Defaults

Use these defaults unless the product language requires otherwise:

- Enter duration: `200-450ms` depending on element size and distance
- Stagger delay: `60-120ms`
- Exit motion distance: smaller than enter (often half or less)
- Blur on motion: subtle (`2-6px`) and brief

## Guardrails

- Do not apply all effects everywhere; select details that solve a visible issue.
- Avoid heavy blur, long durations, and bouncy motion on productivity UIs unless requested.
- Preserve accessibility (contrast, focus states, reduced motion support).
- Keep behavior stable under rapid interaction (hover/toggle/click spam).

## Output Format For UI Review Requests

When asked to review UI polish, respond with:

1. High-impact issues first (what feels off and why).
2. Concrete fixes mapped to this skill's checklist.
3. Minimal patch plan (which files/components to touch).
4. Risks and verification steps (reduced motion, responsive checks, rapid-toggle checks).
