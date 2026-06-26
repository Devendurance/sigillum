# DESIGN.md — Sigillum Visual System v0

> A product-proof design system for a technical trust product.  
> Visual base: soft proof cards from Image A + sparse monochrome precision from Image B.  
> Fonts: Georama + Satoshi.  
> This file is designed to keep every page consistent before deeper product-specific content is injected.

---

## 1. Visual Direction

### Product Category
Developer trust infrastructure, verification, risk receipts, autonomous-agent safety, and proof-oriented software workflows.

### Design Intent
The interface should feel like a serious verification system wrapped in a soft evidence-board language. It should not feel like a generic cybersecurity dashboard. The strongest visual idea is: **every section is a proof container, and every component inside it feels like a pinned artifact.**

### Interface Inspiration
- Image A: soft section container, rounded card stage, floating pinned pastel cards, tape/clip details, slightly imperfect rotation, soft shadows, calm background.
- Image B: spacious monochrome hero, large confident typography, small uppercase technical labels, sharp black CTA, minimal navigation, abstract node/mesh proof visual.

### Visual Story
The page should feel like a neutral verifier laying evidence on a table. A user sees the risk, the receipt, the proof, and the recommendation without being buried in enterprise noise.

### Visual Characteristics
- Off-white page background.
- Large soft-blue/lavender section cards.
- Rounded "folder-tab" top-left section containers.
- Pastel artifact cards pinned with translucent tape or clip elements.
- Black primary actions with near-square corners.
- Dotted dividers and small uppercase metadata.
- Sparse node/mesh visuals used as proof networks, not sci-fi decoration.
- Gentle rotations on proof cards, but never chaotic.

### Design Feeling
Calm, precise, trustable, soft-technical, evidence-led, neutral, premium but not luxury, developer-friendly without looking like a code editor.

### What This Should Not Feel Like
- Not cyberpunk.
- Not neon security dashboard.
- Not SaaS-template blue.
- Not playful sticky notes for a classroom.
- Not corporate fintech.
- Not generic AI landing page.
- Not "gradient blob + three cards + Get Started."

---

## 2. Brand Positioning Through UI

### Product Role
A neutral verification layer that sits between an automated action and a risky decision.

### Category Definition
A proof interface, not a marketing site. The UI should constantly show evidence: quote, payment, inspection, receipt, score, recommendation, decision.

### Core Metaphor
**Pinned proof board.**  
Each piece of evidence is a physical-looking card: inspected units, risk score, payment amount, receipt ID, finding, patch suggestion, decision.

### Primary User Belief
"Trust should be bought, checked, and shown before risky software actions happen."

### Trust Signals
- Signed receipt card.
- Visible inspected units.
- Clear score state.
- Recommendation state.
- Payment amount.
- Deterministic check categories.
- Timestamp and receipt ID.
- External verifier language.

### Proof Signals
Use proof signals as UI objects:
- Receipt card.
- Seal badge.
- Score tile.
- Payment chip.
- Inspection log.
- Dotted flow line.
- Node mesh.
- Block/warn/pass decision pill.

### Enemy / Anti-Pattern
- The agent that wrote the change approving its own work.
- Full-dashboard theater with no proof.
- Decorative payment badges where x402 has no real UI role.
- Security claims that feel absolute or overpromised.

### Positioning Rules
- Use proof language before feature language.
- Use concrete evidence objects before abstract benefits.
- Every major section should answer: "What was checked? What did it cost? What was decided?"
- Avoid claiming perfect safety. Use risk, signal, verification, recommendation, receipt.
- Let the UI show the workflow, not just talk about it.

---

## 3. Typography System

### Font Families

#### Editorial / Display Font
Georama Variable  
Use for hero display, large section headings, dominant numbers, and big proof statements.

#### Product / Interface Sans
Satoshi Variable  
Use for body text, labels, buttons, navigation, cards, forms, tables, and microcopy.

#### Developer / Data Mono
Use Satoshi with tabular numbers for data-first UI.  
For code blocks only, fallback to `ui-monospace`, `SFMono-Regular`, `Menlo`, `Consolas`, monospace. Do not introduce a third branded font unless implementation absolutely requires code readability.

### Typography Usage Rules
- Georama owns the loud moments.
- Satoshi owns clarity.
- Large type should be clean and confident, like Image B.
- Small labels should feel technical and restrained.
- Avoid decorative type effects.
- Never use more than two visible font families in marketing surfaces.

### Suggested Type Scale

#### Hero Display
- Desktop: 76-96px
- Tablet: 56-72px
- Mobile: 42-52px
- Font: Georama 500-600
- Tracking: -0.055em to -0.04em
- Line height: 0.92-1.0

#### Section Heading
- Desktop: 44-64px
- Tablet: 38-48px
- Mobile: 30-36px
- Font: Georama 500-600
- Tracking: -0.04em
- Line height: 1.0-1.08

#### Subheading
- Desktop: 20-24px
- Mobile: 18-20px
- Font: Satoshi 450-500
- Line height: 1.35-1.5

#### Body Text
- Desktop: 16-18px
- Mobile: 15.5-17px
- Font: Satoshi 400
- Line height: 1.55-1.7
- Max width: 680px

#### UI Label
- 11-12px
- Font: Satoshi 600
- Uppercase
- Tracking: 0.08em-0.12em

#### Code / Logs
- 13-14px
- Font: ui-monospace fallback
- Line height: 1.55
- Keep code calm, not terminal-heavy.

#### Metrics / Numbers
- 28-64px depending on emphasis
- Font: Georama for large metrics, Satoshi tabular for smaller metrics
- Use tabular numbers everywhere values align.

#### Captions / Metadata
- 11-13px
- Satoshi 500
- Muted gray or ink-gray
- Uppercase for technical metadata only.

