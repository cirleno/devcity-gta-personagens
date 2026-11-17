# AGENTS.md

## What this is
A small static single-page site (Brazilian Portuguese, GTA/"Dev City" themed character picker) built on HTML5 Boilerplate. No framework, no app server, no tests. There is no README — source and config files are the only source of truth.

## Commands
- `npm install` — no lockfile is committed, so versions float within the `^` ranges in `package.json`.
- `npm start` — webpack dev server with HMR and auto-open; serves the repo root (`static: ['./']`) statically. Use for local dev.
- `npm run build` — production bundle into `dist/`. `output.clean: true` wipes `dist/` every build.
- `npm test` — placeholder that always exits 1. There is no test suite, linter, formatter, typecheck, codegen, pre-commit hook, or CI — don't waste time looking for them.

## Wiring gotchas (easy to get wrong)
- Webpack entry is `js/app.js`: it imports `js/scripts.js`, where `escolherPersonagem()` lives. Edit `app.js` for button wiring/upload/Puter; edit `scripts.js` only for the name/image/color swap.
- `index.html` loads a single `<script src="js/app.js">` after the Puter CDN. `HtmlWebpackPlugin` uses `inject: false` so prod does not inject a second tag. The old broken `js/script.js` (singular) reference is gone.
- `index.html` loads Puter.js from `https://js.puter.com/v2/` (CDN, needs network). It powers the "selfie → AI legend" flow in `app.js` (`test_mode: true` while validating; flip to `false` for real generation, which spends credits).
- Dev and prod configs are asymmetric: only `webpack.config.prod.js` uses `HtmlWebpackPlugin` (generates `dist/index.html` from `index.html`) and `CopyPlugin` (copies `img/`, `css/`, `js/vendor/`, `icon.svg`, `favicon.ico`, `icon.png`, `robots.txt`, `404.html`, `site.webmanifest` into `dist/`). The dev config has neither and just serves source files. Verify changes with both `npm start` and `npm run build`.
- `js/vendor/` and `img/` keep `.gitkeep` files so they stay tracked; preserve them so the CopyPlugin patterns have a source directory.

## Conventions
- User-facing text, comments, and identifiers are in Brazilian Portuguese — keep new code consistent.
- `.editorconfig`: UTF-8, LF, 2-space indent, final newline, trim trailing whitespace. `.gitattributes` enforces LF for text files (only `*.bat` is CRLF); images/icons are binary.
- `css/style.css` starts with HTML5 Boilerplate / main.css boilerplate; project styles belong under the "Author's custom styles" section and below. Image URLs there are `../img/...` because the stylesheet lives in `css/` while images are copied to `dist/img/`.
