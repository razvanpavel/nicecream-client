# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start          # Start Expo dev server (all platforms)
npm run web            # Start web only
npm run ios            # Run on iOS (requires dev build)
npm run android        # Run on Android (requires dev build)
npm run typecheck      # TypeScript check (run before committing)
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier
npm run format:check   # Check formatting (CI)
npm run prebuild       # Generate native projects
npm run build:dev      # EAS development build
npm run build:preview  # EAS preview build
npm run build:prod     # EAS production build
```

## Architecture

### Platform Strategy
This is a universal Expo app (iOS, Android, Web). Platform-specific code uses file extensions:
- `*.native.tsx` / `*.native.ts` - iOS/Android only
- `*.web.tsx` / `*.web.ts` - Web only
- `*.d.ts` - Shared type declarations

Metro config excludes `react-native-track-player` from web builds (see `metro.config.js`).

### Audio System
Audio is abstracted through `@/services/audioService`:
- **Native**: `react-native-track-player` with background playback support
- **Web**: HTML5 Audio API (no background playback)
- **Expo Go**: Graceful degradation (audio disabled, UI still works)

The `playbackService.native.ts` handles native background events (lock screen, notifications, headphones).

### State Management
- **Zustand** stores in `src/store/`:
  - `audioStore.ts` - Playback state, stream metadata, player controls
  - `appStore.ts` - App-level state (player setup status)

### Routing
Expo Router with file-based routing in `app/`:
- `/` - Redirects to time-based default channel (web) or shows SwipePager (native)
- `/red`, `/green`, `/blue` - Channel pages with URL-based navigation (web)
- `/settings` - Settings modal

Web uses `+html.tsx` for custom HTML template with meta tags.

### Streams
Three channels configured in `src/config/streams.ts`:
- Red (#EF3F36) - Night (10 PM - 6 AM)
- Green (#5AB055) - Morning (6 AM - 2 PM)
- Blue (#2972FF) - Day (2 PM - 10 PM)

## Styling Rules

### Tailwind/NativeWind (CRITICAL)
- **NEVER** use `useWindowDimensions`, `Dimensions.get()`, or manual screen measurements
- **ALWAYS** use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- **ALWAYS** use `cn()` from `@/utils/cn` for conditional classes
- Only use inline `style` for dynamic values (e.g., `stream.color`, safe area insets)

### Typography
- All user-facing text: **lowercase**
- Headings: `font-heading` (AlteHaasGrotesk-Bold)
- Body: Platform defaults (no class needed)

### Brand Colors
- `bg-brand-green` / `text-brand-green` (#5AB055)
- `bg-brand-red` / `text-brand-red` (#EF3F36)
- `bg-brand-blue` / `text-brand-blue` (#2972FF)

## Code Style

### TypeScript
- Strict mode with `noUncheckedIndexedAccess` - always handle `undefined` from array access
- Always specify return types on functions
- Use `void` prefix for fire-and-forget async: `void playStream()`

### Platform Checks
- Use `Platform.OS` only for **behavior** differences, never for styling
- Styling differences go in platform-specific files (`.native.tsx` / `.web.tsx`)

### Path Aliases
```typescript
import { useAudioStore } from '@/store/audioStore';
import { cn } from '@/utils/cn';
import { STREAMS } from '@/config/streams';
```
