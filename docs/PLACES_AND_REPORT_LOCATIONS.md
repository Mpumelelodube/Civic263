# Places and report locations

The resident map uses a distinct light/dark colour for every service. Category symbols and names remain visible so colour is an additional cue. The navigation title bars are hidden; screen content and floating map controls account for the system safe areas.

The report location field searches Google Places after three characters with a 400 ms debounce. It shows up to five results, uses one session token through place selection, and opens the chosen place in a Google map for confirmation. Results are ephemeral. Google Maps attribution is displayed with provider content.

Autocomplete is restricted to Zimbabwe on the server using Google's `components=country:zw` country filter. The location bias only ranks matching Zimbabwean places, even when the device or map centre is abroad. Manual pin placement and reverse geocoding keep their existing behaviour. See [Google's country-filter documentation](https://developers.google.com/maps/documentation/places/web-service/legacy/autocomplete#components).

Pick from map opens a draggable report pin without requesting GPS access. Touch and hold the pin to drag it, or tap the map to place it. Reverse geocoding updates the address; failed lookups leave coordinates usable. Current location requests foreground permission only after that explicit action. Denial, disabled location services and a failed/timed-out fix leave manual placement available. A manual selection supersedes any pending GPS fix. No background location or motion access is requested.

Confirmed coordinates and their source (`map`, `current` or `place`), plus an optional place ID, persist with the resident's draft and pass through the validated report command. Editing the location text clears the previous pin to avoid attaching unrelated coordinates. Existing drafts without a coordinate remain readable. These locations remain private report data; publication requires the separate incident projection and precision policy.

## Server and key setup

`lookupPlace` is a Firebase callable in `europe-west1`. It requires an authenticated resident, enforces App Check outside emulators, validates an explicit request allowlist, calls fixed Google endpoints with an eight-second timeout, and limits each identity to sixty lookups per minute through a server-owned Firestore counter. Provider errors never return the key or request URL. Autocomplete/details responses expose only the fields needed by this interface. Place Details requests explicitly restrict the requested fields.

The user-specified secret is `GOOGLE_MAPS_SERVER_KEY` in the project displayed as `ride263` (`ride263-ddc3b`). Its value was retrieved through the existing user login, never displayed, and saved only in the ignored `functions/.secret.local` for local testing. It is never placed in Expo public variables or the client bundle. No IAM roles, API activation settings, billing settings or existing secret versions were changed.

The key's actual Maps consumer is a different project number. Places (New) is disabled there and the local user cannot administer that project. Its existing Places Legacy service and Geocoding API returned successful real responses, so this integration uses those enabled endpoints. Migrate the provider adapter to Places (New) when replacing the key or when its owner enables that service; new Google Cloud projects cannot enable Places Legacy.

## Local preview

Run from the repository root:

```powershell
npm run build --workspace @civic263/functions
npx --yes firebase-tools@14.20.0 emulators:start --project demo-civic263 --only auth,firestore
# In a separate terminal:
node scripts/intake-test-server.mjs
```

The helper loads the ignored server secret file and serves the built callable HTTP handler on localhost:5001. Auth and quota writes use the demo emulators; address lookups use the real Google APIs. For the connected Note9, ports 8083, 5001 and 9099 are reversed through ADB, and `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` is set in the ignored mobile environment. Report submission remains disabled. The preview needs these local processes and the USB connection to remain available.

Before cloud deployment, bind a separately configured `GOOGLE_MAPS_SERVER_KEY` secret in the Civic263 deployment project, verify its API/application restrictions and quotas, and finish native App Check configuration. Native standalone maps need their own Android/iOS SDK keys; the server key must not be reused as a public native SDK key. iOS and standalone builds remain unverified.
