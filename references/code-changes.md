# Platform code changes (only when the user explicitly asks)

The redesign itself is configuration. When a customer need cannot be met by configuration (SRM round 3: file names of
attachments from an API, a date range for scheduled automations), the user may ask for a code change in
`cloud-back` / `cloud-front`. Each repo's own `CLAUDE.md` rules apply on top of this file; read them first.

## Branches and worktrees

- One concern per branch, each from a freshly fetched `origin/develop` (`git fetch origin develop` works from this
  workstation even where a CLAUDE.md says the host is unreachable; try it). Names without slashes.
- Work in a **worktree next to the checkouts**, never by switching branches in the checkout the dev server runs:
  `git worktree add -b <branch> ../wt-<name> origin/develop`, then `git branch --unset-upstream` (otherwise the branch
  tracks develop and a plain `git push` targets it), then `git submodule update --init` for `cloud-back/src/secret`.
- `node_modules`: when `package-lock.json` is identical to the main checkout's, symlink it for quick runs
  (`ln -s ../cloud-back/node_modules node_modules`); never commit the symlink, remove it at the end.
- A GraphQL change is two commits in two repos (typeDefs + the gql document in `cloud-front/src/api/`). A Mongoose
  schema change needs the user's approval per the repo rule: say so explicitly even for additive optional fields.
- Commit locally, give the user one push command per branch, never push or merge yourself.

## Proving it the way CI does

- Unit/integration tests: drive the real entry point (e.g. `callApi` for a REST action, the resolver for a mutation,
  the queue processor captured with `jest.spyOn(Queue.prototype, "process")` before importing the resolvers).
- **Negative control:** revert only the implementation, run the new tests, see them fail, restore.
- CI-identical run: `git archive HEAD` plus `src/secret`'s own `git archive` into a scratch dir, then the
  `mr:jest-test` script from `.gitlab-ci.yml` in `<ci-node-image>` (reuse `npm_config_cache` and
  `MONGOMS_DOWNLOAD_DIR` dirs; `~/.cache/mongodb-binaries` holds the mongod binary). Known flake:
  `test/effects/removeRelFanout.test.ts` — re-run it alone and report both runs.
- Lint needs Node 24 (`--flag unstable_native_nodejs_ts_config`): run `npx eslint` on the changed files inside the same
  container; the repo has pre-existing errors, so compare against develop's version of the same file.
- Resolver bugs that involve Apollo: reproduce through `new ApolloServer({ schema }).executeOperation(...)`, not
  `graphql()`. Apollo's `whenResultIsFinished` calls `.then` on every field result once to time it, then hands the same
  object to graphql-js, which calls `.then` again: a resolver returning a raw Mongoose `Query` (no `await`, no
  `.exec()`) executes twice and Mongoose 8 throws «Query was already executed». `graphql()` alone does not show it.

## Seeing a UI change work without touching the shared server

The dev servers on :3000/:9003 run the main checkouts against the shared test DB; a second backend on the shared
Redis would pick up other bases' automation jobs. Use a throwaway stack instead (SRM round 3, ~10 min to set up):

1. Mongo: the cached binary `~/.cache/mongodb-binaries/mongod-x64-ubuntu-*` (a file, not a dir) with
   `--dbpath <scratch>/db --port 27030 --bind_ip 0.0.0.0`.
2. Redis: `docker network create airtest`, `docker run -d --rm --name airtest-redis --network airtest
   --network-alias redis redis:7-alpine` — some module connects to the host name `redis` whatever `REDIS_HOST` says.
3. Backend: the backend port is hard-coded to 3000, so run the branch's `git archive` copy (after `npm ci` in the CI
   image) in its own container: `docker run -d --name airtest-back --network airtest --add-host
   host.docker.internal:host-gateway -p 127.0.0.1:3001:3000 -e NODE_ENV=development -e
   MONGO_URL=mongodb://host.docker.internal:27030/airtest -e REDIS_HOST=redis … ./node_modules/.bin/tsx src/server.ts`.
4. Seed with a tsx script in the same image: a `User`, `Base`, owner `Collaborator`, `Table`, the object under test,
   a session key `session:<userId>:<uuid>` whose value is **JSON-encoded twice** (`cache.get` parses once and
   `validateSessionToken` parses again), and `jwt.sign({ _id, session }, constants.JWT_SECRET)`.
5. Frontend: `npx quasar dev --port 9004` in the branch worktree. Browse via `http://127.0.0.1:9004` (not
   `localhost`: only then `getEnv` reads `window.configs`) with a Playwright `addInitScript` that sets
   `window.configs = { VUE_APP_API: "http://127.0.0.1:3001/graphql", VUE_APP_WSAPI: "ws://127.0.0.1:3001/ws", … }`
   and `localStorage.token`. Capture the mutation variables and responses from `page.on("response")`.
6. The dev server rewrites `src/components/Widgets/widget.json` with an absolute path: `git checkout` it, never commit it.
7. Tear down by port owner PID (`ss -ltnp | grep :9004`), `docker rm -f`, `docker network rm`. Do **not** use
   `pkill -f <pattern>`: it matches the shell running the command and kills it.

## Traps found in cloud-back (2026-10)

- `requireIdsInBase` in `automation/resolvers/index.ts` builds `BASE_SCOPED_ID_ARGS` (`[["table", Table], …]`) at import
  time; under the server's import order a model is still undefined, so every editor save that sends `table` fails with
  «Cannot read properties of undefined (reading 'countDocuments')». The lib's import order is unaffected. A fix task was
  filed; check whether develop has it before blaming the base.
- REST API attachments: fixed in develop (`restApiAttachments.ts`); the file name now comes from the value.