### Font Weight Rules
- Hero: 500-600.
- Headings: 500-600.
- Body: 400.
- Labels: 600.
- Buttons: 600.
- Metrics: 600-700.
- Avoid 800 except for one major number or word.

### Line Height Rules
- Hero: tight, 0.92-1.0.
- Headings: 1.0-1.12.
- Body: 1.55-1.7.
- Captions: 1.3-1.45.
- Code/logs: 1.5-1.6.

### Letter Spacing Rules
- Hero: negative tracking.
- Labels: positive tracking.
- Buttons: neutral or +0.01em.
- Never track body copy widely.
- Technical metadata can use wide tracking for Image B rhythm.

### Number / Data Typography Rules
- Use tabular numbers.
- Risk scores should be oversized.
- Payment values should be compact but highly legible.
- Receipt IDs should be truncated visually but expandable.
- Do not decorate numbers with gradients.

### Mobile Typography Rules
- Keep hero no smaller than 42px.
- Reduce line length, not just font size.
- Avoid long uppercase labels wrapping across multiple lines.
- Section labels can remain 11px but need enough spacing.

---

## 4. Color System

### Core Palette

#### Background Colors
- Page Background: `#F8F8F6` — off-white from Image B, cleaner than pure white.
- Soft Section Background: `#E9ECF5` — Image A lavender-blue stage.
- Section Alternate: `#F1F3F8` — lighter card-stage variation.
- Deep Ink Section: `#111215` — rare inverted sections.
- Paper Surface: `#FFFFFF`.

#### Text Colors
- Primary Ink: `#111318`
- Secondary Ink: `#4D525C`
- Muted Ink: `#8A909C`
- Disabled Text: `#B7BCC6`
- Text on Dark: `#F8F8F6`

#### Surface Colors
- Main Card: `#FFFFFF`
- Raised Card: `#FBFBFA`
- Soft Artifact Pink: `#F7DEDC`
- Soft Artifact Mint: `#DDF2E6`
- Soft Artifact Butter: `#F7E8A6`
- Soft Artifact Cyan: `#CDEFF1`
- Soft Artifact Lavender: `#E3E0FA`

#### Border Colors
- Default Border: `#DDE1EA`
- Strong Border: `#C9CEDA`
- Dark Border: `#25272D`
- Dotted Divider: `#C7CCD8`
- Tape Edge: `rgba(17,19,24,0.08)`

#### Grid / Texture Colors
- Dot Grid: `rgba(17,19,24,0.045)`
- Node Mesh Line: `rgba(17,19,24,0.12)`
- Noise: `rgba(17,19,24,0.025)`

### Accent Palette

#### Primary Accent
- Ink Black: `#111318`
- Used for primary CTAs, active decision states, and high-emphasis text.

#### Secondary Accent
- Proof Blue: `#5C6CFF`
- Use sparingly for proof links, active mesh nodes, and info states.

#### Warning Accent
- Receipt Amber: `#B58B00`
- Paired with Butter surfaces.

#### Error / Critical Accent
- Seal Red: `#C84D42`
- Paired with Pink surfaces.

#### Info / Developer Accent
- Node Cyan: `#128A91`
- Paired with Cyan surfaces.

#### Success Accent
- Verified Green: `#128A4A`
- Paired with Mint surfaces.

### Semantic Color Roles

#### Success State
- Text: `#128A4A`
- Surface: `#DDF2E6`
- Border: `#B8E4CC`
- Use for pass, verified, safe, completed.

#### Warning State
- Text: `#8A6B00`
- Surface: `#F7E8A6`
- Border: `#E7D16D`
- Use for warn, needs review, non-critical risk.

#### Critical State
- Text: `#A23830`
- Surface: `#F7DEDC`
- Border: `#E8BAB6`
- Use for block, secret exposure, dangerous action.

#### Info State
- Text: `#0F7D83`
- Surface: `#CDEFF1`
- Border: `#A8DFE4`
- Use for quote, payment, inspected units, neutral details.

#### Neutral State
- Text: `#4D525C`
- Surface: `#FFFFFF`
- Border: `#DDE1EA`

#### Disabled State
- Text: `#B7BCC6`
- Surface: `#EEF0F4`
- Border: `#E2E5EC`

### Color Usage Rules
- Page background stays mostly off-white.
- Large sections use soft lavender-blue containers.
- Pastels belong to artifact cards, not whole pages.
- Black is the main action color.
- Use one semantic color per proof card.
- Avoid rainbow dashboards; the pastel set is controlled and purposeful.

### Glow / Light Rules
- No neon glow.
- Use soft ambient shadows instead.
- Active nodes can have a tiny blurred halo: `0 0 18px rgba(17,19,24,0.08)`.
- Critical states should use border and surface, not aggressive red glow.

### Contrast Rules
- Primary text on off-white must be near-black.
- Pastel cards require dark text, never white text.
- Buttons must be black with white text or white with black border.
- Never put low-contrast gray body copy over pastel backgrounds.

### Color Anti-Patterns
- No default SaaS blue as the core brand.
- No purple-blue gradient blob hero.
- No bright neon security palette.
- No pastel overload across all surfaces.
- No red-only fear-based security styling.

---

## 5. Layout System

### Page Width

#### Max Content Width
- Default max width: 1180px.
- Large visual sections: 1280px.
- Full-bleed section card can reach 94vw max.

#### Text Content Width
- Body text max: 640-700px.
- Hero subtitle max: 560-640px.
- Technical explanations max: 760px.

#### Product Preview Width
- Desktop preview: 520-640px.
- Wide flow visual: 900-1100px.
- Receipt card cluster: 760-1080px.

#### Full-Bleed Sections
- Full-bleed sections are still wrapped in a soft card container with rounded corners.
- Use 24-36px outer page margin on desktop.
- Mobile: 12-16px outer margin.

