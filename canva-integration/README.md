# Campusly × Canva

This directory is the single Canva integration surface for Campusly. It is intentionally separate from the Campusly frontend so the main app does not get duplicate routes or overlay patches.

## Target flow

Campusly AI → generate PPTX → Canva Design Import API → editable Canva design.

Canva supports importing `.pptx`, `.docx`, and `.pdf` as editable designs through its Design Import API. The import API requires a Canva access token with the `design:content:write` scope.

## Free path

Development can start with a standard free Canva account. A public Canva app must still be created in Canva Developer Portal and reviewed before public Marketplace distribution.

## Required Canva-side setup

1. Create a **Public** app in Canva Developer Portal.
2. Enable the REST API / Design Import capability.
3. Configure the OAuth redirect URL for Campusly.
4. Store the Canva client ID and client secret as server environment variables; never put the secret in frontend code.
5. Use the resulting access token to call `POST /rest/v1/imports` with the generated Campusly PPTX bytes or a public PPTX URL.

## Why this is not a fake Canva button

The old `window.open('https://www.canva.com/')` behavior is not an integration and is intentionally not reproduced here. The final integration must create an actual Canva import job and return the resulting Canva design URL.

## Source of truth

Canva Developers SDK documentation:
- Design Import API: https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/
- Create Design Import Job: https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/create-design-import-job/
- OAuth authentication: https://www.canva.dev/docs/apps/rest-apis/authentication/
