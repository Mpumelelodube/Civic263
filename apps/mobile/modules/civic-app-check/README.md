# Civic263 native Firebase bridge

This local Expo module connects native Play Integrity/App Attest tokens to the existing Firebase JS session, preserving report-owner identities. Release attestation has no debug-provider fallback. iOS registers the APNs token with Firebase Messaging explicitly so Expo Notifications remains the notification delegate.

Android Firebase BoM 35.2.0 and Apple Firebase SDK 12.19.0 are pinned. Client configuration and signing material stay in ignored files. This module contains no credentials. Native source under this module is tracked; generated app projects and native build outputs remain ignored.
