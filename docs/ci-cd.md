# Production builds and Chrome Web Store submission

`dev` is the development branch; `prod` is the default production branch.
Every push to `prod` runs `.github/workflows/extension.yml`: Node tests,
JavaScript syntax checks, offline submission tests and deterministic packaging.
A successful build retains the ZIP, SHA-256 and provenance for 30 days in the
`extension-<commit SHA>` Actions artifact. The store job downloads that exact
artifact and checks its hashes and source commit before upload.

The existing Pages workflow also deploys from `prod`. Its path filters limit
automatic deployment to support/privacy site and Pages workflow changes.

## One-time Chrome Web Store setup

1. In the publisher's Google Cloud project, enable Chrome Web Store API and
   configure an OAuth client and consent screen. Authorize the publisher account
   with scope `https://www.googleapis.com/auth/chromewebstore` and offline access
   to obtain a refresh token. Use a production OAuth consent configuration;
   external apps in Testing can have short-lived refresh tokens. Follow the
   [official API setup guide](https://developer.chrome.com/docs/webstore/using-api/).
2. In GitHub **Settings → Secrets and variables → Actions**, add repository
   secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` using the
   protected input fields. Never place credentials in source code or logs.
3. Add Actions variables `CWS_PUBLISHER_ID` (from the Developer Dashboard) and
   `CWS_EXTENSION_ID` (the existing store item ID, currently
   `cjcnnbgmhglibikfjocccmgfcpopclie`). Verify ownership before configuring them.

Until all five values exist, submission is explicitly skipped and the build
artifact remains available. An API authentication or submission error after
configuration fails the submission job, without discarding the build artifact.
Builds run independently; submission jobs share a concurrency group and do not
cancel an active submission. GitHub retains at most one pending job in that
group, so a newer run can replace an older pending submission; its build
artifact remains available.

Only a run on `refs/heads/prod` passes the submission job's branch guard;
credentials are supplied only to its submission step. Repository administrators
must treat workflow edits as privileged because repository secrets are available
to authorized workflows.

## Release and retry

Increase the three-component `version` in `manifest.json` manually before
promoting a release to `prod`. CI does not edit versions, create commits, or
merge `dev` automatically. Every push builds; only an eligible new version is
submitted. The working-tree packager retains its `-candidate` ZIP name and
`candidate: true` provenance; these indicate that no signed release tag was
verified, not a different extension version.

The job checks API v2 `fetchStatus` before upload:

- Already published or actively submitted versions are skipped.
- A lower version fails, as does another active or staged submission.
- Rejected or cancelled submissions do not authorize replacing an active one.
- Upload processing is polled for at most five minutes. Failed, unknown or timed
  out uploads never trigger a publish request.

After upload, `publish` requests normal review and automatic publication upon
approval, preserving the existing visibility and rollout settings. Warnings
block submission. CI reports `PENDING_REVIEW` as submitted, not published; only
an API `PUBLISHED` response is reported as published. Approval may occur later:
check the Developer Dashboard. CI does not continuously monitor review status.

Use **Actions → Extension build and submission → Run workflow**, selecting
`prod`, to retry after configuring credentials or fixing an external problem.
Re-running an existing run uses that run's original commit. A successful
submission is recognized on retry and skipped; after an ambiguous timeout,
inspect the Developer Dashboard before retrying. An unfinished draft upload may
be uploaded again, but CI never cancels an active submission.

## Local checks

```sh
node --test tests/*.test.cjs
for file in *.js; do node --check "$file" || exit; done
python3 -m unittest discover -s tests -p 'test_publish_extension.py'
python3 scripts/package-extension.py
git diff --check
```

Submission tests use mocked API replies and do not establish live-store access.
Packaging is not a Safari build or a live Chess.com runtime test.
