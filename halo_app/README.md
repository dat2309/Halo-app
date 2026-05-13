# Halo App

React Native mobile client cho Halo. Expo SDK 53 + Expo Router + NativeWind + WebRTC.

> **Quan trọng**: Project có 3 native modules (`react-native-webrtc`, `react-native-vision-camera`, `@react-native-ml-kit/text-recognition`) **không có sẵn trong Expo Go**. Bạn phải build **custom dev client** qua `prebuild` + `eas build` (hoặc `expo run:ios` / `expo run:android` cho dev local).

## Quick start

```bash
pnpm install
cp .env.example .env.development        # rồi sửa API_URL về backend của bạn
pnpm run prebuild:development            # generate ios/ + android/
pnpm run ios                             # hoặc android
```

Khi Metro chạy, bấm `i`/`a` để chạy trên simulator/emulator. Hot reload hoạt động bình thường sau khi dev client đã cài.

## Yêu cầu

- **Node 20+**, **pnpm 10+** (`npm install -g pnpm`)
- **macOS + Xcode 15+** (cho iOS)
- **Android Studio + JDK 17** (cho Android)
- **Backend đang chạy** — xem [../backend/README.md](../backend/README.md)
- **Webcam** trên Android Emulator nếu test video call (AVD → Advanced → Front camera: Webcam0)

## Environment variables

3 file env tách theo môi trường, chuyển bằng `APP_ENV`:

```bash
APP_ENV=development → loads .env.development   (default)
APP_ENV=staging     → loads .env.staging
APP_ENV=production  → loads .env.production
```

Mỗi file cần đúng các keys trong [.env.example](.env.example). Quan trọng nhất:

| Variable | Mô tả |
|----------|-------|
| `API_URL` | Backend URL, **phải có** `/api` đuôi. Dùng IP LAN khi test trên device thật |
| `SECRET_KEY` | Build-time placeholder (sample dùng, production move ra EAS Secrets) |

`API_URL` được zod-validate trong [env.js](env.js).

## Scripts

```bash
# Dev
pnpm start                        # Metro bundler
pnpm run ios                      # build + chạy iOS dev client
pnpm run android                  # build + chạy Android dev client
pnpm run prebuild                 # generate ios/ + android/ folders
pnpm run prebuild:development     # prebuild với APP_ENV=development

# Per environment
pnpm run start:staging
pnpm run start:production
pnpm run prebuild:staging
pnpm run prebuild:production

# EAS Cloud Build (cần Expo account + project ID)
pnpm run build:development:ios
pnpm run build:development:android
pnpm run build:staging:ios
pnpm run build:production:ios

# QA
pnpm run lint                     # ESLint
pnpm run type-check               # tsc --noEmit
pnpm run test                     # Jest
pnpm run test:watch
pnpm run check-all                # lint + type-check + i18n + test
pnpm run e2e-test                 # Maestro (cần install Maestro)
```

## Cấu trúc

```
src/
├── app/                          ← expo-router screens (file-based)
│   ├── _layout.tsx               root: AuthProvider, CallProvider, theme
│   ├── login.tsx                 ─┐
│   ├── register.tsx              ─┤  auth screens
│   ├── onboarding.tsx            ─┘
│   ├── user/[id].tsx             public profile
│   └── (app)/                    ← authenticated tabs
│       ├── _layout.tsx           Tabs nav
│       ├── index.tsx             home feed
│       ├── calendar.tsx
│       ├── camera.tsx
│       ├── finance.tsx
│       ├── settings.tsx
│       ├── friends.tsx           (hidden, entry via Settings)
│       ├── profile.tsx           (hidden)
│       ├── search.tsx            (hidden)
│       ├── call-history.tsx      (hidden, entry via Settings)
│       ├── chat/                 ← nested Stack
│       │   ├── _layout.tsx
│       │   ├── index.tsx         conversation list
│       │   └── [id].tsx          thread
│       └── feed/                 ← post creation
│           ├── add-post.tsx
│           └── [id].tsx          post detail
│
├── api/                          ← react-query-kit hooks
│   ├── auth.ts
│   ├── chat.ts
│   ├── common/                   axios client + logger
│   ├── posts/
│   ├── comments.ts
│   ├── reactions.ts
│   ├── friends.ts
│   ├── calendar.ts
│   ├── finance.ts
│   ├── search.ts
│   ├── upload.ts
│   └── user.ts
│
├── components/
│   ├── ui/                       Button, Input, Text, Image, etc.
│   ├── glass/                    GlassContainer, GlassHeader, GlassBottomTab
│   ├── call/                     CallOverlay full-screen modal
│   ├── comments/                 CommentsSheet (bottom-sheet)
│   ├── feed/                     PostItem, ReactionBar
│   ├── finance/                  CategoryPieChart
│   ├── settings/                 Item, LanguageItem, ThemeItem
│   └── login-form.tsx
│
├── lib/
│   ├── auth/                     Zustand store + SecureStore token
│   ├── call/                     CallProvider — WebRTC state machine
│   ├── i18n/                     i18next setup + translate helper
│   ├── hooks/                    useIsFirstTime, useSoftKeyboardEffect, etc.
│   ├── permissions/              request-camera helper
│   ├── socket.tsx                Socket.IO client singleton
│   ├── storage.tsx               MMKV wrapper
│   ├── media-url.ts              resolves relative → absolute URL
│   └── use-theme-config.tsx
│
└── translations/
    ├── en.json                   ─┐
    ├── vi.json                   ─┤  157 keys mỗi file, parity check trong CI
    └── ar.json                   ─┘
```

