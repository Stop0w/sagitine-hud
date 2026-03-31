# Design System Strategy: The Clinical Archivist

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Clinical Archivist."** 

This is not a standard dashboard; it is a high-pressure command environment rendered through the lens of a luxury editorial spread. We are moving away from the "software template" look and toward a surgical, high-fidelity HUD (Heads-Up Display). The aesthetic is defined by **absolute precision, cold authority, and intentional asymmetry.** 

To achieve this, we leverage extreme typographic contrast—pairing oversized, elegant serifs with microscopic, high-density sans-serif data—and a strictly monochrome palette. By eliminating all rounded corners (0px radius), we evoke a sense of structural permanence and clinical discipline. The layout should feel "expensive" through the generous use of whitespace (the "void") punctuated by sharp, high-contrast data points.

## 2. Colors
The palette is rooted in the "Zinc" spectrum, providing a sophisticated, neutral foundation that allows the Terracotta/Red accents to command immediate, visceral attention.

*   **Primary Foundation:** Use `surface` (`#f9f9f9`) for the vast majority of the canvas. Text defaults to `on-surface` (`#1a1c1c`) to maintain a stark, printed-ink-on-paper feel.
*   **The "No-Line" Rule:** We prohibit the use of standard 1px solid borders for sectioning large layout blocks. Instead, define boundaries through background color shifts. A sidebar should be `surface-container-low` (`#f3f3f3`) resting against a `surface` (`#f9f9f9`) body.
*   **Surface Hierarchy & Nesting:** Treat the UI as layers of fine paper. 
    *   **Base:** `surface`
    *   **Secondary Content:** `surface-container-low`
    *   **Interactive/Elevated Elements:** `surface-container-lowest` (`#ffffff`) to create a "pop" of pure white.
*   **The "Glass & Gradient" Rule:** For floating HUD overlays, use semi-transparent `surface` colors with a heavy `backdrop-blur`. Main CTAs or high-level status headers should utilize a subtle linear gradient from `primary` (`#000000`) to `primary-container` (`#3b3b3e`) to add a "machined" metallic depth.
*   **Urgency & Accents:** Use `tertiary` (`#701f00`) for premium status and `error` (`#ba1a1a`) for critical system alerts. These must be used sparingly to maintain their psychological impact.

## 3. Typography
Our typography is a dialogue between the artisanal and the industrial.

*   **Display & Headlines (Noto Serif):** Use these for branding ("Sagitine HUD") and top-level page titles. This introduces a "human" editorial element into the clinical environment.
*   **UI & Data (Inter/Geist):** All functional data, labels, and system readouts use the Sans-Serif scale. 
*   **Hierarchy Strategy:** Create "tension" by placing `display-lg` (3.5rem) headlines near `label-sm` (0.6875rem) data points. This scale disparity is what creates the "High-End" feel. Ensure all labels use `letter-spacing: 0.05em` to enhance readability at small sizes.

## 4. Elevation & Depth
In this system, depth is a product of light and layering, not drop shadows.

*   **The Layering Principle:** Avoid the "floating card" look. Achieve hierarchy by stacking `surface-container` tiers. A `surface-container-highest` (`#e2e2e2`) header sitting on a `surface-container` (`#eeeeee`) body provides all the separation required.
*   **Ambient Shadows:** If a floating element (like a context menu) is required, use a shadow with a 32px-64px blur at 4% opacity. The shadow color must be tinted with the `surface-tint` (`#5f5e61`) to ensure it looks like a natural occlusion of light rather than a digital effect.
*   **The "Structural Hairline":** When a border is mission-critical for a HUD readout, use the `outline-variant` (`#c6c6c6`) at 1px. It must be sharp and 100% opaque, but used only for microscopic containment of data.
*   **0px Mandate:** Every corner in the system is `0px`. No exceptions. This creates a "brutalist" edge that feels custom-engineered.

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (`#000000`) with `on-primary` (`#e4e1e6`) text. 0px corners.
*   **Secondary:** Ghost style. `outline` (`#777777`) 1px border with `on-surface` text.
*   **Tertiary/Urgency:** Solid `tertiary` (`#701f00`). This is reserved for high-value actions (e.g., "Authorize Command").

### Input Fields
*   **Style:** No background fill. Use a 1px bottom-border only (using `outline`). Labels should be `label-sm` and positioned 0.5rem (Spacing Scale 1.5) above the input. 
*   **States:** On focus, the bottom border transitions to `primary` (`#000000`) 2px.

### Cards & Data Modules
*   **Forbid Dividers:** Do not use horizontal lines to separate list items. Use Spacing Scale 4 (1.4rem) to create clear vertical air, or alternate background tints (`surface` vs `surface-container-low`).

### HUD Data Chips
*   **Action Chips:** Small, rectangular blocks with `surface-container-highest` backgrounds and `label-sm` text. These should look like labels on a physical control panel.

### New Component: The "Status Ribbon"
*   A vertical 4px bar using `tertiary` or `error` colors placed on the far left of a container to indicate status without cluttering the UI with icons.

## 6. Do's and Don'ts

### Do
*   **Do** use extreme whitespace. If a section feels crowded, double the spacing using the Spacing Scale (e.g., move from 8 to 16).
*   **Do** align all text to a strict vertical grid. Asymmetry in layout is encouraged, but internal alignment must be mathematically perfect.
*   **Do** use `label-sm` for technical metadata to emphasize the "Clinical" nature of the HUD.

### Don't
*   **Don't** use border-radius. Even a 2px radius will break the "Clinical Archivist" aesthetic.
*   **Don't** use blue for links. Use `on-surface` with an underline or the `tertiary` color if the link is a critical action.
*   **Don't** use "Standard" icons. If an icon is needed, it must be ultra-thin (0.5px to 1px stroke) and strictly monochrome.
*   **Don't** use centered text for data. Information should be left-aligned for speed of scanning, or right-aligned for numerical tabular data.