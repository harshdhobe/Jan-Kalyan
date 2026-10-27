# Jan Kalyan Design System & Tokens

Extracted directly from Google Stitch Design: **"Jan Kalyan | जन कल्याण (Editorial NGO Redesign)"**
Screen ID: `projects/15726241777793488708/screens/9c74728115f14a619a12333befe48f69`
Design Target Width: 1440px / 1200px max container.

---

## 1. Color Palette (Exact Hex)

| Token Name | Hex Code | Usage |
| :--- | :--- | :--- |
| `cream` | `#FAF4EA` | Primary background, hero, how-it-works, promises bg, cream text on dark |
| `sand` | `#F1E4CE` | "Made for every family" section background, photo frame subtle tint |
| `deep-brown` | `#2A1A10` | Primary text, primary button fill, column 1 top rule, footer background |
| `terracotta` | `#A8421E` | Language active line, secondary button border, column 2 top rule, step numbers (1,2,3), focus ring |
| `deep-green` | `#1F4D36` | "Mission Band" background |
| `trust-green` | `#1F5A3B` | Privacy note text color |
| `shield-border` | `#2E6B4A` | Privacy note left accent bar and shield icon |
| `hairline` | `#D6C4A6` | 1px dividers, card borders, horizontal rules |
| `button-primary-hover` | `#3D2719` | Hover state for primary button |
| `button-secondary-bg` | `#FFFFFF` | Background for secondary button |
| `footer-text` | `#F5E9D6` | Muted cream text for footer section |

---

## 2. Typography & Fonts

### Font Families
- **Serif (Headings & Display):** `Newsreader`, `Georgia`, `serif`
- **Sans-Serif (English Text & UI):** `Public Sans`, `sans-serif`
- **Devanagari (Hindi & Marathi):** `Noto Sans Devanagari`, `sans-serif`

### Hierarchy & Sizes
- **Header Logo:** "Jan Kalyan" serif 32px; 1px divider 28px tall; "जन कल्याण" bold 24px, baseline-aligned.
- **Language Switcher:** 18px text, 48px min-height, 16px horizontal padding. Selected: bold with 3px terracotta underline.
- **Eyebrow:** 16px uppercase, `letter-spacing: 0.12em`; Devanagari part 18px bold.
- **Hero H1:** serif, `clamp(72px, 10vw, 144px)` (= 144px at 1440px), line-height 0.95, letter-spacing -0.03em, single line (`white-space: nowrap`), margin-top 24px.
- **Hero Subheading:** 24px/1.4, max-width 600px, margin-top 32px.
- **Hero Supporting Line:** 20px/1.5, max-width 560px, margin-top 16px, text-deep-brown 80%.
- **Hero Button Title:** 22px semibold, line-height 1.2, `white-space: nowrap`.
- **Hero Button Subline:** 15px, line-height 1.35, text wraps to 2 lines without clipping.
- **Privacy Shield Note:** 18px, color `#1F5A3B`, margin-top 32px, left border 3px `#2E6B4A`.
- **Mission Band H2:** serif 64px, line-height 1.05, letter-spacing -0.02em, cream `#FAF4EA`.
- **Mission Band Subline:** 20px/1.5, max-width 640px, margin-top 32px, cream at 90% opacity.
- **How It Works Section Title:** serif 56px, line-height 1.0, margin-bottom 64px.
- **How It Works Column Titles:** serif 36px/1.15; subline 16px at 70% opacity, 8px below title.
- **Step Numbers (1, 2, 3):** serif 56px, terracotta `#A8421E`, line-height 1.
- **Step Description:** 24px semibold, line-height 1.3, text-deep-brown.
- **Made For Every Family Title:** serif 56px, line-height 1.0.
- **Made For Every Family Groups:**
  - English: serif 28px/1.2, font-medium.
  - Devanagari: Noto Sans Devanagari 18px, font-bold, margin-top 4px.
- **Promises:** 20px semibold, text-deep-brown.
- **Footer:**
  - Heading: 20px semibold, tracking-tight, color `#F5E9D6`.
  - Subline: 16px/1.6, color `#F5E9D6` at 80% opacity, margin-top 12px.

---

## 3. Spacing & Layout System

- **Global Rules:**
  - Full-width section wrappers for background colors.
  - Inner container: `w-full max-w-[1200px] mx-auto`, padding 24px below 1280px width, 0 at 1280px and above. Centered at any screen width (1280, 1440, 1920).
  - ALL text left-aligned on desktop (≥1024px).
  - Breakpoints: mobile < 768px, tablet 768 to 1023px, desktop ≥ 1024px.
  - Section vertical padding: 120px desktop, 64px mobile (Hero: 96px top/120px bottom, Mission Band: 160px, Promises: 48px, Footer: 80px).
  - Sticky header height: 80px, `scroll-margin-top: 80px` on section anchors.
- **Hero Section:**
  - 12-column grid: `col-span-7` text (≈687px), `col-span-5` photo (≈481px), 32px gap.
  - Photo: fills 100% of column width (≈481px), `aspect-ratio: 4/5` (≈601px tall), `object-fit: cover`, radius 4px, aligned to top of eyebrow.
  - Buttons: `grid grid-cols-2 gap-4`, min-height 88px, radius 6px.
- **How It Works Section:**
  - 2 equal columns: `grid grid-cols-2 gap-x-20` (80px gap), each ≈560px.
  - 3 rows per column: `grid grid-cols-[56px_1fr_56px] items-center gap-6`, min-height 120px, 1px bottom hairline.
- **Made For Every Family:**
  - 12-column grid: `col-span-4` title, `col-span-8` list in 2 columns of 3 rows (`grid grid-cols-2 gap-x-12`), 48px gap.
- **Promises Section:**
  - 4 equal cells in 1 row separated by 1px vertical hairlines.
- **Footer:**
  - Content width max 768px, left-aligned, vertical padding 80px.

---

## 4. Iconography Rules

- **Style:** Line icons only with consistent 2px stroke weight, stroke-linecap="round", stroke-linejoin="round".
- **Backgrounds:** Strictly NO colored circles, pill badges, or background containers.
- **Colors:** Deep brown (`#2A1A10`) on light backgrounds, cream (`#FAF4EA`) inside primary button, green (`#2E6B4A`) on shield.
- **Allowed Placements:**
  1. Helper CTA button: Two people pictogram (32x32px).
  2. Quick check CTA button: Checkmark pictogram (32x32px).
  3. Privacy note: Shield line pictogram (20x20px).
  4. How It Works Step 1.1: Clipboard with pencil (48px in 56x56 box).
  5. How It Works Step 1.2: Checklist with checkmarks (48px in 56x56 box).
  6. How It Works Step 1.3: Document outline (48px in 56x56 box).
  7. How It Works Step 2.1: Person ID card (48px in 56x56 box).
  8. How It Works Step 2.2: Magnifier over document (48px in 56x56 box).
  9. How It Works Step 2.3: 3-step progress bar with checkmark (48px in 56x56 box).
- **No icons:** Header, Made For Every Family, Promises, Footer.
