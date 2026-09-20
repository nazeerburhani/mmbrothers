# Design System Specification: The Sensory Curator

## 1. Overview & Creative North Star
This design system is built upon the "Sensory Curator" North Star. For a retail management app dealing in niche perfumes and Islamic heritage products, the interface must do more than function—it must evoke the same precision, luxury, and serenity as the products it tracks.

We are moving away from the "industrial" look of traditional SaaS. Instead, we embrace **High-End Editorial** design. This system breaks the "template" look by utilizing intentional asymmetry, high-contrast typography scales, and a philosophy of "Light as Structure." We do not use lines to define space; we use light, tone, and depth to guide the user's eye. The goal is a professional tool that feels like a premium digital atelier.

## 2. Colors & Tonal Depth
The palette is a sophisticated interplay of deep Mediterranean teals (`primary`), sun-drenched gold accents (`secondary`), and a foundation of warm, paper-like grays.

### The Palette
*   **Primary (`#02494c`):** Our "Ink." Used for primary actions and authoritative brand moments.
*   **Secondary (`#775a19`):** Our "Gold." Reserved for premium status indicators, "Featured" products, or subtle highlights.
*   **Surface Foundation (`#fdf9f3`):** A warm, cream-based white that prevents eye strain and feels more artisanal than "hospital white."

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders for sectioning are strictly prohibited. 
Structure must be achieved through background shifts. For example, a dashboard sidebar should use `surface-container-low`, while the main workspace stays on `surface`. This creates a natural, soft transition that feels expensive and intentional rather than "boxed in."

### The Glass & Gradient Rule
To move beyond "flat" design:
*   **Glassmorphism:** Use `surface` colors at 80% opacity with a `backdrop-filter: blur(20px)` for floating navigation elements or modal overlays.
*   **Signature Textures:** Apply subtle linear gradients (e.g., `primary` to `primary_container`) on main CTAs. This adds "soul" and a three-dimensional quality that suggests the luster of a perfume bottle.

## 3. Typography: The Editorial Voice
We use typography to establish a clear hierarchy that feels like a high-end catalog.

*   **Display & Headlines (Manrope):** This is our "Editorial" voice. Manrope’s geometric yet warm proportions should be used for large headings and display numbers (like total sales). Use `display-lg` with tight tracking (-2%) for a bold, confident statement.
*   **Body & Labels (Inter):** This is our "Functional" voice. Inter is chosen for its extreme legibility in data-heavy retail environments. 
    *   Use `body-md` for standard inventory lists.
    *   Use `label-sm` with all-caps and increased letter spacing (0.05rem) for metadata, like "SKU" or "BATCH NO."

## 4. Elevation & Tonal Layering
In this design system, depth is a physical property, not a stylistic choice. We use **Tonal Layering** rather than traditional structural lines.

### The Layering Principle
Think of the UI as stacked sheets of fine paper. 
1.  **Base Layer:** `surface` (The desk).
2.  **Section Layer:** `surface-container-low` (The tray).
3.  **Element Layer:** `surface-container-lowest` or `surface-bright` (The card).
By nesting these tones, you create "lift" without ever needing a shadow.

### Ambient Shadows & Ghost Borders
*   **Ambient Shadows:** If an element must float (like a "New Sale" FAB), use a shadow tinted with `on-surface` at 6% opacity with a 32px blur. Never use pure black shadows.
*   **The Ghost Border:** If a boundary is legally or functionally required for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
*   **Primary:** Background: `primary`; Text: `on-primary`. Use `lg` (0.5rem) roundedness for a modern, approachable feel.
*   **Secondary (Luxury):** Background: `secondary_fixed`; Text: `on-secondary_fixed`. Used for "Add to Collection" or "Premium" features.
*   **Tertiary:** No background. Text: `primary`. High-contrast for "Cancel" or "Back" actions.

### Cards & Lists
*   **Card Styling:** Forbid the use of divider lines. 
*   **Separation:** Use vertical white space (32px or 48px) to separate groups. Within a list, use a subtle hover state shift to `surface-container-high` to indicate interactivity.
*   **Retail Context:** In the product list (Perfumes/Attars), use `surface-container-lowest` for the card background to make the product imagery "pop" against the `surface` background.

### Input Fields
*   **Styling:** Avoid the "four-sided box." Use a `surface-container-highest` background with a `md` (0.375rem) corner radius. 
*   **Focus State:** Transition the background to `surface-bright` and add a 2px "Ghost Border" using the `primary` color at 40% opacity.

### Chips (Product Categorization)
*   **Action Chips:** Use `tertiary_fixed` for categories like "Oud," "Musk," or "Floral." They should feel like soft labels on a garment.

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Place product descriptions slightly offset from their images to create an editorial, "un-templated" feel.
*   **Embrace Whitespace:** If you think there is enough space, add 16px more. Whitespace is a luxury in retail management.
*   **Prioritize Hierarchy:** Use `display-md` for the most important number on any screen (e.g., Today's Revenue).

### Don't:
*   **Don't use 100% Opaque Borders:** This kills the "Sensory" softness of the system. 
*   **Don't use standard Drop Shadows:** Avoid the "floating on a cloud" look; stick to tonal shifts.
*   **Don't clutter the Navigation:** Use the "curator" mindset—only show what the user needs at this specific step of the inventory process.
*   **Don't use pure black:** Use `on-surface` (`#1c1c18`) for all text to maintain the sophisticated, warm-gray aesthetic.