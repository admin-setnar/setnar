# Design System

Implements `DESIGN_SYSTEM.md`. Two rules govern everything in this folder:

1. **No component hardcodes a visual value.** Colours, spacing, radii, shadows
   and durations come from tokens defined in `src/app/globals.css`.
2. **No component contains business logic.** These are presentation primitives;
   they receive data and render it.

## Tokens

Defined once in `globals.css`, consumed by Tailwind through
`rgb(var(--token) / <alpha-value>)`. A tenant may override any of them at
runtime — see ADR-002.

| Group | Tokens |
| --- | --- |
| Surfaces | `surface`, `surface-raised`, `surface-sunken`, `surface-inverted` |
| Content | `content`, `content-muted`, `content-subtle`, `content-inverted` |
| Lines | `line`, `line-strong` |
| Action | `brand`, `brand-hover`, `brand-active`, `brand-subtle`, `brand-contrast` |
| Status | `success`, `warning`, `danger` (each with a `-subtle` background) |
| Radius | `sm` 6px · `md` 8px · `lg` 12px · `xl` 16px |
| Elevation | `shadow-subtle`, `shadow-raised`, `shadow-overlay` |
| Motion | `duration-fast` 120ms · `duration-base` 200ms · `duration-slow` 300ms |

Spacing uses Tailwind's default 8-point scale. Never use arbitrary values.
Borders are preferred over shadows; shadows exist to separate layers, never to
decorate.

Every colour pair in use has been audited against WCAG AA. The lowest ratio in
the product is 4.62:1.

## Components

Each file carries its own documentation block — purpose, variants, states,
accessibility notes and known limitations. Summary:

| Component | Purpose | Notes |
| --- | --- | --- |
| `Button` | Every action in the product | `primary` · `secondary` · `ghost` · `danger`; `loading` sets `aria-busy`; `asChild` composes onto a `Link` |
| `Input` | Single-line text entry | `invalid` sets `aria-invalid`; `leading` / `trailing` slots |
| `Label` | Names a control | Radix; clicking focuses the control |
| `Checkbox` | One binary choice | Radix; always paired with a `Label` |
| `FormField` | Label + control + hint + error | Owns the `aria-describedby` wiring so a form cannot ship without it |
| `FormAlert` | Outcome of a submitted form | `role="alert"` for errors, `role="status"` for success |
| `Modal` | Short self-contained task | Radix Dialog: focus trapped and restored, Escape closes, background inert |
| `Card` | Groups related content | `outlined` · `raised` · `sunken`; make it a button/anchor at the call site if clickable |
| `Badge` | Status or category | Text always states the meaning; colour never carries it alone |
| `Text` | All typography | `display` · `heading` · `title` · `subtitle` · `body` · `caption` · `eyebrow`; `as` controls semantics independently of size |
| `IconWrapper` | Consistent icon sizing | Icons support labels, never replace them |
| `Spinner` | In-flight action in a small control | Decorative; the parent owns the accessible state |
| `Reveal` | Scroll-in transition | `IntersectionObserver`; disabled under reduced motion (ADR-005) |
| `BrandRule` | The identity's graphic element | Structural marker, used as a section eyebrow |
| `Container` | Max width and gutters | The only place horizontal rhythm is decided |
| `Section` | Vertical rhythm and tone | Renders a landmark; pass `labelledBy` |
| `Navbar` | Persistent gateway chrome | Transparent, then glass on scroll; Radix Dialog mobile menu |
| `Footer` | Identity, links, legal notice | The legal notice is a compliance requirement — see README |
| `FeedbackPrompt` | One-click qualitative microfeedback card | Not a modal; `optionsWithDetail` lists which answers reveal an optional text field, each with its own optional `detailLabel` (SET-63); self-dismisses once resolved (ADR-069) |

## Adding a component

1. Check it does not already exist. Never reinvent a component.
2. One responsibility. Under 300 lines, per `ENGINEERING_GUIDELINES.md`.
3. Tokens only — no literal colours, spacing or type sizes.
4. Keyboard operable, focus visible, semantic HTML, ARIA only where necessary.
5. Add the documentation block, and a row to the table above.
