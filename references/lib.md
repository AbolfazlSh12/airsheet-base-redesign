# lib.ts: safe edits to one Airsheet base

Source: `scripts/lib.ts` of this skill. Copy it into `<work>/build/` together with a `project.json`:

```json
{ "base": "<baseId>", "owner": "<owner userId>", "frontend": "http://localhost:9003" }
```

Env vars override the file: `AIRSHEET_BASE`, `AIRSHEET_OWNER`, `AIRSHEET_BACKEND` (cloud-back checkout, default: the cwd), `CHANGES_LOG` (default `<work>/build/changes.log`). The owner id is the base's `creator` / owner collaborator; read it with a read-only Mongo query, never guess.

This library changes the base through the same GraphQL resolvers the UI calls. Each call runs as the configured owner. Before a resolver runs, the library checks the args against two things:

1. The argument list of the mutation in `typeDefs.ts`. Any key the UI could not send is refused.
2. The class-validator DTO middleware, the same one `server.ts` applies.

Model `.save()` and raw collection writes are not used anywhere.

## Running a script

```ts
// my_step.ts: put build scripts in the build dir, or anywhere, and import the lib by absolute path
import * as L from "<work>/build/lib";

L.run(async () => {
  const sup = L.byName(await L.listTables(), "<نام جدول>");
  const f = L.byName(await L.listFields(sup._id), "<نام فیلد>");
  await L.updateField(f._id, { description: "…" });
});
```

```bash
cd <cloud-back checkout>
DRY=1 npx tsx my_step.ts   # print the diff lines only; Mongo, Splunk and changes.log are not touched
npx tsx my_step.ts         # apply the change, append to changes.log, then wait SETTLE_MS (default 20000) before exiting
```

- **`L.run(fn)`**: connects Redis (the CLAUDE.md rule), then Mongo. It runs `fn` and waits `SETTLE_MS`, so the debounced `notify` effects (formula, links, joins, autonumber) finish before the process exits. Always wrap your script in it.
- **Environment variables**:
  - `DRY=1`: print only.
  - `AIRSHEET_BOOTSTRAP=1`: load without a base id, only to run `createBase` (`build-new-base.md`, B0).
  - `ALLOW_LIVE=1`: override the guards against SMS, email and API calls (see below).
  - `SETTLE_MS`: how long `run` waits before exiting.
- **Mutator signature**: every mutator takes an explicit id first, which is the target, or the parent for creates. It takes a `patch` second and optionally `{ force: true }` third. It returns the doc read back after saving, in parsed form.
- **Creates are idempotent by name** for tables, fields, views, roles and sides: an existing one is returned with `= kind «name» exists`. Pages, expand templates, automations, actions and user/record roles are not.
- **`countRecords(table)`**: live rows in a table (Splunk).
- **Unchanged patches**: a patch that changes nothing is skipped. It prints `= kind id unchanged` and writes nothing, unless `force` is set.
- **Log format**: each applied change appends one JSON line to `changes.log`: `{ts, kind, id, diff:{key:{from,to}}, created?, error?}`. `from` holds the whole previous value, so a line is enough to revert it. Values that look like secrets (`token`, `password`, `authorization`, …) are replaced with `***`. The log is written even when the resolver throws, and the line then carries `error`.
- **JSON-string fields** come back from the getters as objects: `content`, `layout`, `header`, `footer`, `layouts`, `filters`, `preferences`, `menu`, `options`, `conditions`, `actions`, `default`, `colors`, `rollupFilter`, `linkViewRules`, `kanbanSettings`, `theme`, `conditionalColors`, `fieldColors`, `summaryFields`, `statsFields`, `fields`. So do the elements of `sorts`, `groups`, `constraints` and `limits`. Mutators accept either an object or a string and store a string. Diffs compare the parsed values, so formatting differences alone never cause a write.
- **Base scoping**: every mutator first loads its target with `{_id, base: BASE}` and throws if the target is in another base. This matters because several resolvers do not scope by base (`uside`, `uaction`, `uautomation`, `uview`, `dview`, `uexpandtemplate`). Role, side, page, field and table ids passed in arrays are also checked to exist in this base, and roles are also checked to be unblocked.

