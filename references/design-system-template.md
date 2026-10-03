# Design-system template

Copy to `<work>/design/SYSTEM.md` during the design package and fill every «…». It is the contract for every page,
expand template and view display in the new base. A complete filled example, with component snippets checked against
the live renderer, is `examples/design-system-example.md`: copy snippets and shells from there, never its brand values.
`design-guide.md` explains what the page builder can and cannot do.

```markdown
# Design system — «base name»

## Corrections after customer review (override everything below; dated)
- «date — what the customer asked — what changed — which pages»

## 0. Direction
«One paragraph: the feel (calm workspace, public-facing site, dense back office…), the one accent, where the brand shows
(logo in headers, hero, footer) and where it does not.»
Principles: «3–6 rules, each fixing something visible, e.g. "no list without a heading", "one primary action per page"».

## 1. Theme setup
| Object | Setting | Value | Why |
|---|---|---|---|
| base | `preferences.palette` | «palette closest to the brand hue» | |
| base | `logo` | «uploaded key» | |
| side «name» | type / `layoutType` / header name / logo / background | «…» | |

## 2. Colour
- Tokens only (`var(--blueN)`, `hsl(var(--p))`, daisyUI names); raw hex only for the fixed brand colours below.
- Fixed brand colours: «hex, measured from the customer's own logo file, not guessed from a screenshot».
- Status map — one meaning, one colour, on every table:

| Field | Option | Token |
|---|---|---|
| «status field» | «draft / waiting / approved / rejected / done» | «gray / yellow / green / red / blue» |

- Every select option has a colour (categorical fields: the default cycle).

## 3. Typography
«Heading sizes per level, body size, numbers with tabular figures; the font the base already loads.»

## 4. Space, shape, elevation
«Page max width per shell, section spacing, radius scale (inner tighter than outer), when a card has a shadow.»

## 5. Icons
| Concept | Lucide icon | Colour token |
|---|---|---|
| «business concept of this base» | «IconName» | «token» |

## 6. Assets
| File | Size | Used in |
|---|---|---|
| «logo-horizontal-light.png» | «w×h, transparent» | «side headers» |

## 7. Filters used by components
«The user-scope filter of each portal (copy exactly), KPI filters per audience.»

## 8. Components
«Pick from the example §8 (hero, page header, section header, KPI strip, quick actions, callouts, empty state, list
block, detail header, stepper, form container, header/footer JSON, tabs, result card, info card, explainer) and record
any change.»

## 9. Page shells
| Shell | Used for | Blocks in order |
|---|---|---|
| «landing / list / detail / form / dashboard» | «pages» | «…» |

## 10. Anti-bug checklist
Use the example's §10 as is, plus any project-specific item.
```

## Filling it

- **Brand**: measure colours from the customer's own logo file (SVG or the image inside their documents), never from a
  compressed screenshot. If there is no brand, use one calm accent and say so.
- **Status map**: one row per status field in the data model; the same option means the same colour everywhere.
- **Page shells**: every page in the design package names its shell. A page that fits no shell is a design smell.
- **Corrections** go at the top and win over the rest; never edit an old section silently.
