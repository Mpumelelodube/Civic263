# Civic263 engineering conventions

- This is one npm-workspaces repository: apps/mobile, apps/web, apps/ops, packages/domain, packages/web-ui and functions.
- Run commands from the repository root unless a package-specific command needs a working directory.
- Keep mobile and browser rendering separate. Share domain types, categories and pure validation rather than native components.
- Mobile uses Expo SDK 58. Install native dependencies with `npx expo install` in apps/mobile; use the SDK-pinned documentation.
- Route files belong only in apps/mobile/src/app. Screen bodies, components and services are siblings.
- The public website follows the agreed design-taste-frontend app-screen direction, Achromatic ledger, seed 879817. Use the available skill when working on public UI.
- Never present fixture data, locally saved drafts or scaffold responses as real municipal reports or official acknowledgements.
- Reports belong to a resident identity; incidents are canonical operational issues. Keep moderation, publication and workflow states separate.
- Public responses are explicitly allowlisted. Never ship owner UIDs, contact details, raw private media, staff notes or tokens to the public site.
- All business writes must go through validated server commands. The initial Firebase rules deliberately block writes and uploads.
- Never commit credentials, native Firebase service files, signing keys, local .env files or generated native/build directories.
- Before finishing: run `npm run verify`. Report any checks that could not run and why. Native real-device tests and Firebase deployment require separately configured projects.