### Grid System

#### Desktop Grid
- 12 columns.
- 24px gutters.
- Hero: 5 columns text / 7 columns visual or centered text with right visual.
- Section cards can break grid with pinned artifact rotation.

#### Tablet Grid
- 8 columns.
- 20px gutters.
- Product visuals stack below copy.

#### Mobile Grid
- 4 columns.
- 16px gutters.
- All pinned cards become stacked artifacts with reduced rotation.

### Common Layout Patterns

#### Hero Layout
Sparse Image B-style hero:
- Top minimal nav.
- Huge left-aligned or center-left headline.
- Small uppercase technical subtitle.
- Black primary CTA.
- Under-hero proof row.
- Right-side node mesh or receipt preview.

#### Product Explanation Layout
One large explanation card inside a soft section stage. Use top-left tab label and one pinned proof artifact as supporting evidence.

#### Feature Layout
Avoid three identical cards. Use asymmetric pinned cards:
- One large proof card.
- Two smaller state cards.
- One wide code/result panel.
- Cards can rotate -4deg to +4deg.

#### Dashboard / Console Layout
Use a soft section container holding white panels. Do not make the whole product look like a dark IDE.

#### Code + Explanation Layout
Code sits inside a white or deep-ink panel; explanation appears as pinned pastel note beside it.

#### CTA Layout
CTA should be sparse and confident. One main action, one secondary text link. Avoid three buttons.

### Section Rhythm

#### Hero Spacing
- Desktop: 96-128px top, 80-120px bottom.
- Keep lots of empty space like Image B.

#### Major Section Spacing
- 96-140px between large sections.
- Section cards have 64-96px internal vertical padding.

#### Dense Product Section Spacing
- 48-72px internal padding.
- Good for receipt tables/logs.

#### Educational Section Spacing
- 80-112px internal padding.
- More breathing room around explanation.

#### CTA Section Spacing
- 96-128px internal padding.
- Minimal objects; let it breathe.

### Composition Rules
- Every section should feel placed on a large rounded board/card.
- Top-left section tabs identify the section purpose.
- Cards can lean, but containers stay aligned.
- Pinned cards should overlap slightly only when readable.
- The eye should move from headline -> proof visual -> CTA or next proof.

### Visual Hierarchy Rules
- One dominant element per section.
- The biggest item should be at least 2x stronger than supporting details.
- Use one primary CTA per hero.
- Use metrics and receipts as hierarchy anchors.

### Whitespace Rules
- Keep Image B-level openness in hero and explanation sections.
- Let soft cards float with shadow; do not cram them.
- Dense sections are allowed only when showing proof artifacts/logs.

---

## 6. Primitive Tokens

### Spacing Scale

#### Micro Spacing
- 2px, 4px, 6px.
- For icon gaps, label offsets, dividers.

#### Compact Spacing
- 8px, 12px, 16px.
- For button internals, chip gaps, row spacing.

#### Standard Spacing
- 20px, 24px, 32px.
- For cards and component groupings.

#### Section Spacing
- 48px, 64px, 80px, 96px.
- For internal section rhythm.

#### Page-Level Spacing
- 120px, 144px, 160px.
- For major landing page separation.

### Radius Scale

#### Sharp Radius
- 2px.
- Primary buttons, small black CTAs, thin input controls.

#### Small Radius
- 6px.
- Chips, small code controls, tabs.

#### Medium Radius
- 14px.
- Default white cards and panels.

#### Large Radius
- 28px.
- Pinned cards, product preview cards.

#### Full Radius
- 999px.
- Status pills, badge counters, avatar stacks.

### Border Scale

#### Default Border
- 1px solid `#DDE1EA`.

#### Subtle Border
- 1px solid `rgba(17,19,24,0.06)`.

#### Active Border
- 1px solid `#111318`.

#### Critical Border
- 1px solid `#E8BAB6`.

#### Focus Border
- 2px solid `#111318`, 3px offset.

### Shadow / Elevation Scale

#### Ground Level
- No shadow. Use borders.

#### Raised Level
- `0 10px 30px rgba(17,19,24,0.06)`.

#### Floating Level
- `0 18px 48px rgba(17,19,24,0.10)`.

#### Modal Level
- `0 28px 80px rgba(17,19,24,0.16)`.

### Opacity Scale

#### Disabled Opacity
- 0.38

#### Muted Opacity
- 0.62

#### Hover Opacity
- 0.85

#### Overlay Opacity
- 0.72

#### Glow Opacity
- 0.08-0.12

### Z-Index Scale

#### Base
- 0

#### Sticky Navigation
- 50

#### Dropdown
- 100

#### Modal
- 500

#### Toast
- 700

#### Command Palette
- 900

### Motion Tokens

#### Fast Duration
- 120ms

#### Standard Duration
- 220ms

#### Slow Duration
- 500ms

#### Default Easing
- `cubic-bezier(0.22, 1, 0.36, 1)`

#### Entrance Easing
- `cubic-bezier(0.16, 1, 0.3, 1)`

#### Exit Easing
- `cubic-bezier(0.7, 0, 0.84, 0)`

---

## 7. Surface System

### Surface Tokens

#### Main Background
`#F8F8F6`

#### Panel Surface
`#FFFFFF`

#### Raised Surface
`#FBFBFA`

#### Deep Surface
`#111215`

#### Overlay Surface
`rgba(248,248,246,0.82)` with blur.

#### Code Surface
Light: `#FFFFFF` with dotted divider.  
Dark: `#111215` with muted code text.

#### Modal Surface
`#FFFFFF`, border `#DDE1EA`, large shadow.

### Panel Rules

#### Default Panel
White, 14px radius, subtle border, no dramatic shadow.

#### Active Panel
White with black top/left accent line or active border.

