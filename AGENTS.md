# AGENTS.md

## What this is
A small static single-page site (Brazilian Portuguese, GTA/"Dev City" themed character picker) built on HTML5 Boilerplate. No framework, no app server, no tests. There is no README — source and config files are the only source of truth.

## Commands
- `npm install` — no lockfile is committed, so versions float within the `^` ranges in `package.json`.
- `npm start` — webpack dev server with HMR and auto-open; serves the repo root (`static: ['./']`) statically. Use for local dev.
- `npm run build` — production bundle into `dist/`. `output.clean: true` wipes `dist/` every build.
- `npm run dev:worker` — Cloudflare Wrangler local tunnel for `worker/index.js` (needs `npx wrangler login` once).
- `npm run deploy:worker` — deploys the Worker via `worker/wrangler.toml`; copy the printed `workers.dev` URL into `WORKER_URL` in `js/app.js`.
- `npm test` — placeholder that always exits 1. There is no test suite, linter, formatter, typecheck, codegen, pre-commit hook, or CI — don't waste time looking for them.

## Wiring gotchas (easy to get wrong)
- Webpack entry is `js/app.js`: it imports `js/scripts.js`, where `escolherPersonagem()` lives. Edit `app.js` for button wiring/upload/Worker fetch; edit `scripts.js` only for the name/image/color swap. `app.js` binds it to `selecionarPersonagem` because both files share the global scope when served without webpack.
- `index.html` loads two classic scripts in order — `js/scripts.js` then `js/app.js` — and no CDN scripts. This makes the page work both via Live Server on the repo root (no bundler, no `require`, no `module`) and via `npm start`/`npm run build`. `scripts.js` exports via `module.exports` for webpack and via `window.escolherPersonagem` for Live Server; `app.js` picks whichever is available. `HtmlWebpackPlugin` uses `inject: false` so prod does not inject a third tag, and `CopyPlugin` copies the raw `js/scripts.js` into `dist/`. The old broken `js/script.js` (singular) reference is gone.
- The "selfie → AI legend" flow calls a Cloudflare Worker (`worker/index.js`, deployed with `npm run deploy:worker`) that runs `@cf/black-forest-labs/flux-2-klein-4b` via Workers AI. `WORKER_URL` in `js/app.js` is already set to the deployed URL `https://devcity-gerador-lenda.devcity-cirleno.workers.dev` (the `workers.dev` subdomain is `devcity-cirleno` and was registered once via the Cloudflare API). The Worker holds the prompt and returns raw JPEG bytes; the front-end only resizes the selfie to at most 511x511 and posts it as `foto`.
- Dev and prod configs are asymmetric: only `webpack.config.prod.js` uses `HtmlWebpackPlugin` (generates `dist/index.html` from `index.html`) and `CopyPlugin` (copies `img/`, `css/`, `js/vendor/`, `js/scripts.js`, `icon.svg`, `favicon.ico`, `icon.png`, `robots.txt`, `404.html`, `site.webmanifest` into `dist/`). The dev config has neither and just serves source files. Verify changes with both `npm start` and `npm run build`.
- `js/vendor/` and `img/` keep `.gitkeep` files so they stay tracked; preserve them so the CopyPlugin patterns have a source directory.

## Conventions
- User-facing text, comments, and identifiers are in Brazilian Portuguese — keep new code consistent.
- `.editorconfig`: UTF-8, LF, 2-space indent, final newline, trim trailing whitespace. `.gitattributes` enforces LF for text files (only `*.bat` is CRLF); images/icons are binary.
- `css/style.css` starts with HTML5 Boilerplate / main.css boilerplate; project styles belong under the "Author's custom styles" section and below. Image URLs there are `../img/...` because the stylesheet lives in `css/` while images are copied to `dist/img/`.
