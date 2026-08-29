# YesDrop UI kit: how to build with it

React + Tailwind v4 primitives (shadcn-style, built on Base UI). Import components from the
bundle global; style your own layout with the Tailwind token utilities below.

## Setup

- **No provider is required**. The primitives read their colors from CSS custom properties defined
  at `:root` in the shipped stylesheet. Just render the component.
- **Dark mode**: put `class="dark"` on any ancestor element to switch every token to its dark value
  (the tokens are defined under both `:root` and `.dark`). Default is light.
- Fonts ship via the stylesheet: body text defaults to **IBM Plex Sans** (no class needed). Use
  the `font-heading` utility for titles (Outfit) and `font-mono` for monospace (Geist Mono).

## Styling idiom: Tailwind utilities bound to semantic tokens

Style layout and surfaces with these token utilities (never hardcode hex; use the tokens so light
and dark both work). Each has `bg-*`, `text-*`, `border-*`, and `ring-*` forms:

| Token | Use |
|---|---|
| `background` / `foreground` | page surface + default text (`bg-background`, `text-foreground`) |
| `card` / `card-foreground` | raised surface (cards, dialogs) |
| `popover` / `popover-foreground` | overlays, menus |
| `primary` / `primary-foreground` | brand action (primary buttons, active) |
| `secondary` / `secondary-foreground` | secondary action / neutral fill |
| `muted` / `muted-foreground` | subtle backgrounds + secondary text |
| `destructive` | errors, delete actions (often `bg-destructive/10 text-destructive`) |
| `border` / `input` / `ring` | borders, field borders, focus rings |
| `accent` / `accent-foreground` | hover/active accents |

Opacity modifiers are idiomatic (`bg-primary/80`, `ring-ring/50`, `bg-destructive/10`). Radius:
`rounded-lg` (controls), `rounded-xl` (cards/dialogs). Spacing/layout: standard Tailwind
(`flex`, `grid`, `gap-*`, `px-*`).

## Component API idiom: variant/size props, compound parts

- **Button** `variant`: `default` | `outline` | `secondary` | `ghost` | `destructive` | `link`;
  `size`: `xs` | `sm` | `default` | `lg` | `icon` | `icon-xs` | `icon-sm` | `icon-lg`.
- **Badge** `variant`: `default` | `secondary` | `destructive` | `outline` | `ghost` | `link`.
- **Card** is compound: `Card` + `CardHeader` / `CardTitle` / `CardDescription` / `CardAction` /
  `CardContent` / `CardFooter`. **Dialog** and **AlertDialog** likewise (`DialogContent`,
  `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogTrigger`; the
  `AlertDialog*` set plus `AlertDialogAction` / `AlertDialogCancel`). Compose the parts; don't
  hand-roll the markup.
- **Input**, **Textarea**, **Label**, **Calendar** are single components. Inputs take native props;
  add `aria-invalid` for the error state. `Label` pairs with a control via `htmlFor`.

## Where the truth lives

Read the shipped `styles.css` (and its `@import`ed token/`_ds_bundle.css` closure) for the exact
token values, and each component's `<Name>.d.ts` (props) + `<Name>.prompt.md` (usage) before
composing it.

## Idiomatic example

```tsx
<Card className="w-80">
  <CardHeader>
    <CardTitle>Q3 marketing budget</CardTitle>
    <CardDescription>Requested sign-off from cfo@acme.com</CardDescription>
    <CardAction><Badge variant="secondary">Pending</Badge></CardAction>
  </CardHeader>
  <CardContent className="text-muted-foreground">
    Requesting approval on the Q3 marketing spend. Respond by Friday.
  </CardContent>
  <CardFooter className="justify-end gap-2">
    <Button variant="outline" size="sm">Reject</Button>
    <Button size="sm">Approve</Button>
  </CardFooter>
</Card>
```
