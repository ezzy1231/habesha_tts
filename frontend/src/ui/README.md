# Habesha TTS design system (`src/ui`)

The reusable UI layer for the redesigned pages: tokens, components, layout shells and i18n.
Everything is exported from `src/ui/index.js`:

```jsx
import { Button, Card, StreamerLayout, useI18n, useToast } from '../ui';
```

To see every component, run `npm run dev` and open **`/ui-kit`**. It's a dev-only, lazy-loaded route. To include it in a build, set
`VITE_ENABLE_UI_KIT=true`. The layout demos are at `/ui-kit/public`, `/ui-kit/streamer/live` and `/ui-kit/admin`.

---

## Tokens

The tokens live in `tailwind.config.js` and the CSS variables in `src/index.css`. The UI is **dark-first**: it is designed for dark, and light mirrors it.
Theming uses the `dark` class on `<html>` (`darkMode: 'class'`).

| Token | Tailwind classes | Notes |
|---|---|---|
| Canvas | `bg-canvas` | Page background |
| Surfaces | `bg-surface`, `bg-surface-2`, `bg-surface-3` | Cards, then insets, then pressed/skeleton |
| Lines | `border-line`, `border-line-strong` | Hairlines, then hover/strong borders |
| Text | `text-fg`, `text-muted`, `text-subtle` | Primary, secondary and tertiary |
| Brand | `brand-50 … brand-950` | **`brand-600` = flag green `#078930`** (4.5:1 with white) |
| Flag | `flag-green`, `flag-yellow`, `flag-red` | Use **sparingly**: flag bars, live dots, highlights |
| Shadows | `shadow-card`, `shadow-raised`, `shadow-overlay` | Resting, then hover, then modals/toasts |
| Radius | `rounded-md` 6px · `rounded-lg` 8px · `rounded-xl` 12px · `rounded-2xl` 16px | Controls · inputs/buttons · cards · dialogs |
| Fonts | `font-sans`, `font-ethiopic` | Inter and Noto Sans Ethiopic. Ge'ez glyphs fall through to Noto automatically |

The theme-aware colours are RGB triplets, so opacity modifiers work: `bg-surface/80`, `border-line/50`.
Use `text-fg` and `bg-surface` instead of `text-gray-900 dark:text-white`.

The legacy palette (`primary`, `secondary`, …) and the `.card`/`.btn` classes are still there for the existing pages.
Design-system form controls carry `data-ui`, which opts them out of the legacy global `input/textarea/select` styles.

## Theme and language

```js
import { useTheme, initTheme, useI18n, t, setLang, extendDictionaries } from '../ui';

const { theme, setTheme, toggleTheme } = useTheme(); // 'dark' | 'light', persisted in localStorage("theme")
initTheme();                                         // optional at startup: applies the saved theme, defaulting to dark

const { t, lang, setLang } = useI18n();              // re-renders on change, persisted in localStorage("lang")
t('nav.donations');                                  // "ስጦታዎች" / "Donations"
t('table.sortBy', { column: 'Amount' });             // {var} interpolation
extendDictionaries({ en: { 'page.x': '…' }, am: { 'page.x': '…' } }); // let pages add their own strings
```

The default language is `am`. A missing key falls back to `en`, then to the key itself. `setLang` also updates `<html lang>`.
`<ThemeToggle />` and `<LanguageToggle />` are ready-made controls for both.

## Components

All components have prop-types, show visible `focus-visible` rings and work from the keyboard.

