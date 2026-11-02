# Contributing to Chess Board Tools

Bug reports, code review, testing, documentation and code changes are all
valuable contributions.

## Before you start

Read the [README](README.md), [architecture](docs/architecture.md) and
[validation guide](docs/validation.md). Check existing issues and pull requests
before opening a new one.

For a substantial feature, new permission, dependency or change to supported
behavior, open an issue to discuss the approach before implementing it.
Small, focused bug fixes can be proposed directly.

## Reporting bugs and reviewing changes

Include steps to reproduce, expected and actual behavior, browser and extension
versions, the relevant Chess.com page or route, and enabled extension settings.
Screenshots and console errors can help; remove private information before
sharing them.

In code review, explain the triggering scenario and its impact. Suggested code
and regression tests are welcome, but are not required for a useful report.

## Pull requests

Create a focused branch from `dev` and target `dev`. Keep each pull request about
one problem or feature. Avoid unrelated refactoring, formatting and dependency
changes.

Follow existing code patterns and module boundaries. Preserve existing
preferences, focus guards, privacy behavior and supported-page restrictions.
Discuss changes to these behaviors explicitly.

Describe the problem, the resulting behavior and validation performed. Link the
relevant issue or review discussion. Add or update a regression test for
behavioral fixes when practical, and update documentation when behavior changes.

## Validation

The extension has no build step or dependency installation requirement.
Use Node.js 18 or newer and Python 3. Run commands from the repository root.

Run the relevant tests first. Before submitting a code change, run:

```sh
node --test tests/*.test.cjs
for file in *.js; do node --check "$file" || exit; done
git diff --check
```

For changes to runtime files or packaging, also run:

```sh
python3 scripts/package-extension.py
```

Generated packages belong in the ignored `build/` directory.

For browser checks, follow the unpacked-extension instructions in the README
and the fixtures described in the validation guide. Reload the extension and
test tabs after updates.

Report automated checks and browser testing separately. Include the browser
version and scenarios tested, and state what remains unverified. Mocked tests
and local fixtures do not establish live Chess.com or Safari compatibility.

Documentation-only changes should be checked for accurate instructions,
working links and consistency with the affected behavior.

## Review and credit

Keep discussions respectful and focused on the change. Maintainers may request
revisions, defer a proposal or decline it based on correctness, scope,
compatibility or maintenance cost. Acceptance does not imply a release date.

Credit should reflect the contribution: a bug report, review suggestion,
testing, documentation or implementation. When a change incorporates someone
else's work, acknowledge that contribution in the pull request and agree on
any co-author attribution.
