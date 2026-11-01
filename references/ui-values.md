# Values the UI writes (non-negotiable 18)

Every value a build writes must be one an Airsheet editor itself writes for that setting, in the same format. Otherwise
the owner opens the setting and sees a blank select, a control that does nothing, or no control at all. The value then
stays stuck, and some of them quietly change behaviour.

## Why this is a rule

On 2026-11-01 (kindergarten base `6adf8c9a…`) the receptionist and the owner opened «ثبت ورود» and the child picker was
empty. The picker was set by a link-view rule on `[role]`. The rule editor never offers `[role]`, and the client
evaluates the rule without the viewer, so it was always false and everyone got the coach-only view.

A sweep of the whole build then found two dozen more kinds of value no editor writes. An earlier base built with this skill had
the same class of bug in several places.

## How to check a value before writing it

1. Find the component that edits the setting in `cloud-front/src`:
   - `FieldMenu.vue`
   - `ViewSettings*` and `ViewSettingMenu.vue`
   - `ViewAppContext.vue`
   - the block under `notion/blocks/`
   - `TableConstraints.vue` / `FilterItem.vue`
   - `SideHeader*` / `SidebarMenuSetting.vue`
   - the action under `automations/`
2. Use one of the option values it offers, in the type it emits:
   - `AirInput` with `max` emits a number; without `max` it emits a string.
   - JSON-string keys stay JSON strings; `lib.ts` `enc()` handles the usual ones.
3. If the editor no longer has the control, don't write the key. Check with `git log -S'<key>' -- src`: a removed
   control can still be read by the views.
4. If the need can't be expressed with the editor's options, rewrite it in a form the UI can express, or report the
   missing capability. Never invent a value.

After every build round, run `scripts/ui-values-lint.ts`. It must report `0 values the UI does not write`.

## Values found and what to write instead

| Where | Written | Write instead |
|---|---|---|
| link field `linkViewRules[].conditions` | `[role] has any of …` | No UI form. Use a single picker view (`linkView`, rules `[]`), or report the gap. `[role]` is valid only in TABS `userFilterTab` and side-menu `userFilter`, whose editors pass `userFilters`. |
| table constraint, link field | `is` + `table:true` | `dynamic`, `operandType:"field"`, `table:false` |
| table constraint, date | `is` + `relativeDate:null` | `is` + `relativeDate:"dynamic"`, `table:false` |
| table constraint, text / mobile | `is` + `table:true` | `is` + `table:false`, plus a literal `is not empty` on the same field so empty values never collide (`table:true` used to do this) |
| record role `userProperty` | `"mobile"` | `""` (the select's mobile option) |
| role / user-role `description` | more than 31 characters | 31 characters at most (`maxlength`) |
| view `sorts[]` | `{field, order:"asc"}` | `{field, direction:"AZ"/"ZA"}`. A missing direction sorts **descending**. |
| view `groups[]` | `direction:"ZA"`, `collapse:true` | `direction:"AZ"`, `collapse:false`. The group editor writes nothing else; the open state is `expandGroups`. |
| Intelligence `layout[]` | no `filter`, `legend:false` | `filter: []` (otherwise its filter menu crashes), `legend: true` |
| form `inputs[]` | `recordsSelect`, `recordsMultiple`, `recordsForm:""` | Leave them out. Their editors were removed in 4fc6bad3b. |
| form `layout[0]` | `logo:""`, `splitBy:""` | `logo:null`; leave `splitBy` out |
| form `layout[0].defaultValues` | a value on a lookup / formula / rollup / count / auto field | Nothing. The form cell is read-only (`DataCell.vue`), so the owner can neither change nor remove it. It also appears when someone changes a field's type after the build wrote its default: re-run the lint after the customer edits fields. |
| table layout VIEW block | `filterInField` = a deleted field | Repoint it to an existing link field, or remove the block |
| page / template VIEW block | `viewFilterbar` | Leave it out. The control was removed in 54b11ed33 and the views still read it. |
| page / template VIEW block | `export:true` | `downloadList:true` (`export` was removed in 54b11ed33) |
| page VIEW block | `filterType:"none"` | Leave it out. The options are `in` / `out` / `join`. |
| template VIEW block (unfiltered list) | `filterType:"none"` | `showAll:true`, plus the `filterType`/`filterInField` the owner mount would pick. Leaving it unset autosaves on the first open. |
| MENU block item | `var(--slate)`, `var(--slate4)` | A dialog colour: `var(--<blue…gray>)`, `var(--<hue>2)`, and levels 3/4 for text. `--slate` is undefined. |
| SECTION | `padding:"18"` | `18` (number) |
| SECTION in templates | `radius:16` | `"16"` (string) |
| page `background.value`, SECTION `backgroundImage` | `data:image/svg+xml,…` | An uploaded file URL `${S3}/${bucket_prefix}uploads/<key>`: `scripts/upload-backgrounds.ts`. `visual-kit` reuses the upload once it exists. |
| website-layout side `menuItems[]` | `icon`, `iconColor` | Leave them out. Only the sidebar layout has the editor. |
| sidebar-layout side `menuItems[].iconColor` | `orange`, `slate`, … | A picker value: `<hue>3` / `<hue>4` / `#000000` / `#ffffff` |
| updateRecord action `options` | `maxRecords` | Leave it out (no editor; the engine default is 10000) |
| updateRecord `matchFields[]` | `label` | `{value, text, type, config}` only |
| action token | `{time:today+4d}` | A token-menu preset: now, today, clock, today±1d, now+1h, today+7d, today\|jalali, today\|gregorian, epoch. Otherwise ask the owner. |
| automation `cronType` | anything else | `jalaliMonthly`, `monthly`, `weekly`, `hourly` (ScheduleTrigger.vue) |

Images inside TEXT HTML (`<img src="data:…">`) are fine. The text editor keeps pasted images inline and round-trips them.