#### Critical Panel
Soft pink artifact card with red label and clear finding text.

#### Code Panel
Code panel should look like inspected material, not hacker terminal. Use dotted row separators and clear line numbers.

#### Product Preview Panel
Should look like a real receipt/inspection result. Use structured fields and semantic chips.

#### Empty Panel
Use soft lavender background, dotted outline, and human-readable empty message.

### Black-on-Black Depth Rules
Use deep surfaces only in small moments:
- code proof panels
- CTA contrast bands
- footer
- demo result panel

Do not turn the entire site into a dark dashboard.

### Inner Gradient Rules
Very subtle only:
- Pastel cards can have soft inner gradient from top-left to bottom-right.
- No bright mesh gradients.
- Maximum opacity shift: 4-8%.

### Background Texture Rules
Use a quiet paper/noise overlay:
- SVG noise at 2-3% opacity.
- Keep texture nearly invisible.
- Texture should make the off-white background feel physical, not dirty.

### Grid Texture Rules
Use dotted or faint grid only inside proof sections:
- Dot size: 1px.
- Gap: 32-48px.
- Opacity: 4-6%.

### Scanline Rules
Avoid scanlines except optional code-result panels at 2% opacity. This is not cyberpunk.

### Noise Rules
Global noise should be soft and constant. No animated noise.

### Surface Anti-Patterns
- No glassmorphism.
- No heavy blurry glows.
- No generic dark cards everywhere.
- No identical flat cards across a whole page.
- No stock dashboard screenshots that do not match the system.

---

## 8. Core Component Language

### Component Philosophy
Components should feel like physical proof artifacts placed on a verification board. The system combines:
- precise monochrome controls
- pinned pastel proof cards
- structured receipt panels
- dotted technical dividers
- light mesh proof visuals

### Status Chips

#### Success Chip
Mint surface, green text, pill shape, optional tiny filled dot.

#### Warning Chip
Butter surface, amber text, pill shape, optional outlined dot.

#### Critical Chip
Pink surface, red text, pill shape, optional stop-square icon.

#### Info Chip
Cyan surface, teal text, pill shape, optional node icon.

#### Neutral Chip
White surface, gray text, subtle border.

#### Disabled Chip
Muted background, disabled text, no icon.

### Cards

#### Default Card
White, 14px radius, subtle border, 24px padding.

#### Feature Card
Asymmetric sizing. May include tiny top-left label and proof metric. Avoid same height/same icon repetition.

#### Policy / Rule Card
White or pastel artifact card with:
- label
- rule name
- condition
- outcome
- state chip

#### Metric Card
Metric large in Georama, label uppercase Satoshi, small evidence line underneath.

#### Evidence Card
Pinned pastel card style:
- 28px radius
- soft pastel fill
- white outer backing
- subtle rotation
- tape strip or clip at top
- number/score large
- short evidence text

#### CTA Card
Large soft section card with one black CTA. Keep very minimal.

#### Empty State Card
Pastel muted surface, dotted outline, simple icon, useful next step.

### Panels

#### Dashboard Panel
White panel inside soft section card. Structured, calm, not black-heavy.

#### Console Panel
Used for logs and inspection streams. Can be dark but should remain readable.

#### Code Panel
Light code panel preferred. Dark code panel only when contrast is the point.

#### Timeline Panel
Soft board with pinned steps connected by dotted line.

#### Replay / Inspection Panel
Before/after or quote/payment/receipt split layout.

### Logs / Event Rows

#### Default Row
White background, dotted bottom divider, Satoshi text.

#### Success Row
Green state dot + mint chip.

#### Warning Row
Amber dot + butter chip.

#### Critical Row
Red dot + pink chip.

#### Info Row
Teal dot + cyan chip.

#### Expanded Row
Shows findings, file/line, patch recommendation, and receipt metadata.

### Tables

#### Table Container
White card, 14px radius, border, hidden overflow.

#### Table Header
Uppercase small labels, muted gray, dotted separator.

#### Table Row
48-56px height, clear alignment, hover tint `#F1F3F8`.

#### Table Cell
Use tabular numbers for amounts, scores, counts.

#### Sort State
Black arrow or underline, no blue default.

#### Empty Table
Soft dotted area with clear message and CTA.

#### Mobile Table Behavior
Convert rows to stacked cards. Keep score/recommendation visible first.

### Timelines

#### Horizontal Timeline
Use dotted line connecting proof states.

#### Vertical Timeline
Use for inspection flow and agent decision flow.

#### Replay Timeline
Use cards stacked as before -> quote -> pay -> inspect -> receipt -> decision.

#### Progress Timeline
Use black active line and pastel completed cards.

#### Error / Stop Timeline
Critical node should visibly stop the line and show "blocked" card.

### Pipelines / Flows

#### Default Path
Dotted gray line with small node markers.

#### Success Path
Green active nodes on mint cards.

#### Warning / Branch Path
Amber branch line with review card.

#### Critical / Stopped Path
Red stop node and blocked card.

#### Replay Path
Use numbered pinned cards with a slight rotation difference.

### Code Blocks

#### Static Code Block
White panel with line numbers and dotted separators.

#### Interactive Code Block
Tabs at top, sharp 2px radius buttons, active black underline.

#### Config Block
Use white card with a pastel note attached explaining risk.

#### Result Block
Receipt-style JSON summary with semantic chips.

#### Terminal Block
Dark only when needed. Keep minimal, not hacker aesthetic.

### Buttons

#### Primary Button
Black `#111318`, white text, 2px-4px radius, Satoshi 600.  
Hover: slight lift and shadow.  
Active: compress 1px like Image B.

#### Secondary Button
Transparent or white, black border, black text, 2px-4px radius.

#### Danger Button
Critical red background only inside destructive flows.

#### Developer / Link Button
Text link with dotted underline or arrow.

