# AttendEase Admin — Theme & Design System

Design language for the AttendEase admin portal. Built on **Tailwind CSS v4**, **Inter**, and a warm maroon institutional palette suited for academic attendance management.

---

## Brand Identity

| Attribute | Value |
|-----------|-------|
| Product name | AttendEase |
| Context | Institutional admin portal |
| Tone | Professional, trustworthy, approachable |
| Primary accent | Deep maroon — authority without harshness |

---

## Color Palette

### Brand

| Token | CSS Variable | Hex | Usage |
|-------|--------------|-----|-------|
| Maroon | `--maroon` | `#610000` | Primary buttons, active nav, key accents |
| Maroon Dark | `--maroon-dark` | `#8b0000` | Login CTA, hover states, headings |
| Maroon Light | `--maroon-light` | `#ffe9e6` | Active nav background, icon wraps, hover fills |
| Maroon Muted | `--maroon-muted` | `#f5d6d2` | Subtle brand tints |

### Surfaces

| Token | CSS Variable | Hex | Usage |
|-------|--------------|-----|-------|
| Background | `--background` | `#ece8e6` | App canvas behind content |
| Foreground | `--foreground` | `#261816` | Primary text |
| Surface | `--surface` | `#ffffff` | Cards, sidebar, modals |
| Surface Raised | `--surface-raised` | `#fff8f6` | Table headers, hover rows, filter bars |
| Header BG | `--header-bg` | `#fff8f6` | Card headers, table thead |

### Borders

| Token | CSS Variable | Hex | Usage |
|-------|--------------|-----|-------|
| Border | `--border` | `#d4d0ce` | Default borders |
| Border Warm | `--border-warm` | `#e3beb8` | Input hover, warm dividers |
| Border Subtle | `--border-subtle` | `#ebe7e5` | Row separators, light dividers |

### Text

| Token | CSS Variable | Hex | Usage |
|-------|--------------|-----|-------|
| Secondary | `--text-secondary` | `#5a403c` | Descriptions, labels, nav inactive |
| Muted | `--text-muted` | `#7a6b68` | Placeholders, timestamps, hints |
| On Brand | `--text-on-brand` | `#ffffff` | Text on maroon backgrounds |

### Semantic

| Role | Text | Background | Border |
|------|------|------------|--------|
| Success | `#166534` | `#f0fdf4` | `#bbf7d0` |
| Error | `#b91c1c` | `#fef2f2` | `#fecaca` |
| Warning | `#b45309` | `#fffbeb` | `#fde68a` |
| Info | `#1d4ed8` | `#eff6ff` | `#bfdbfe` |

### Department Badges

| Dept | Style |
|------|-------|
| CCS | Blue tint (`bg-blue-50`, `border-blue-200`, `text-blue-700`) |
| CBE | Pink tint |
| CCJE | Green tint |
| CTE | Yellow tint |

---

## Typography

**Font family:** Inter (`--font-inter`), system-ui fallback

| Style | Class / Size | Weight | Use |
|-------|--------------|--------|-----|
| Page title | `.page-title` — 24px | 700 | Screen headings |
| Page subtitle | `.page-subtitle` — 14px | 400 | Screen descriptions |
| Section title | `text-lg font-bold` | 700 | Card / panel headers |
| Body | `text-sm` — 14px | 400–600 | Tables, forms, content |
| Label (form) | `.label-field` — 11px uppercase | 700 | Input labels |
| Label (settings) | `.label-field-sm` — 14px | 700 | Section form labels |
| Badge | `text-[11px] uppercase` | 700 | Status & dept chips |
| Mono | `font-mono text-xs` | 400 | QR tokens, student numbers |

**Letter-spacing:** Page titles use `-0.01em`. Labels use `0.05em` tracking.

---

## Spacing & Layout

| Pattern | Value |
|---------|-------|
| Sidebar width | `240px` (`w-60`) |
| Main padding | `24px` mobile, `32px` desktop (`p-6 lg:p-8`) |
| Content max width | `max-w-7xl` (lists), `max-w-3xl` (settings) |
| Card padding | `16px` (`.card-body`) or `20px` (`p-5`) |
| Section gap | `space-y-4` to `space-y-6` |
| Grid gap (stats) | `gap-4` |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Badges, small chips |
| `--radius-md` | 8px | Buttons, inputs, icon buttons |
| `--radius-lg` | 10px | Cards, panels (`.card`) |
| `--radius-xl` | 14px | Login logo container |

---

## Elevation & Shadows

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Minimal depth |
| `--shadow-sm` | Cards (default) |
| `--shadow-md` | Hover cards, login panel |
| `--shadow-lg` | Modals |

Cards use `shadow-sm` by default and `hover:shadow-md` on interactive stat cards.

---

## Motion

