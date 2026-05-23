# Changelog

## Unreleased

### Features

- Added `--offset` / `-o` to paginate search results. Thanks to @JakubPecenka.

### Fixes

- Fixed pnpm global installs by removing the native SQLite runtime binding.
- Fixed the standalone Bash CLI so `fruitmail search --subject ...` and other search flags are accepted. Thanks to @JakubPecenka for reporting this.

### Changes

- npm installs now require Node.js 22.13 or newer.
- Renamed the published npm and Homebrew package to `fruitmail`.
- Documented the local release wrapper and normalized release workflow naming.

## 1.1.2 - 2026-05-14

### Fixes

- Fixed `fruitmail -V` to report the package version instead of a stale hardcoded version.
- Fixed npm, git, and Homebrew installs to run the same built CLI entrypoint.

## 1.1.1 - 2026-03-30

Initial release.

### Features

- Added SQLite-backed Apple Mail search with full body content support.
- Added a unified Node and Bash CLI for Fruitmail.
- Added an install script that copies the executable and updates shell startup files.
- Added release automation scripts.

### Changes

- Updated README installation guidance, ClawHub links, and repository links after the rename.
- Improved table output and Mail lookup behavior.

### Fixes

- Fixed ClawHub links and wording in the README.