#### Ghost Button
No border, muted text, black on hover.

#### Icon Button
32-40px square, 6px radius, subtle border.

#### Disabled Button
Muted surface, disabled text, no shadow, no hover.

### Links

#### Inline Link
Black text with dotted underline.

#### Developer Link
Monospace-like Satoshi label, arrow icon, no bright blue.

#### External Link
Small external arrow, muted until hover.

#### Footer Link
Muted text, underline on hover.

### Navigation Components

#### Logo Area
Tiny mark top-left, minimal like Image B. Leave space around it.

#### Nav Links
Small Satoshi labels. Optional uppercase. Low count only.

#### Nav CTA
Small black button, sharp radius.

#### Mobile Menu Trigger
Simple icon button, no animated hamburger theatrics.

#### Mobile Menu Panel
White panel, large tap targets, black CTA at bottom.

### Form Components

#### Text Input
White background, 1px border, 8px radius, 44px minimum height.

#### Search Input
Rounded 10px, left icon, muted placeholder.

#### Select
Same as input, clear chevron, no default browser ugliness.

#### Textarea
Min 140px height, line-height 1.55.

#### Checkbox
Black checked state.

#### Toggle
Pill toggle, black active state, muted inactive.

#### Radio
Black selected dot.

#### Slider
Black track active, muted track inactive.

#### File Upload
Dotted border drop area with pastel evidence note.

#### Validation Message
Inline below input, semantic color, direct copy.

### Feedback Components

#### Toast
White card, left semantic accent, 14px radius.

#### Alert
Pastel surface with structured title/body/action.

#### Banner
Full-width inside section card, not browser-wide unless critical.

#### Tooltip
White, thin border, small shadow, Satoshi 13px.

#### Popover
White card, 14px radius, structured content.

#### Modal
White card, 20px radius, dim overlay, focused action.

#### Command Palette
White panel, crisp rows, black active state.

### Loading Components

#### Skeleton Row
Light gray shimmer, no bright gradient.

#### Skeleton Card
Pastel muted placeholder, pinned-card shape if replacing artifact card.

#### Skeleton Panel
White panel with gray bars and dotted dividers.

#### Progress Indicator
Dotted timeline or node progress. Avoid generic spinners.

#### Loading Log Stream
Rows appear one by one with tiny status dots.

### Empty States

#### Empty Dashboard
Soft lavender board, one clear next action.

#### Empty Logs
Dotted panel with "No inspections yet."

#### Empty Search
Search term echoed, one next step.

#### Empty Config
Show a starter config card, not a blank box.

#### Empty Replay
Explain what replay will show once a receipt exists.

### Error States

#### Validation Error
Inline red text + field border.

#### System Error
White panel with critical chip and retry action.

#### Network Error
Explain connection/payment state separately.

#### Permission Error
Show locked proof card and required access.

#### Empty / Missing Data Error
Use neutral language. Do not blame the user.

---

## 9. Product Proof Components

### Product Visual Rules
Product visuals should be real UI-like artifacts:
- quote card
- payment card
- inspection card
- receipt card
- recommendation card
- badge/seal
- node proof mesh

### Proof-First Section Rules
Every proof section needs one visible artifact that proves the claim. Do not rely on abstract copy.

### Demo Visuals
The primary demo visual should show a linear proof event:
1. submit change
2. quote appears
3. payment required
4. inspection runs
5. receipt generated
6. action is pass/warn/block

### Before / After Panels
Use split panels:
- before: risky unknown change
- after: inspected proof with recommendation

### Decision Panels
Decision panel must include:
- score
- recommendation
- severity count
- next action
- receipt metadata

### Config Panels
Config panels should include human-readable labels beside code/config snippets.

### Audit / Trace Panels
Rows should show timestamp, event, paid amount, inspected units, result.

### Inspection Panels
Inspection panel has categorized checks. Use pastel states instead of generic icons.

### Live State Indicators
Use small dots and labels:
- live
- quoted
- paid
- inspecting
- verified
- blocked

### Product Screenshot Rules
Screenshots must match this design system. Never paste a mismatched generic dashboard inside a beautiful landing page.

### Fake UI Anti-Patterns
- Fake charts with no labels.
- Fake code that says lorem ipsum.
- Random terminal commands.
- "AI analyzing..." without visible inspected units or result.
- Badge without receipt context.

---

## 10. Hero Section Direction

### Hero Purpose
In five seconds, the hero should communicate:
- what kind of product this is
- what decision it protects
- what proof object it creates
- where to click

### Hero Composition

#### Left Content Area
- Minimal logo/navigation above.
- Small uppercase category label.
- Huge Georama headline.
- Short Satoshi explanation.
- One black primary CTA.
- One subtle secondary developer link.
- Proof/status row underneath.

#### Right Product Visual Area
- Abstract node mesh from Image B or receipt artifact cluster.
- Mesh should feel like a risk surface being inspected.
- Nodes can connect to pinned cards: quote, score, receipt, recommendation.

#### Status / Trust Row
Use compact proof labels:
- 402 quoted
- USDC paid
- units inspected
- receipt signed
- recommendation returned

### Hero Background
Use `#F8F8F6` page background. Add very subtle dot grid or mesh on the right only. Avoid full-hero gradient.

### Hero Typography
Large, confident, sparse. Georama headline should own the screen.

### Hero Product Visual
A mesh or receipt cluster should sit in the right half and feel like evidence, not decoration.

### Hero CTA System
Primary: black button.  
Secondary: text link with dotted underline.  
Do not use two equal buttons.

### Hero Motion
- Mesh nodes softly resolve in.
- Receipt cards slide/fade with small stagger.
- CTA hover compresses.
- Reduced motion: static mesh and no card rotation animation.

