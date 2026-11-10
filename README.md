# Morrow releases

This repository hosts public Morrow downloads. It does not contain the desktop application's source code.

Download Morrow at https://morrow.vibejason.com.

## Publish a version

1. Open https://github.com/tumblecat44/morrow-releases/releases/new.
2. Enter the app version as the tag, for example `v0.1.0`.
3. Attach the finished macOS installer before publishing. Include its architecture in the filename, for example `Morrow-0.1.0-arm64.zip`, `Morrow-0.1.0-x64.dmg`, or `Morrow-0.1.0-universal.dmg`.
4. Publish the release. Leave the pre-release option unchecked when the download is ready for the public website.

GitHub automatically verifies the downloads and updates `release.json`. The website reads that public file when a visitor opens the page. Cached copies may take a few minutes to update. The website does not need another deployment.

The automation selects the highest stable version with valid, publicly available installers and ignores drafts and pre-releases. It prefers a DMG over a ZIP for the same architecture. An invalid new release produces a workflow warning and leaves the previous valid release selected. Deleting or unpublishing a release restores the remaining valid release, or disables downloads if none remain. A temporary GitHub or network failure leaves the saved manifest unchanged.

If the workflow fails or warns about a release, correct the release and save its description, or rerun **Update website download** from the Actions tab. Uploading or deleting an attachment after publication does not itself trigger this workflow, so attach the completed files before publishing. The workflow needs no manually configured secrets and uses GitHub's temporary token for this repository only.

The app's build, signing, and notarization happen before the installer is uploaded. This repository publishes completed installers; it does not build the private source.