## Entities

| Entity | Functions | Resolver path | Side effects, and what the lib does about them |
|---|---|---|---|
| Base | `getBase()`, `updateBase(BASE, patch)`, `createBase(name, requirementDescription)` (new base) | `ubase` (iowner, `findOneAndUpdate`); `cbase` | `createBase` needs `AIRSHEET_BOOTSTRAP=1` and `ALLOW_LIVE=1` (`cbase` POSTs the owner to `sales.uba.inputUrl` and may add a lead row to `sales.uba.newUsersTable`), refuses when `project.json` already names a base, and writes the new id there. `cbase` checks the owner's plan limit and also creates the owner collaborator, a default collaborator side «تیم» and one page. No hash. A `preferences` object is **shallow-merged** into the current preferences. `ubase` replaces the whole string, so pass only the keys you change. The lib refuses `tokens`, `scripts`, `acl`, `creator`, `roles`, `isTemplate`, `baleToken`, `rate` and `tags`. `getBase` hides `tokens` and `scripts`. |
| Table | `getTable`, `listTables`, `updateTable(id, patch)`, `createTable(name)`, `deleteTable(id)` | `utable` (iowner, `Object.assign`, `save`); `ctable`; `dtable` | `ctable` also creates a Grid view and a text primary field «نام». `deleteTable` refuses a table with records or linked from another table. | The pre-save hook recomputes `integrityHash` from `canview`, `canadd`, `candelete`, `canviewfields` and `caneditfields`. `canviewfields` and `caneditfields` are only the **defaults for fields created later**. `layout` is the default record-expand layout for **collaborator** sides. |
| Constraint | `upsertConstraint(tableId, obj)` | `createConstraint` / `updateConstraint` (field ids validated, `table.save`) | These resolvers have no iowner check, so the lib's base check is the only guard. A constraint without an `id` is created and the server assigns a uuid. A constraint with an `id` is merged into the existing one. |
| Field | `getField`, `listFields(table)`, `createField(table, spec)`, `updateField(id, patch)` | `cfield` / `ufield` (iowner, `save`) | See the field notes below the table. |
| View | `getView`, `listViews(table)`, `createView(table, {type,name,subtype,...rest})`, `updateView(id, patch)` | `cview` (iowner), then `uview` (**icollaborator only**, `lodash.extend`, `save`) | No hash or hooks. `cview` takes only type, name and subtype, so `createView` sends everything else in a second `uview` call. For Form views, `layout` is an array of blocks. Each block holds `inputs:[{id,name,description,required,invisible,conditions}]`. Gallery views use `galleryFields`, `layout` and `theme`. Kanban views use `kanbanSettings`. Sharing uses `publicShare`. |
| Role | `listRoles`, `createRole(name, description)` | `crole` (returns the id in `message`) | Permissions are set on tables and fields, not on the role. |
| Side | `getSide`, `listSides`, `updateSide(id, patch)`, `createSide({name,type,...})` | `cside` (iowner, also creates one empty page); `uside` (iowner, `findOneAndUpdate` **upsert by `_id` only**) | The lib checks that the side exists in the base first, so a wrong id cannot upsert a new side. The menu lives in `header.menuItems[]` as `{id,title,side,linktype:"page",path:<pageId>,children}`. `pagesOrder` is checked to contain only this side's pages. Roles are checked. Access is controlled by `roles` on collaborator sides and by `userRole`, `accreditView` and `accreditForm` on user sides. |
| Page | `getPage`, `listPages(side)`, `createPage(side, {name,content,...}, {publish=true})`, `updatePage(id, patch)`, `setPagePublished(id, bool)`, `deletePage(id)` | `cpage` / `upage` / `publishPage` / `dpage`, plus `uside` | See the page notes below the table. |
| Expand template | `getExpand`, `listExpands(table)`, `createExpand(table, {name,sides,layout,description})`, `updateExpand(id, patch)`, `reorderExpands(table, ids)` | `cexpandtemplate` / `uexpandtemplate` (always sent with `template:id`) / `reorderExpandTemplates` | See the expand-template notes below the table. |
| Automation | `getAutomation` (includes `actions`), `listAutomations`, `createAutomation({name,category,...})`, `updateAutomation(id, patch)`, `deleteAutomation(id)` (refuses an active one; `dautomation` also deletes its actions and Bull jobs — take the `snapshots-private` backup first) | `cautomation` (owner) / `uautomation` (**no base auth**) | See the automation notes below the table. |
| Action | `getAction`, `createAction(automationId, spec)`, `updateAction(id, patch)` | `caction` + `uaction` (**upsert by `_id`, no base auth**) | The lib checks that the action exists and that its automation belongs to this base. On an active automation, switching an action to an external type needs `ALLOW_LIVE=1`. Internal action types are `createRecord`, `updateRecord` and `deleteRecord`. Everything else calls out: sms, email, int-api-request, notification, SAP, ai, basalam. |
| User role | `getUserRole`, `listUserRoles`, `createUserRole(spec)`, `updateUserRole(id, patch)` | `cuserrole` / `uuserrole` | No hash. The fields are `accreditView`, `accreditField`, `usernameField`, `userProperty` (`mobile`, `national ID` or `email`) and `accreditForm`. |
| Record role | `getRecordRole`, `listRecordRoles`, `createRecordRole(table, spec)`, `updateRecordRole(id, patch)` | `crecordrole` / `urecordrole` (iowner, `save`) | `canedit` holds **field** ids and `canadd` holds **table** ids. Both are checked to be in this base. |
| Uploads | `uploadFile(path, mimetype, {sideId?, tableId?, recordId?})` | `uploadBase64` (what the `upload` mutation runs) | Returns the storage key `<baseId>/<uuid>/<file>` that IMAGE, MENU, GALLERYMENU, STATS, covers and logos need. Page `background` and SECTION `backgroundImage` need the full URL `<S3 host>/cloud-uploads/<key>` (server-bound; prefer a transparent SVG data URI). An attachment value (gallery cover) is built from the key: `[{id: randomUUID(), key, url: key, mimetype, filename, size, fileSize: size, preview: true, type: "<ext>", thumbnails: {large: {url: key}}}]` (the thumbnail key equals the file key for `image/*`), with `thumbnails` an object, not a string (platform-lessons.md, Uploads). Logged to `changes.log` as `kind:"upload"`. There is no delete API: uploaded files stay in S3. Keep the keys in `<work>/design/assets/keys.json` and never upload the same file twice. |
| Records | `listRecords(table, spl?)`, `getRecord(table, id)`, `createRecord(viewId, init)`, `updateRecord(table, id, values)`, `bulkUpsert(table, rows)`, `importRows(table, rows)`, `deleteRecords(table, ids)` | `crecord` / `updateCell` / `urecords` / `drecords` | See the record notes below the table. |