| Component | Key props |
|---|---|
| `Button` | `variant` primary/secondary/ghost/danger · `size` sm/md/lg · `loading` · `disabled` · `iconOnly` (needs `aria-label`) · `leftIcon` / `rightIcon` · `fullWidth` · `as` (for example `as={Link} to="…"`). Forwards its ref |
| `Input` | `label` · `hint` · `error` · `required` · `leftIcon` · `rightSlot` · `size`. Plus native input props. Forwards its ref |
| `Textarea` | Same as Input, plus `rows` · `maxLength` + `showCount` (with a controlled `value`) |
| `Select` | Same as Input, plus `options=[{value,label,disabled}]` (or `<option>` children) · `placeholder` |
| `Field` | Low-level wrapper: `children(controlProps)` receives `id`, `aria-describedby`, `aria-invalid` and `required` |
| `Card` / `CardHeader` | `padding` none/sm/md/lg · `interactive` · `accent` (flag stripe) · `as`. `CardHeader`: `title`, `description`, `actions` |
| `FlagBar` | The three-colour stripe, with a `height` prop |
| `Tabs` | `items=[{value,label,content?,icon?,count?,disabled?}]` · `value`/`onChange` or `defaultValue` · `variant` underline/pill · `size` · `fitted` · `label`. Arrow keys, Home and End. Leave out `content` to use it as a segmented control |
| `Modal` (alias `Dialog`) | `open` · `onClose` · `title` · `description` · `footer` · `size` sm/md/lg/xl · `dismissible` · `initialFocusRef`. Includes a portal, focus trap, Escape, focus restore and scroll lock. It becomes a bottom sheet on mobile |
| `ToastProvider` / `useToast` | Wrap the tree once. `toast({title, description, variant, duration, action})`, `toast.success/error/warning/info(title, opts)`, `toast.dismiss(id)` |
| `StatCard` | `label` · `value` · `delta` (%) · `deltaLabel` · `icon` (name or node) · `hint` · `loading` · `invertDelta` |
| `DataTable` | `columns=[{key, header, sortable, align, render, accessor, sortValue, width, hideOnMobile, className}]` · `rows` · `rowKey` · `defaultSort` · controlled `sort` + `onSortChange` for server-side sorting · `loading` · `empty={{icon,title,description,action}}` · `onRowClick` · `dense` · `caption` |
| `EmptyState` | `icon` · `title` · `description` · `action` · `compact` |
| `Skeleton` / `SkeletonText` | Size it with `className`, or use `circle`. `SkeletonText`: `lines` |
| `Avatar` | `name` (initials fallback, Ethiopic-safe) · `src` · `size` xs–xl · `status` live/online/offline |
| `Switch` | `checked` · `onChange(bool)` · `label` · `description` · `size` · `disabled` (uses `role="switch"`) |
| `CopyField` | `label` · `value` · `secret` (masked, with a Show/Hide toggle) · `hint` · `onCopy` |
| `Badge` | `variant` neutral/brand/success/warning/danger/info · `size` · `dot` · `pulse` |
| `Icon` | `name` (see `icons.jsx`) · `size` · `title` (makes it meaningful; it is decorative otherwise) |
| `Spinner`, `Logo` | Small helpers |
| Utilities | `cn(...classes)`, `focusRing`, `formatETB(n, {decimals})` |

## Layouts

Every layout renders `children` if you pass them, and an `<Outlet/>` otherwise, so it can serve as a parent route element.
Each one includes a skip link, language and theme toggles, and closes its mobile menu on navigation.

```jsx
// Public pages: top nav, mobile menu, footer
<Route element={<PublicLayout />}>
  <Route path="/" element={<Landing />} />
</Route>

// Streamer dashboard: collapsible sidebar (state persisted in localStorage "ui.sidebarCollapsed") and a mobile drawer
<Route
  path="/streamer/:uuid"
  element={<StreamerLayout basePath={`/streamer/${uuid}`} title="Dashboard" live user={{ name, subtitle }} badges={{ media: 3 }} onLogout={logout} />}
>
  <Route path="live" element={<LivePage />} />
  {/* donations · soundboard · media · overlay · analytics · payouts · settings */}
</Route>

// Admin console: the same chrome, with an "Admin" marker
<AdminLayout basePath="/admin" user={{ name: 'Ops' }} badges={{ moderation: 4 }} />
```

| Layout | Props |
|---|---|
| `PublicLayout` | `nav` (default `PUBLIC_NAV`) · `cta` (replaces the login/sign-up buttons) · `homeHref` · `loginHref` · `signupHref` · `supportHref` |
| `StreamerLayout` | `basePath` · `title` · `user {name, subtitle, avatarUrl, status}` · `live` · `badges {path: count}` · `headerActions` · `onLogout` · `items` (overrides `STREAMER_NAV`) |
| `AdminLayout` | `basePath` (default `/admin`) · `title` · `user` · `badges` (key `overview` for the index item) · `headerActions` · `onLogout` · `items` (overrides `ADMIN_NAV`) |

Nav items have the shape `{ to, icon, labelKey | label, end?, badge? }`. The default configurations are in `layouts/navConfig.js`.
