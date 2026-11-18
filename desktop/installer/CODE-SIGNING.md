# Beam Agent — Windows code signing

The packager signs `Beam-Agent-*-Setup.exe` when signing material is present.
Without a certificate the installer still ships; SmartScreen may warn testers until a trusted cert is used.

## What the packager looks for

In order:

1. `BEAM_SIGN_PFX` — path to a `.pfx` / `.p12` file, plus `BEAM_SIGN_PFX_PASSWORD` (or `BEAM_SIGN_PASSWORD`)
2. `BEAM_SIGN_THUMBPRINT` — thumbprint of a cert already in the Windows certificate store
3. `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` — electron-builder-style PFX path/password aliases

Optional:

- `BEAM_SIGN_TIMESTAMP` — RFC3161 timestamp URL (default: `http://timestamp.digicert.com`)
- `BEAM_SIGN_DESC` — file description embedded in the signature (default: `Beam Agent Setup`)

`signtool.exe` must be on `PATH` (Windows SDK / Visual Studio Build Tools).

## Example (PFX)

```powershell
$env:BEAM_SIGN_PFX = "C:\secure\assistix-codesign.pfx"
$env:BEAM_SIGN_PFX_PASSWORD = "<pfx-password>"
node desktop\package-installer.mjs
```

## Example (store thumbprint)

```powershell
$env:BEAM_SIGN_THUMBPRINT = "0123456789ABCDEF..."
node desktop\package-installer.mjs
```

## After signing

Re-run deploy so `latest.yml` / `nightly.yml` sha512 match the signed binary:

```powershell
python desktop\installer\deploy-early-alpha.py
```

When a real ASSISTIX Authenticode cert is available, set `publisherName` in
`desktop/installer/app-update.yml` to the certificate CN so electron-updater
verifies update packages. Leave it omitted while shipping unsigned Early Alpha builds.