## Tech stack

- **Expo SDK 53** + React 19 + React Native 0.79
- **Routing**: expo-router 5 (typed routes enabled)
- **State**: Zustand 5 (auth, mmkv-persisted theme)
- **Server state**: TanStack Query 5 + react-query-kit 3
- **Forms**: React Hook Form 7 + Zod 3
- **Styling**: NativeWind 4 (Tailwind CSS), tailwind-variants
- **Realtime**: socket.io-client 4.8
- **WebRTC**: react-native-webrtc 124 (+ config plugin 12 cho prebuild)
- **Camera**: react-native-vision-camera 4.7
- **Media playback**: expo-av 16
- **Image**: expo-image, expo-image-picker
- **Storage**: expo-secure-store (token), react-native-mmkv (preferences)
- **i18n**: i18next 23 + react-i18next 15 (3 languages, RTL support)
- **Testing**: Jest + @testing-library/react-native, Maestro (E2E)
- **Lint**: ESLint flat config + Prettier + Husky + lint-staged
- **Commit**: commitlint với conventional commits

## Why custom dev client?

`react-native-webrtc`, `react-native-vision-camera`, `@react-native-ml-kit/text-recognition` đều có native code. Expo Go (app generic trên App Store/Play Store) chỉ chứa các package được Expo team chấp nhận trước — không có 3 modules trên.

Custom dev client = app riêng bạn build với native code đầy đủ + connect tới Metro để hot reload JS. Quy trình:
1. `pnpm run prebuild:development` → sinh `ios/` + `android/` folders với native code đầy đủ
2. `pnpm run ios` hoặc `pnpm run android` → build + cài "Halo App (dev)" lên simulator/device
3. Mở app vừa build, nó tự connect tới Metro đang chạy

Lần build đầu tốn 5-15 phút. Lần sau chỉ Metro reload JS, gần như instant.

## Test guide cho video call

1. **Cùng wifi 2 device**: build dev client cho cả 2 (iOS Simulator + iPhone thật, hoặc Android Emulator + Android phone)
2. **2 simulator**: boot 2 simulator iOS khác device (iPhone 15 Pro + iPhone 14), cài app vào cả 2
3. **Phone + Web**: chạy `halo_web` ở `http://localhost:5173`, login user khác trên web để gọi mobile

Login khác account, friend nhau, vào chat → bấm icon 📞 (voice) hoặc 📹 (video).

Chi tiết WebRTC flow + troubleshooting: [../docs/VIDEO_CALL.md](../docs/VIDEO_CALL.md).

## Permission

App tự request quyền camera + mic khi mount `(app)/_layout` qua `requestCameraAndMicrophone()`. Nếu user deny, cuộc gọi/camera screen sẽ fail rõ ràng. Họ có thể cấp lại trong Settings của OS.

## Theme

Tự động theo system (`Appearance.getColorScheme()`), có thể override trong Settings → Theme:
- **Light**: nền trắng, chữ đen
- **Dark**: nền đen, chữ trắng
- **System**: theo OS

`useColorScheme` từ nativewind. Inline `style.color` được dùng trong các TextInput để đảm bảo dark mode luôn đúng (tránh quirks của tailwind-variants).

## i18n

3 ngôn ngữ với 157 keys mỗi file:
- English (default)
- Tiếng Việt
- العربية (RTL)

Đổi qua Settings → Language. Mỗi lần đổi sẽ reload app để áp dụng (`RNRestart.restart()` trên prod, `DevSettings.reload()` trên dev).

## Logging API calls

Tất cả request/response của axios in vào Metro logs với format:
```
[API] → POST http://10.0.x.x:3000/api/auth/login
[API]   body: { "identifier": "user@example.com", "password": "***" }
[API] ← POST http://10.0.x.x:3000/api/auth/login 200 142ms
[API]   data: { ... }
```

Token + password tự động mask. Tắt: đổi `ENABLED = false` trong [src/api/common/logger.ts](src/api/common/logger.ts).

## Troubleshooting

| Lỗi | Nguyên nhân thường gặp | Fix |
|-----|------------------------|-----|
| `ETARGET` `@config-plugins/react-native-webrtc@^11.0.0` | Version sai | Đã fix trong package.json — version 12 cho SDK 53 |
| `pod install` fail `RNMLKitTextRecognition needs >= 15.5` | iOS deployment target thấp | `expo-build-properties` đã set 15.5 — chạy lại `pnpm run prebuild:development` |
| `Network Error` 15ms từ Android | Cleartext HTTP bị block từ Android 9+ | `usesCleartextTraffic: true` đã set, rebuild dev client |
| `Project incompatible with Expo Go SDK 54` | Đang mở Expo Go thay vì dev client | Build dev client (`pnpm run ios/android`), mở app `Halo App` đã cài, không phải Expo Go |
| Camera đen trong call | Vision Camera giữ session / quyền deny / dev client cũ | Force quit app + cấp lại quyền + rebuild dev client |

## Reference

- Backend: [../backend/README.md](../backend/README.md)
- Web test client: [../halo_web/README.md](../halo_web/README.md)
- Video call deep dive: [../docs/VIDEO_CALL.md](../docs/VIDEO_CALL.md)
- Project upstream template (cũ): [README-project.md](README-project.md)
