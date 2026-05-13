# Halo

Một mini social app full-stack — gồm **mobile app** (iOS/Android), **backend API**, và **web test client**. Mục đích chính: làm sample project để học các pattern thực tế (auth, realtime, video call, file upload, i18n) chứ không phải sản phẩm thương mại.

## Tính năng chính

| Domain | Mô tả |
|--------|-------|
| **Auth** | Login/register bằng email hoặc SĐT, JWT + refresh token, hydrate từ SecureStore |
| **Feed** | Posts với ảnh/video, comments nested, reactions, infinite scroll, realtime updates |
| **Friends** | Search theo name/username (partial match), gửi/accept/decline request, unfriend |
| **Chat 1-1** | Text messaging realtime qua Socket.IO, typing indicator, read receipts, unread badge |
| **Video/Audio Call** | WebRTC peer-to-peer, signaling qua Socket.IO, ICE restart, call quality bars, missed call log |
| **Calendar** | CRUD events với màu sắc, reminder, monthly summary, upcoming events |
| **Finance** | Income/expense, OCR scan hoá đơn (ML Kit), category pie chart, yearly bar chart |
| **Upload** | Cloudinary CDN cho ảnh/video, auto-transcode video, public_id tracking |
| **i18n** | 157 keys × 3 ngôn ngữ (en/vi/ar) với RTL support cho Arabic |
| **Theme** | Light/Dark/System mode, glass UI design |

## Kiến trúc

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  halo_app       │         │  halo_web       │         │  Cloudinary CDN │
│  (Mobile RN)    │◄───────►│  (Web React)    │         │  (assets)       │
│  Expo SDK 53    │         │  Vite           │         └────────▲────────┘
└────────┬────────┘         └────────┬────────┘                  │
         │                            │                           │
         │  REST + Socket.IO          │                           │ upload
         └──────────────┬─────────────┘                           │
                        │                                          │
                        ▼                                          │
                ┌──────────────────┐                              │
                │     backend      │──────────────────────────────┘
                │   (NestJS 10)    │
                │ + Socket.IO 4.7  │
                └────────┬─────────┘
                         │
                ┌────────▼────────┐
                │    MongoDB      │
                └─────────────────┘
```

Mỗi thiết bị có thể tham gia chat/call với mọi thiết bị khác qua cùng backend. Web app và mobile app dùng **cùng schema, cùng endpoint, cùng socket events** — chỉ khác implementation layer.

## Cấu trúc thư mục

```
halo_dev/
├── README.md                   ← bạn đang đọc
├── .gitignore                  ← root defensive
├── backend/                    ← NestJS API server
│   ├── src/modules/
│   │   ├── auth/               JWT login + register + refresh
│   │   ├── user/               profile, search, public profile
│   │   ├── friend/             friend requests + relationships
│   │   ├── post/               feed, discover, user posts
│   │   ├── comment/            nested comments
│   │   ├── reaction/           like (toggle)
│   │   ├── chat/               1-1 conversation + messages
│   │   ├── call/               WebRTC signaling + history
│   │   ├── calendar/           events
│   │   ├── finance/            transactions + OCR
│   │   ├── upload/             Cloudinary integration
│   │   ├── socket/             unified WebSocket gateway
│   │   └── health/             liveness probe
│   └── README.md
├── halo_app/                   ← React Native (Expo 53)
│   ├── src/
│   │   ├── app/                expo-router screens (file-based)
│   │   ├── api/                react-query-kit hooks
│   │   ├── components/         UI components (NativeWind)
│   │   ├── lib/                auth, i18n, call, socket, utils
│   │   └── translations/       en.json / vi.json / ar.json
│   └── README.md
├── halo_web/                   ← React + Vite (test client)
│   ├── src/
│   │   ├── pages/              Login, Chat
│   │   ├── components/         ConversationList, ChatThread, CallOverlay
│   │   └── lib/                api, auth, socket, call
│   └── README.md
└── docs/
    └── VIDEO_CALL.md           ← chi tiết kỹ thuật video call
```

## Yêu cầu hệ thống

- **Node**: 20+
- **pnpm**: 10+ (`npm install -g pnpm`)
- **MongoDB**: 6+ (local hoặc Atlas)
- **iOS development**: macOS + Xcode 15+ (nếu build iOS)
- **Android development**: Android Studio + JDK 17 (nếu build Android)
- **Cloudinary account**: free tier 25GB — tạo tại https://cloudinary.com/console

## Quick start

```bash
# 1. Clone + cài deps
git clone <repo-url> halo_dev
cd halo_dev

# 2. Backend
cd backend
cp .env.example .env             # rồi điền secrets
pnpm install
pnpm run start:dev               # → http://localhost:3000 (Swagger: /api/docs)

