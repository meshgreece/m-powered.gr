# m-powered.gr

The Meshtastic Greece Community website, built with Docusaurus.

## Local development

Use Node.js 22 (the version used by CI) and npm.

```bash
npm ci
npm start
```

## Verification and preview

```bash
npm test
npm run typecheck
npm run build
npm run serve
```

The production build is written to `build/`. Meshview restricts browser origins
through its CORS policy, so live data may be unavailable in a localhost preview.

## Deployment

[The GitHub Actions workflow](.github/workflows/deploy.yml) runs tests, typechecks
and builds the site on pushes to `master`, then deploys the build artifact to
GitHub Pages. It can also be started manually with `workflow_dispatch`.

## Maintenance

- `npm run protobuf:update -- <exact-version>` installs the specified Meshtastic
  protobuf version and runs tests, typecheck and build.
- `npm run nuts:update` regenerates `static/data/greece-nuts3.topo.json` from the
  Eurostat NUTS 2024 topology.
