# Monorepo architecture

The resident app, public site and operations application are independently runnable packages in one npm workspace. React is pinned to the Expo-supported 19.3.0 version across all three applications to avoid duplicate React installations.

The public site and ops use Vite. Mobile uses Expo Router under src/app with screen bodies, components and storage in sibling directories. Metro's standard monorepo support resolves the source-first @civic263/domain workspace package; no custom watch-folder or resolver hacks are needed.

The shared domain package contains pure TypeScript only. It has no Firebase credentials, React dependency or native module. Browser components/CSS live in @civic263/web-ui, which mobile never imports.

Functions is an independent deployable package with its own production dependencies. It currently exports only a health function. Do not add a runtime file: dependency on a parent workspace to Functions: Firebase does not upload parent folders. Bundle shared domain code into a future Functions build or publish a versioned deployable domain package before importing it at server runtime.

Reports are private resident submissions; incidents are canonical managed issues. Moderation, workflow and publication are independent. Public data uses an explicit field projection and a bounded server API. Business writes, role checks, idempotency, publication and outbox work belong on the server.

Native Firebase integration remains a separate foundation task. Use development builds, persisted Anonymous Auth, native App Check and the current native Firebase modules. Never put a service-account credential in an EXPO_PUBLIC_ or VITE_ variable. Google Maps client keys need platform/API restrictions and separate browser/iOS/Android registrations.