| Token | Duration | Easing |
|-------|----------|--------|
| `--transition-fast` | 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-base` | 200ms | Same |

Apply to: buttons, inputs, nav items, table rows, modal overlay.

---

## Focus & Accessibility

- Focus ring: `box-shadow: 0 0 0 3px var(--ring-color)` where `--ring-color` is maroon at 25% opacity
- Inputs and buttons use `:focus-visible` patterns via `.input-field` and `.btn-*` classes
- Nav links set `aria-current="page"` when active
- Modals use `role="dialog"`, `aria-modal`, and labelled titles
- Icon-only buttons include `aria-label`
- Text selection uses maroon-light background

---

## Component Patterns

### Page Header

```tsx
import { PageHeader } from "@/components/ui/PageHeader";

<PageHeader
  title="Students"
  description="Manage student records and QR tokens"
  actions={<Button>Add Student</Button>}
/>
```

### Card

```tsx
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

<Card>
  <CardHeader action={<Link className="link-brand">View all</Link>}>
    <h3 className="text-base font-bold">Recent Sessions</h3>
  </CardHeader>
  <CardBody>...</CardBody>
</Card>
```

Or use the utility class directly: `className="card p-4"`.

### Buttons

| Variant | Class | When to use |
|---------|-------|-------------|
| Primary | `btn btn-primary` | Main actions (Save, Add, Sign in) |
| Secondary | `btn btn-secondary` | Secondary actions (Import, Cancel alt) |
| Ghost | `btn btn-ghost` | Tertiary / modal cancel |
| Outline brand | `btn btn-outline-brand` | Logout, outlined brand actions |
| Icon | `btn-icon` | Table row actions, pagination |

React wrapper: `@/components/ui/Button` with `variant` prop.

### Form Fields

```html
<label class="label-field" for="email">Email Address</label>
<input id="email" class="input-field" />

<select class="select-field">...</select>
```

### Alerts

```tsx
import { Alert } from "@/components/ui/Alert";

<Alert variant="success" onDismiss={() => ...}>Saved.</Alert>
<Alert variant="error">Something went wrong.</Alert>
```

CSS utilities: `.alert .alert-success | .alert-error | .alert-warning`

### Tables

- Wrap in `.card` with `.card-header` for title bar
- Add `.table-row-hover` on `<table>` for row hover
- Header row: `bg-header-bg`, uppercase `text-xs` column labels
- Body rows: `border-border-subtle` separators

### Badges

```tsx
<Badge dept="CCS">CCS</Badge>
<Badge variant="status-open">Open</Badge>
<Badge variant="active">Active</Badge>
```

Status variants: `status-open`, `status-active`, `status-closed`, `status-draft`, `status-present`, `status-late`, `status-absent`, `active`, `inactive`.

### Modal

- Backdrop: `bg-foreground/40` with light blur
- Panel: `.card` + `shadow-lg`
- Footer actions: primary right, ghost/cancel left

### Empty States

Use `.empty-state` for centered no-data messages inside cards.

### Stat Cards

- `.card` with `.stat-icon-wrap` for the metric icon
- Large number: `text-3xl font-bold tracking-tight`
- Optional `hover:shadow-md` for subtle interactivity

---

## Screen-Specific Notes

### Login

- Radial maroon gradient backdrop + soft blob accent
- Centered card with logo mark, refined typography (no oversized 44px title)
- Full accessibility on password toggle and form labels

### Sidebar

- Fixed white surface with light shadow
- Active item: maroon-light fill + left maroon bar indicator
- Logout: outline-brand button at footer

### Dashboard

- 4-column stat grid on large screens
- 7/5 split for Recent Sessions vs Recent Activity
- Session list items hover with `surface-raised` background

---

## File Reference

| File | Purpose |
|------|---------|
| `src/app/globals.css` | All design tokens and utility classes |
| `src/components/ui/Button.tsx` | Button component |
| `src/components/ui/Card.tsx` | Card, CardHeader, CardBody |
| `src/components/ui/PageHeader.tsx` | Page title block |
| `src/components/ui/Alert.tsx` | Inline feedback messages |
| `src/components/ui/Badge.tsx` | Status and department chips |
| `src/components/ui/Modal.tsx` | Dialog overlay |
| `src/components/ui/Pagination.tsx` | Table pagination |

---

## Extending the Theme

1. **Add a token** in `:root` inside `globals.css`, then map it in `@theme inline` for Tailwind utilities.
2. **Add a utility** in `@layer components` — prefer composition over one-off classes in pages.
3. **New status type?** Add a variant to `Badge.tsx` and document it in the Semantic / Badge sections above.
4. **Keep contrast** — body text on white must meet WCAG AA (4.5:1). Maroon on maroon-light is for large/bold text only.

---

## Quick Token Cheat Sheet

```css
/* Brand action */
background: var(--maroon);
color: var(--text-on-brand);

/* Page canvas */
background: var(--background);

/* Content panel */
.card { /* uses --surface, --border, --shadow-sm, --radius-lg */ }

/* Focus */
box-shadow: 0 0 0 3px var(--ring-color);
```