### Hero Mobile Layout
- Stack content.
- Product visual below CTA.
- Hide non-essential mesh nodes.
- Keep proof row horizontally scrollable if needed.

### Hero Anti-Patterns
- No abstract gradient blob.
- No stock laptop mockup.
- No generic "AI-powered" hero.
- No three CTA buttons.
- No tiny headline.

---

## 11. Hero Content Lock

### Main Headline
Primary:
**Pay for proof before autonomous code changes ship.**

Alternate:
**The risk receipt layer for AI-written software.**

Alternate:
**Don’t let the agent that wrote the change approve the change.**

### Short Product Explanation
Primary:
Sigillum verifies risky software changes before merge, deploy, install, or publish, then returns a signed receipt with score, findings, payment, and recommendation.

Shorter:
A neutral verifier for AI-generated diffs, priced per inspection and returned as a machine-readable receipt.

### Primary CTA
**Inspect a change**

### Secondary CTA
**View receipt example**

### Status Row Labels
- 402 quoted
- USDC paid
- units inspected
- score returned
- receipt signed
- agent decision

### Hero Copy Rules
- Keep sentences short.
- Use concrete nouns: receipt, score, quote, payment, units, recommendation.
- Avoid broad trust claims.
- Do not say "secure forever."
- Use "risk signal" or "verification receipt" instead of "guaranteed safe."

### Approved Headline Directions
- Proof before action.
- Neutral verifier.
- Risk receipt.
- Agent-native payment.
- Machine-readable recommendation.
- Pay-per-inspection.

### Rejected Headline Directions
- "AI security made easy."
- "The future of code review."
- "Protect your code with AI."
- "Ship faster with confidence."
- "Autonomous security platform."

---

## 12. Landing Page Structure

### Section 1: Hero

#### Purpose
Make the category clear and establish the proof-before-action idea.

#### Title
Pay for proof before autonomous code changes ship.

#### Copy
A neutral verification service that inspects risky software changes and returns a signed receipt before an agent merges, deploys, installs, or publishes.

#### CTA
Primary: Inspect a change.  
Secondary: View receipt example.

#### Visual
Right-side node mesh connected to pinned cards for quote, score, receipt, and decision.

#### Motion
Mesh resolves, cards gently settle, CTA compresses on hover.

#### Proof Element
Status row: quoted -> paid -> inspected -> receipt -> decision.

### Section 2: Problem / Failure Mode

#### Purpose
Show the trust gap without sounding dramatic.

#### Title
The writer should not be the only reviewer.

#### Copy
Autonomous coding tools can generate changes faster than humans can inspect them. The weak point is the moment before the action: merge, deploy, install, or publish.

#### Visual
Soft section board with one critical pinned card and one neutral explanation panel.

#### Proof Element
Before panel showing an unknown diff and a blocked-risk example.

#### Anti-Pattern
Do not use generic fear graphics, shields, red sirens, or hacker imagery.

### Section 3: Core Product Flow

#### Purpose
Explain the quote/payment/inspection/receipt loop.

#### Title
A paid proof loop for risky software actions.

#### Flow Steps
1. Submit change.
2. Receive quote.
3. Pay small amount.
4. Inspect bounded diff.
5. Receive receipt.
6. Act: pass, warn, or block.

#### Visual
Image A-inspired pinned cards arranged in a slight arc, connected by dotted path.

#### State Behaviors
Each card changes state as the flow progresses.

#### Proof Element
Visible quote amount, inspected unit count, and recommendation.

### Section 4: System / Engine

#### Purpose
Show there is a real verifier underneath the UI.

#### Title
Deterministic checks before expensive explanation.

#### Technical Visual
Code/config panel + rule cards + inspection category list.

#### Human-Readable Translation
The system checks changed lines, dependency changes, config mutations, secrets, dangerous APIs, prompt surfaces, and structural issues.

#### Proof Element
Checklist of inspected categories with counts.

### Section 5: Live Product Console

#### Purpose
Make the product feel real and inspectable.

#### Title
The receipt is the interface.

#### Data Rows
- quote created
- payment required
- payment verified
- diff parsed
- findings generated
- recommendation returned

#### State Rows
Use semantic row colors and chips.

#### Proof Element
Receipt ID, paid amount, inspected units, score.

### Section 6: Replay / Inspection Mode

#### Purpose
Show how a user or agent can understand what happened.

#### Title
Replay the decision before trusting it.

#### Before State
Unknown generated change.

#### After State
Receipt with score, findings, and decision.

#### Timeline
Dotted vertical timeline with pinned proof cards.

#### Proof Element
Before/after recommendation change.

### Section 7: Developer Integration

#### Purpose
Show it is easy to call.

#### Title
One call before the risky action.

#### Code Snippet
Show quote and inspect calls. Keep code short.

#### Result Panel
Receipt JSON summary.

#### Proof Element
Machine-readable recommendation shown clearly.

### Section 8: Trust / Credibility

#### Purpose
Make the external verifier feel neutral and useful.

#### Title
Neutral proof, not another self-review.

#### Trust Signals
- external verifier
- signed receipt
- visible payment
- inspected units
- deterministic checks
- machine-readable output

#### Technical Guarantees
Use careful phrasing: bounded checks, priced by inspected surface, receipt generated after payment.

#### Proof Element
Seal/badge preview.

### Section 9: Final CTA

#### Purpose
Return to the single action.

#### Title
Make risky changes prove themselves first.

#### Copy
Inspect a diff, pay for the check, and receive a receipt your agent or maintainer can act on.

#### CTA
Inspect a change.

#### Simplified Product Visual
One pinned receipt card on soft section board.

---

## 13. Navigation System

### Desktop Navigation
Minimal top bar inspired by Image B:
- logo/mark left
- 3-4 nav links max
- sign in or docs right
- one small CTA

