# Notes for Claude

- Every push to `main` or `claude/swordigo-game-development-4zc1a4` publishes a GitHub Release
  (`.github/workflows/release.yml`) with the Android APK and the iPad app attached.
- With each change, add a new section at the top of `CHANGELOG.md` (`## タイトル`, then bullet
  points in Japanese for players). That section becomes the release's title and description.
- Before pushing: `npm run typecheck`, `npm test`, `npm run build`.