**Fields.** The pre-save hook recomputes `integrityHash` from `canview` and `canedit`. It also rejects duplicate select options.

After the save, `ufield` does four things:

- It renames `inputs[].name` in the table's Form layouts when the field's name changes.
- It fires `notify(table,[field],…,"design")`, which recomputes every formula in that table and rewrites any record whose value changes. It also re-runs joins and linkify for this field.
- It mirrors `possibleValues`, `format`, `colors` and similar settings into lookups of this field.
- When `possibleValuesChanges` is passed, it rewrites records and view filters to match the renamed or removed options.

Two limits apply:

- `updateField` refuses `type` changes, except with `{allowTypeChangeOnEmptyTable: true}` on a table with no records (while building a new base).
- For lookup and rollup fields, `updateField` always sends `rollupField`. Without it, `ufield` saves the change and then throws, which leaves the change applied and never fires `notify`.

A new field inherits `canview` and `canedit` from the table's `canviewfields` and `caneditfields`. Set them explicitly afterwards.

**Pages.** `cpage` always creates a **draft**, does not take a name, and does not add the page to the side. `createPage` makes four calls in order:

1. `cpage`.
2. `upage {name}`.
3. `publishPage`.
4. `uside {pagesOrder: [...old, new]}`.

Menu entries are not added. Add them with `updateSide(header)`.