### Navigation Items
Suggested:
- Product
- Flow
- Receipt
- Docs
- Sign in

### Logo Area
Small black mark. Keep it quiet.

### Nav CTA
Small black button with sharp radius.

### Sticky / Fixed Behavior
Navigation can be sticky with translucent off-white background and blur after scroll.

### Active Link Behavior
Black underline or small dot. No bright color.

### Mobile Navigation
Logo left, menu button right, CTA inside panel.

### Mobile Menu
White card panel with large row links and black CTA.

### Navigation Anti-Patterns
- No crowded nav.
- No mega-menu.
- No animated logo distraction.
- No default blue links.

---

## 14. Footer System

### Footer Purpose
Close with credibility, docs, and product proof.

### Footer Layout

#### Product Column
- Overview
- Receipt
- Pricing
- Demo

#### Developers Column
- Docs
- API
- CLI
- GitHub badge

#### System Column
- Status
- Security
- Changelog
- Terms

#### Project Column
- About
- Contact
- X / GitHub
- Privacy

### Footer Visual Style
Deep ink background with off-white text. Keep it sparse.

### Footer Status Line
Use tiny live dot:
System status: operational.

### Footer Microcopy
Short, direct, proof-led.

### Footer Link Behavior
Muted links brighten to off-white.

### Footer Mobile Behavior
Stack columns, keep status line visible.

---

## 15. Responsive System

### Breakpoints

#### Mobile
0-767px

#### Tablet
768-1023px

#### Desktop
1024-1439px

#### Large Desktop
1440px+

### Mobile Priorities
- Headline readable.
- CTA visible.
- Proof row clear.
- Receipt card legible.
- Pinned cards stack cleanly.

### Hero Mobile Rules
- Hero headline max 4 lines.
- Product visual below text.
- Hide decorative mesh density.
- Keep one primary CTA.

### Product Visual Mobile Rules
- Reduce card rotation to max 2deg.
- Stack cards.
- Hide tape details only if they hurt readability.

### Dashboard / Table Mobile Rules
- Convert rows to cards.
- Keep score/recommendation/payment first.
- Avoid horizontal scroll except code blocks.

### Typography Mobile Rules
- Body at least 15.5px.
- Labels should not wrap awkwardly.
- Use shorter section titles if needed.

### Spacing Mobile Rules
- Page margin: 16px.
- Section card padding: 28-40px.
- Card padding: 20-24px.

### Navigation Mobile Rules
- No full desktop nav.
- Menu panel should be clear and fast.

### Touch Target Rules
- Minimum 44px height.
- Icon buttons minimum 40px.

### Responsive Anti-Patterns
- Do not keep desktop card rotations on mobile.
- Do not shrink hero text until it loses authority.
- Do not force tables to full width without stacking.

---

## 16. Accessibility System

### Contrast Rules
- Dark text on pastel cards.
- White text only on black/deep surfaces.
- Semantic colors must include text labels.

### Focus States

#### Default Focus
2px black outline with 3px offset.

#### Button Focus
Black or white outline depending on button background.

#### Link Focus
Dotted underline + outline.

#### Input Focus
Black border + subtle focus ring.

#### Table Row Focus
Full row outline or background tint.

#### Danger Focus
Critical border + black focus ring, not red-only.

### Keyboard Navigation
All interactive proof cards, tabs, accordions, and code panels must be keyboard accessible.

### Screen Reader Labels
Status chips must include full labels, not color-only states.

### Status Label Accessibility
Always pair status color with text:
- Pass
- Warn
- Block
- Paid
- Quoted
- Signed

### Reduced Motion Rules
Disable card rotation animation, mesh animation, staggered scroll reveals. Keep state changes immediate.

### Touch Target Rules
44px minimum for mobile interactions.

### Error Accessibility
Errors should state what happened and what to do next.

### Color-Blind Safety Rules
Use icon/label/shape differences in addition to color.

### Table Accessibility
Headers must be real headers. Sort states need aria labels.

### Code Block Accessibility
Code blocks need copy buttons with labels and horizontal scroll only when necessary.

---

## 17. Motion & Interaction System

### Motion Principles
Motion should feel like evidence being placed, inspected, and approved. No spectacle.

### Default Page Motion
Fade up 12-20px with soft stagger. Keep minimal.

### Hero Motion
- Mesh nodes fade in.
- Receipt cards gently settle.
- CTA compresses on hover.

### Product Flow Motion
Cards appear one by one along dotted path.

### Pipeline Motion

#### Success Motion
Green node fills, receipt card gets subtle check.

#### Warning / Branch Motion
Amber path branches to review card.

#### Critical / Stop Motion
Path stops at critical card. No shaking or alarm animation.

#### Replay Motion
Timeline scrub highlights each proof card.

### Microinteractions

#### Button Interaction
Primary button lifts on hover, compresses on press.

#### Card Interaction
Pinned cards lift slightly and reduce rotation on hover.

#### Status Chip Interaction
No motion unless clickable.

#### Log Row Interaction
Hover reveals metadata/details.

#### Code Window Interaction
Copy button fades in.

#### Table Row Interaction
Subtle background tint.

### Loading Motion
Use progress nodes or skeletons, not default spinners.

### Error Motion
Critical card appears instantly with subtle opacity fade. No bouncing.

### Mobile Motion Rules
Reduce stagger and shadow intensity.

### Reduced Motion Fallbacks
Use opacity only or no animation.

### Performance Rules
- No expensive background animations.
- Mesh should be SVG/CSS-light.
- No continuous noise animation.
- No heavy WebGL unless later product direction requires it.

### Motion Anti-Patterns
- No cyber lasers.
- No neon pulse.
- No spinning 3D cubes.
- No overanimated sticky cards.
- No animation that hides the proof.

---

## 18. Copy & Content Rules

