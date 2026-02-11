# nicecream.fm

three channels of house music, curated by humans.

a universal streaming app for iOS, Android, and Web — built with Expo SDK 54, React Native 0.81, and React 19.

## channels

| channel | color   | default time       |
| ------- | ------- | ------------------ |
| red     | #EF3F36 | night (10pm - 6am) |
| green   | #5AB055 | morning (6am - 2pm)|
| blue    | #2972FF | day (2pm - 10pm)   |

the app selects the default channel based on time of day. streams are served from Icecast/AzuraCast endpoints.

## getting started

```bash
npm install

# start development server (all platforms)
npm start

# or run a specific platform
npm run web        # web only
npm run ios        # iOS (requires dev build)
npm run android    # Android (requires dev build)
```

### development builds

audio playback requires a native dev build — Expo Go runs in UI-only mode (audio disabled, everything else works):

```bash
npm run build:dev      # EAS development build
npm run prebuild       # or generate native projects locally
```

### environment variables

| variable | default | description |
| -------- | ------- | ----------- |
| `EXPO_PUBLIC_API_URL` | `https://api.nicecream.fm` | backend api base url |
| `EXPO_PUBLIC_STREAM_RED` | `https://play.nicecream.fm/radio/8000/red.mp3?...` | red stream url |
| `EXPO_PUBLIC_STREAM_GREEN` | `https://play.nicecream.fm/radio/8010/green.mp3?...` | green stream url |
| `EXPO_PUBLIC_STREAM_BLUE` | `https://play.nicecream.fm/radio/8020/blue.mp3?...` | blue stream url |

## architecture

### platform abstraction

platform-specific code uses file extensions. Metro resolves the correct file per platform at build time.

| component | `.native.ts` | `.web.ts` |
| --------- | ------------ | --------- |
| `audioService` | react-native-track-player | HTML5 Audio + MediaSession API |
| `playbackService` | background event handlers (lock screen, remote controls, audio ducking) | no-op |
| `useAudioLifecycle` | AppState + NetInfo monitoring, health checks, reconnection | online/offline events |
| `SwipePager` | react-native-pager-view with infinite circular scroll | arrow navigation + dot indicators |
| `HomeOverlay` | Reanimated pan gesture dismiss | CSS transitions |
| `Loader` | lottie-react-native | lottie-react |
| `ActionSheet` | native ActionSheetIOS / Android Modal | CSS animated modal |

each pair shares a `.d.ts` type declaration. `react-native-track-player` is resolved to an empty module on web via `metro.config.js`.

### audio system

the audio layer is the core of the app. key design decisions for live radio:

- **no resume from pause** — live stream buffers go stale, so play always reloads the stream
- **transition mutex** — token-based lock in `audioStore` prevents concurrent stream switches; includes deadlock force-release
- **circuit breaker** — tracks consecutive failures (threshold: 5), opens for 30s, then half-open for test requests
- **abort controller** — each `playStream()` call aborts the previous in-flight request
- **`isTransitioning` flag** — prevents background platform events (TrackPlayer state changes, ICY metadata) from overwriting the store during controlled stream switches
- **expo-video coexistence** — a `patch-package` patch on expo-video prevents it from hijacking the iOS AVAudioSession; `configureExclusiveAudioSession()` reclaims it before every play

native background playback is registered synchronously at module level in `_layout.tsx` via `require()` (not dynamic import) to avoid event listener race conditions.

### state management

two Zustand stores, always accessed via selectors to avoid over-subscription:

**audioStore** — playback state machine (`idle` → `loading` → `playing` / `paused` / `error`), retry logic with exponential backoff, error categorization (`network`, `autoplay`, `not_found`, `auth`, `unknown`), request ID tracking for stale callback rejection.

**appStore** — current stream index, player setup status, offline state, home overlay lifecycle, pending navigation signals (decouples BottomNavigation from SwipePager).

### routing

Expo Router with file-based routing and typed routes:

| route | behavior |
| ----- | -------- |
| `/` | web: redirects to time-based channel. native: renders SwipePager |
| `/red`, `/green`, `/blue` | channel pages with `generateStaticParams()` for static web export |
| `/settings` | modal presentation (placeholder) |

on native, channel switching uses `SwipePager` — a 5-page `PagerView` layout (`[Blue, Red, Green, Blue, Red]`) that creates infinite circular scroll by jumping without animation at boundaries. logo crossfade tracks the swipe gesture via Reanimated shared values on the UI thread.

on web, `[channel].tsx` handles URL-based navigation with keyboard support (spacebar play/pause).

### now playing metadata

two metadata sources, prioritized:

1. **ICY metadata** (native only) — extracted from the Icecast stream by TrackPlayer, near real-time
2. **AzuraCast HTTP API** — polled adaptively (5s base, slows to 30s after unchanged responses)

ICY metadata takes priority when received within the last 10 seconds. the HTTP poll is skipped if ICY data is fresh.

### styling

NativeWind (Tailwind CSS for React Native) with:
- `cn()` utility combining `clsx` + `tailwind-merge` for conditional classes
- CVA-based UI primitives (`Text`, `Button`, `Card`) with variant support
- custom brand colors (`brand-red`, `brand-green`, `brand-blue`) and fonts (`font-heading`: AlteHaasGrotesk Bold)
- Tailwind breakpoints for responsive layout — no `Dimensions.get()` or `useWindowDimensions`

all user-facing text is lowercase.

## project structure

```
app/                          # Expo Router pages
  _layout.tsx                 # root layout: providers, audio init, fonts, splash
  index.tsx                   # entry: redirect (web) or SwipePager (native)
  [channel].tsx               # /red, /green, /blue
  +html.tsx                   # web HTML template with meta tags
  settings.tsx                # settings modal
src/
  api/                        # axios client, now-playing API, query client
  components/                 # all UI components + platform variants
    icons/                    # SVG icon components
    ui/                       # primitives (Text, Button, Card)
  config/                     # streams, logos, backgrounds, env
  hooks/                      # audio lifecycle, haptics, now playing
  services/                   # audio service + playback service (per-platform)
  store/                      # Zustand stores (audioStore, appStore)
  utils/                      # cn(), musicSearch
assets/
  fonts/                      # AlteHaasGrotesk .ttf files
  images/                     # backgrounds (.mp4), logos (.png), app icons
patches/                      # expo-video AVAudioSession fix
scripts/                      # version bump script
```

## scripts

| command | description |
| ------- | ----------- |
| `npm start` | start Expo dev server |
| `npm run web` | web only |
| `npm run ios` | iOS (requires dev build) |
| `npm run android` | Android (requires dev build) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | auto-fix lint issues |
| `npm run format` | format with Prettier |
| `npm run build:dev` | EAS development build |
| `npm run build:preview` | EAS preview build |
| `npm run build:prod` | EAS production build |

## deployment

### native (EAS Build)

three build profiles in `eas.json`: `development` (internal), `preview` (internal), `production` (auto-increment, App Store/Play Store).

OTA updates via `expo-updates` with fingerprint-based runtime versioning:

```bash
eas update --channel preview --message "description"
eas update --channel production --message "description"
```

### web (EAS Deploy)

static export via Metro, deployed to Expo Hosting:

```bash
npx expo export --platform web && eas deploy          # preview
npx expo export --platform web && eas deploy --prod    # production
```

### versioning

`scripts/bump-version.sh` handles semver bumps across `package.json` + `app.json` and creates a git tag.