`upage` only applies **truthy** args, so `updatePage` refuses `""` and `null`. It also cannot move a page to another side.

`deletePage` also removes the page from `pagesOrder` and from `header.menuItems`, including children.

**Expand templates.** Two rules keep `uexpandtemplate` from doing something unintended:

- The lib always sends `template:id`. If `template` is missing, `uexpandtemplate` creates a template named "قالب جدید", or writes `table.layout` for collaborator sides.
- The lib refuses `sideId`. With `sideId`, `uexpandtemplate` appends the side before its auth check.

Setting `defaultSides` removes those sides from the `defaultSides` of **every other template of the same table**.

**Automations.** `updateAutomation` with `fields`/`table` goes through `requireIdsInBase`, which crashes from the editor on
develop 2026-10 (import-order bug, code-changes.md) but works from the lib. `cautomation` also creates **one empty action**. Fill it with `updateAction(auto.actions[0]._id, …)` instead of adding a second one.

The pre-save hook has two effects:

- If `conditions` changed, it **overwrites `fields`** with the condition fields. The lib refuses a patch that sets both.
- If `cron` changed, it re-registers the Bull repeatable job with tz Asia/Tehran. That job is in Redis, and only the dev server processes it.

Types are `match`, `create`, `form` (forms = view ids), `update` (fields or allFields plus an optional `view` filter), `delete`, `cron` and `period`.

**Schedules.** Write only a `cronType`/`cron` pair that the editor itself writes. The lib refuses anything else (`scripts/editorSchedule.ts`). An invented value such as `cronType: "custom"` shows raw in «نوع بازه زمانی», and the user cannot set it back after switching the type, because the switch overwrites the cron.

| need | cronType | cron |
|---|---|---|
| every N hours, optionally only from A to B | `hourly` | `M */N * * *` / `M A-B/N * * *` |
| several times a day at evenly spaced hours (7 and 13) | `hourly` | `M 7-13/6 * * *` |
| every day at H:M | `weekly` | `M H * * *` («هر روز») |
| one weekday | `weekly` | `M H * * D` (D 0–6, Saturday = 6) |
| a Jalali day of the month | `jalaliMonthly` | `M H d * *` |

`daily`, `custom`, `monthly` (Gregorian, only kept on old automations) and `minutely` (reminder preset, not on develop) are rejected. Uneven hour lists, several weekdays and minute steps have no editor form. Split them into separate automations, or report the missing editor capability; do not write a raw cron.

The lib refuses `active:true` while any action is external, unless `ALLOW_LIVE=1`. It also refuses `active` in `createAutomation`.

**Records.** Every call is scoped to this base and table.

`crecord`, `updateCell` and `drecords` run the **full write path**, inline, in your process:

- `databaseLock` (only `updateCell` takes it, because it updates a record that already has an id; `crecord` and `drecords` do not)
- invariants
- constraints and field limits
- active automations
- webhooks
- assignee notifications
- plugins
- `notify` and pubsub

Because of that, these three are blocked unless `ALLOW_LIVE=1` when the table has any of the following:

- an active non-cron automation with external actions
- any hook or plugin in the base
- a collaborator field with notify or taskField

`importRows` (migration) creates rows under the ids they had in the source base, skips ids that already exist (so a re-run imports only what is missing), at most 500 rows of one table per call; like `bulkUpsert` it goes through `urecords`.

`urecords` (`bulkUpsert`, `importRows`) is **silent**. It checks constraints and limits but skips invariants, automations, hooks and assignee notifications, and it still runs `notify`. Use it for reference data. New rows get a client-generated uuid, so `changes.log` lists the created ids for undo.

`deleteRecords` checks every id first, because `drecords` crashes on an unknown id.

`updateRecord` has two modes. With one key it sends `modifiedfield`, which matches a UI cell edit. With several keys it does a single multi-field `mutate`. Link values must use `[{_id, primaryFieldValue}]`.

`getRecord` reads through `appendb.read`, which uses the Redis `record:` cache first. The cache handles read-after-write, while Splunk search results lag by about a second.