### Voice Principles
Clear, technical, calm, proof-led. The copy should sound like a trusted reviewer, not a hype marketer.

### Headline Rules
- Short.
- Concrete.
- One idea at a time.
- Use proof/action language.

### Body Copy Rules
- Explain the risk moment.
- Keep paragraphs short.
- Avoid bloated "AI revolution" language.
- Use terms like receipt, inspect, quote, paid, score, recommendation.

### CTA Copy Rules
Use specific CTAs:
- Inspect a change
- View receipt example
- Run a quote
- See inspected units
- Copy API call

Avoid:
- Get Started
- Learn More
- Unlock the future

### Label Copy Rules
Use uppercase metadata labels:
- RECEIPT ID
- PAID
- SCORE
- RECOMMENDATION
- INSPECTED UNITS
- FINDINGS

### Error Copy Rules
Helpful and direct:
- Payment was not verified.
- Diff payload is too large.
- Receipt could not be generated.
- Missing inspected content.

### Empty State Copy Rules
Explain what will appear and how to create it.

### Developer Copy Rules
Prefer exact action verbs:
- submit
- quote
- inspect
- pay
- verify
- return
- block
- patch

### Product Explanation Rules
The flow should always connect:
risk -> quote -> payment -> inspection -> receipt -> decision.

### Words To Use
proof, receipt, seal, score, inspect, verify, quote, paid, risk, recommendation, units, findings, patch, block, warn, pass, neutral, external, machine-readable.

### Words To Avoid
revolutionary, magical, AI-powered, next-gen, frictionless, unlock, supercharge, game-changing, military-grade, guaranteed secure.

### Copy Anti-Patterns
- Generic SaaS claims.
- Dramatic fear hooks.
- Copy that hides payment.
- Security absolutism.
- Vague "trust layer" without showing receipts.

---

## 19. Trust & Credibility System

### Trust Signals
- Receipt ID.
- Timestamp.
- Paid amount.
- Inspected units.
- Score.
- Recommendation.
- Signed/sealed status.
- Rule categories.

### Proof Signals
Proof signals should be visible before testimonials or logos.

### Technical Credibility
Show real inspection categories and structured fields. Use "deterministic checks first" language where relevant.

### Open-Source / Developer Credibility
Use badges, API snippets, CLI command, GitHub PR badge preview.

### Safety / Reliability Signals
Use careful claims:
- risk signal
- verification receipt
- independent check
- bounded analysis
- machine-readable recommendation

### Metrics Rules
Use precise numbers when available. If not available, use UI placeholders that clearly look like demo values.

### Testimonial / Quote Rules
Do not add fake testimonials in the system. Reserve until real proof exists.

### Social Proof Rules
Social proof is secondary to product proof. Product receipt comes first.

### Claims Rules
Every claim should be backed by a visual proof object.

### Trust Anti-Patterns
- Logos before product proof.
- Overclaiming security.
- Fake enterprise badges.
- Decorative receipts with no real fields.
- Generic trust copy.

---

## 20. Implementation Rules

### Component Consistency Rules
Every page should use:
- same section container style
- same pinned artifact card rules
- same button radius
- same pastel semantic system
- same typography roles

### Token Usage Rules
Use tokens before custom CSS values. No random one-off colors.

### State Coverage Rules
Every interactive component needs:
- default
- hover
- focus
- active
- disabled
- loading
- error where relevant

### Page Consistency Rules
All pages should feel like the same proof board. If a page looks like a generic dashboard, redesign it.

### Responsive Implementation Rules
Build mobile first for cards/tables, then enhance desktop with positioning and rotation.

### Performance Implementation Rules
Use CSS/SVG for mesh and cards. Avoid heavy animation libraries unless absolutely necessary.

### Accessibility Implementation Rules
Focus rings, labels, and keyboard flows are required from the start.

### Design QA Rules
Run each section through:
1. What is the dominant element?
2. What proof does this section show?
3. What is the user supposed to click?
4. Does the card system still feel intentional?
5. Does mobile remain legible?

### Handoff Rules
Include:
- color tokens
- type tokens
- spacing tokens
- radius tokens
- component states
- sample hero
- sample receipt card
- sample flow section
- anti-pattern list

---

## 21. Final Anti-Slop Rules

### Do Not Use
- Purple/blue gradient blob hero.
- Generic 3-card feature grid.
- "Get Started" as primary CTA.
- Stock team photos.
- Placeholder lorem ipsum.
- Default blue links/buttons.
- Unrelated dashboards.
- Random neon/cyberpunk effects.
- Same radius on every element.
- Product visuals that do not show receipt/payment/proof.

### Always Use
- Off-white page background.
- Soft section card containers.
- Top-left section tab shape or label.
- Pinned pastel proof cards.
- Black primary CTA.
- Georama for big moments.
- Satoshi for interface clarity.
- Dotted dividers or proof paths.
- Real proof objects: quote, payment, inspection, receipt, decision.

### Section Test
Each section must pass:
- Can I screenshot this section and know why it exists?
- Is there one dominant visual?
- Is the proof visible?
- Is the layout not generic?

### Component Test
Each component must pass:
- Does it have a clear state?
- Does it belong to the proof-board system?
- Does it avoid default SaaS styling?

### Hero Test
In five seconds, the hero must answer:
- What does this product do?
- What proof does it create?
- What should I click?

### Mobile Test
On mobile:
- No unreadable rotated cards.
- No tiny product visuals.
- No hidden primary CTA.
- No table-only data.

### Motion Test
Motion should clarify the flow. If motion exists only to impress, remove it.

### Copy Test
Remove any sentence that sounds like any AI startup could say.

### Final Design Feeling
A calm, precise proof board for autonomous software decisions: soft enough to feel approachable, sharp enough to feel trusted, and specific enough that it could not belong to any random SaaS product.