# 3. Mobile app (terminal mới)
cd ../halo_app
cp .env.example .env.development # rồi sửa API_URL = http://<IP-LAN>:3000/api
pnpm install
pnpm run prebuild:development    # generate ios/ + android/
pnpm run ios                     # hoặc android
# Note: dự án có react-native-webrtc nên KHÔNG chạy được trong Expo Go
# Phải build custom dev client như trên

# 4. Web test client (terminal mới, optional)
cd ../halo_web
cp .env.example .env
pnpm install
pnpm dev                         # → http://localhost:5173
```

Chi tiết thêm xem README của từng subproject:
- [backend/README.md](backend/README.md)
- [halo_app/README.md](halo_app/README.md)
- [halo_web/README.md](halo_web/README.md)

## Tech stack

### Backend
- **Framework**: NestJS 10 + Express
- **Database**: MongoDB + Mongoose 8
- **Auth**: Passport JWT + bcrypt
- **Realtime**: Socket.IO 4.7 (chat + call signaling)
- **Storage**: Cloudinary (image/video CDN)
- **OCR**: ML Kit (via @react-native-ml-kit, runs on mobile, not backend)
- **Docs**: Swagger/OpenAPI tại `/api/docs`
- **Validation**: class-validator + class-transformer

### Mobile app
- **Framework**: Expo SDK 53 + React Native 0.79 + React 19
- **Routing**: expo-router 5 (file-based)
- **UI**: NativeWind 4 (Tailwind cho RN) + custom glass components
- **State**: Zustand (auth) + TanStack Query + react-query-kit (server state)
- **Forms**: React Hook Form + Zod
- **Realtime**: socket.io-client 4.8
- **WebRTC**: react-native-webrtc 124 + @config-plugins/react-native-webrtc 12
- **Camera**: react-native-vision-camera 4.7
- **Media**: expo-av (audio), expo-image, expo-image-picker
- **i18n**: i18next + react-i18next

### Web test client
- **Framework**: React 18 + Vite 5 + TypeScript
- **WebRTC**: browser native (`RTCPeerConnection`, `getUserMedia`)
- **HTTP**: axios
- **Socket**: socket.io-client

## Test scenarios

### Cuộc gọi giữa 2 thiết bị
1. **Mobile ↔ Mobile**: build dev client trên 2 máy (iOS Simulator + Android Emulator + iPhone thật...), login 2 account khác nhau, add friend, gọi qua icon trong chat header
2. **Mobile ↔ Web**: build dev client trên mobile + chạy `pnpm dev` ở halo_web, login 2 account khác nhau ở 2 thiết bị
3. **Web ↔ Web** (debug nhanh): mở 2 cửa sổ Chrome (Normal + Incognito để tách session), login khác nhau

Chi tiết WebRTC flow, ICE/TURN, troubleshooting: [docs/VIDEO_CALL.md](docs/VIDEO_CALL.md).

### Chat
- Vào tab Messages (Settings → "Messages") hoặc từ Friends list bấm icon 💬 cạnh tên bạn
- Test typing indicator (đang gõ → đầu kia thấy)
- Test unread badge (gửi tin → đóng app → reopen)

### Realtime updates
- 2 thiết bị cùng login mọi tin/comment/reaction → cập nhật tức thì qua Socket.IO

## API documentation

Sau khi backend chạy:
- **Swagger UI**: http://localhost:3000/api/docs (tương tác trực tiếp với endpoints)
- **Socket events**: chi tiết trong [docs/VIDEO_CALL.md §4.1](docs/VIDEO_CALL.md) (Swagger không support WebSocket native)

## Giới hạn đã biết

| Hạng mục | Trạng thái |
|----------|-----------|
| Push notifications | ❌ chưa có (app bị kill → miss call/message đến khi mở lại) |
| Group chat | ❌ schema 1-1 only |
| End-to-end encryption | ❌ message lưu plaintext trên server |
| Screen share mobile | ❌ chỉ web support (mobile cần native foreground service) |
| Picture-in-Picture call | ❌ chưa wire native PiP API |
| Audio routing iOS chuẩn | ⚠️ best-effort qua expo-av, cần `react-native-incall-manager` cho production |
| Migration script `/uploads/` → Cloudinary | ❌ posts cũ còn URL local, mới đi Cloudinary |

Đề xuất cải tiến + chi tiết kỹ thuật xem trong từng README subproject.

## Triết lý

Sample project ưu tiên:
1. **Pattern đúng > tính năng đủ**: thà ít feature mà code chuẩn, dễ học, hơn là 20 feature spaghetti
2. **End-to-end realistic**: backend thực, không mock — auth thật, socket thật, WebRTC thật
3. **Đa platform demo**: mobile + web chia sẻ cùng backend chứng minh kiến trúc đúng

## License

Sample/educational. Không có license chính thức — vui lòng không copy nguyên xi cho commercial product.
