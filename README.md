# nicecream.fm

three channels of house music, curated by humans.

a universal streaming app for iOS, Android, and Web built with Expo.

## channels

| channel | color | time of day |
|---------|-------|-------------|
| red | #EF3F36 | night (10pm - 6am) |
| green | #5AB055 | morning (6am - 2pm) |
| blue | #2972FF | day (2pm - 10pm) |

the app automatically selects the channel based on time of day.

## getting started

```bash
# install dependencies
npm install

# start development server
npm start

# or run specific platforms
npm run web        # web only
npm run ios        # iOS (requires dev build)
npm run android    # Android (requires dev build)
```

### development builds

audio playback requires a development build (Expo Go doesn't support native audio modules):

```bash
# create development build
npm run build:dev

# or generate native projects locally
npm run prebuild
```

## tech stack

- **expo** - universal react native framework
- **expo router** - file-based routing with deep linking
- **nativewind** - tailwind css for react native
- **zustand** - state management
- **react-native-track-player** - native audio with background playback
- **tanstack query** - data fetching

## project structure

```
app/                    # expo router pages
  [channel].tsx         # /red, /green, /blue routes
  +html.tsx             # web html template
  _layout.tsx           # root layout
src/
  components/           # ui components
  config/               # stream configuration
  services/             # audio service (platform-specific)
  store/                # zustand stores
```

## platform-specific code

files use extensions to differentiate platforms:
- `*.native.ts` - iOS/Android
- `*.web.ts` - Web
- `*.d.ts` - shared types

## scripts

| command | description |
|---------|-------------|
| `npm start` | start expo dev server |
| `npm run web` | start web only |
| `npm run typecheck` | typescript check |
| `npm run lint` | eslint check |
| `npm run format` | format with prettier |
| `npm run build:dev` | eas development build |
| `npm run build:prod` | eas production build |

## web features

- spacebar to play/pause
- url-based routing (`/red`, `/green`, `/blue`)
- auto-redirect to time-based default channel