## Demo data helpers

`exportRecords`, `checksum`, `serverChecksum`, `seedRows`, `restoreRaw`, `tombstoneRaw` — see `demo-data.md`. They read
`mock-manifest.json` and `mock-idmap.json` next to the lib and `keepLinkTables` (table ids mock rows may link to although
they are real, e.g. a kept catalogue) from `project.json`. Mock rows that are link targets must have uuid ids (map them
from readable names in `mock-idmap.json`); `seedRows`/`tombstoneRaw` accept `MOCK-` ids and ids in that map only.

## Guards that stop a script from touching real providers or other bases

- **Bull**: `lib.ts` replaces `Bull.Queue.prototype.process` with a no-op before any app module loads. `appendb.js` imports the automation resolvers, whose `myQueue.process(...)` would otherwise make every script a worker on the `Automation` queue. That queue holds cron jobs from **every base**, and 74 of them are active. To verify, count the Automation workers: 5 before and 5 after with the lib loaded, versus 5 → 6 when the automation resolvers are imported without it (`tests/t_worker.ts`). Scripts still **enqueue**, for example cron jobs, and only the server consumes them.
- **`ALLOW_LIVE=1`** is the only way to activate or extend automations with sms, email or api actions, or to write records to a table that would fire them. Use it only when the base's SMS, email and API settings point at test providers.
- The Splunk audit log (`LogFactory.writeAPILog`) is **not** written. That log comes from an Apollo plugin, and a short script would never flush its batch anyway. `changes.log` is the audit trail.

## What was verified (on a previous project)

- A read-only test exercised every getter, confirmed JSON fields are parsed and `getBase` hides tokens, and pushed sample args for 14 mutations through `validate()` (stub resolver, writes nothing).
- Each guard rejected bad input: an arg outside the schema, a non-string DTO field, a page id from another base, a field type change, a falsy `upage` value, an unknown role, activating an automation with api actions, `conditions` and `fields` together, and `sideId` on an expand template. A no-op patch was skipped.
- `DRY=1` left Mongo and `changes.log` byte-identical. Forced no-op round-trips through `upage`, `uview` and `ufield` returned success with docs byte-identical apart from `updatedAt`/`integrityHash`/`__v`.
- Re-run the read-only part on every new project before the first write: `DRY=1 npx tsx <work>/build/t_read.ts` with `listTables()`, `listSides()`, `getBase()`.

## Pitfalls

- **Integrity hashes**: never write `tables`, `fields`, `roles`, `collaborators` or `users` with raw updates. `isValidIntegrity()` fails on the next read, and it then **sets `isBlocked=true` on every role listed** in the doc. That silently revokes access base-wide.
- **Dump values are redacted**: `data/dump_*.json` is a read-only summary with names instead of ids, and values that look like secrets are replaced with `***`. For example, `preferences.enforcePassword` appears as `***`. Never write values copied from it. Read current values with the getters.
- **Page block ids**: page and expand block `id`s must be unique uuids. OTP-protected sections are keyed by block id. When you copy blocks, give them new `randomUUID()`s.
- **Portal visibility**: a view is visible to portal (user or visitor side) users only if it appears in one of these:
  - a **published** page of that side
  - an expand template whose `sides` include that side
  - `table.layout` (collaborator sides only)
  - a ShareView
  - a link field's `linkView` or `linkForms`

  A draft page grants nothing.
- **Splunk lag**: `listRecords` runs a Splunk search, which is eventually consistent. Right after a bulk write, allow about 1 s, which `bulkUpsert` already polls for. `getRecord` is cache-first.
- **Session expiry**: while a script runs, `tools/cache.ts` also handles Redis session-expiry events. The dev server handles them too, so the duplicate is harmless.

- **Two create mutations reject arguments their update twins accept** (2026-10-16): `cfield` has no `canview`/`canedit` and `cexpandtemplate` has no `defaultSides`; the GraphQL validation throws «args not in GraphQL schema» and a `field.create` / `expand.create` line with `error` lands in `changes.log`. `createField` and `createExpand` now split those keys off and write them with `ufield` / `uexpandtemplate` right after creation.
