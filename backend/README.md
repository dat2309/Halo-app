# Halo Backend

REST API + WebSocket gateway cho Halo app. NestJS 10 + MongoDB + Socket.IO + Cloudinary.

## Quick start

```bash
pnpm install
cp .env.example .env             # rồi điền secrets thật
pnpm run start:dev
```

- API: http://localhost:3000/api
- Swagger UI: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health

## Environment variables

Toàn bộ trong [.env.example](.env.example). Bắt buộc:

| Variable | Mô tả |
|----------|-------|
| `MONGODB_URI` | Connection string MongoDB (Atlas hoặc local) |
| `JWT_SECRET` | Secret ký JWT — **PHẢI** đổi sang chuỗi random dài cho production |
| `JWT_EXPIRES_IN` | TTL JWT (vd `1h`, `7d`) |
| `PORT` | Port server lắng nghe (default 3000) |
| `BASE_URL` | Base URL của server (cho legacy upload paths) |
| `CLOUDINARY_CLOUD_NAME` | Cloud name từ https://cloudinary.com/console |
| `CLOUDINARY_API_KEY` | API key Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret Cloudinary (cấp tại Dashboard) |
| `CLOUDINARY_FOLDER` | Tên folder để tổ chức assets (default `halo`) |

Optional:

| Variable | Default | Mô tả |
|----------|---------|-------|
| `METERED_API_KEY` | — | Nếu set → dùng Metered managed TURN thay OpenRelay |
| `METERED_SUBDOMAIN` | — | Subdomain Metered (vd `halo`) |
| `DISABLE_TURN` | `false` | Set `true` để chỉ dùng STUN (test cùng wifi) |

## Scripts

```bash
pnpm run start              # production mode (cần build trước)
pnpm run start:dev          # dev mode, hot reload
pnpm run start:debug        # debug mode (port 9229)
pnpm run start:prod         # chạy build/dist
pnpm run build              # compile TypeScript → dist/
pnpm run lint               # ESLint fix
pnpm run test               # unit tests
pnpm run test:e2e           # e2e tests
pnpm run test:cov           # coverage
```

## Architecture

### Modules

```
src/modules/
├── auth/           POST /auth/login, /register, /refresh; GET /auth/me
├── user/           GET /user/profile, /users/lookup, /users/search, /users/:id/profile, PATCH /user/profile
├── friend/         GET /friends, /friends/pending; POST /friends/request, /friends/:id/accept, /friends/:id/decline; DELETE /friends/:id
├── post/           GET /posts (feed), /posts/discover, /posts/user/:id, /posts/:id; POST /posts; DELETE /posts/:id
├── comment/        GET /posts/:postId/comments; POST /posts/:postId/comments; DELETE /posts/:postId/comments/:id
├── reaction/       GET /posts/:postId/reactions; POST /posts/:postId/reactions (toggle)
├── chat/           GET /chat/conversations, /chat/conversations/:id/messages; POST /chat/conversations, /chat/conversations/:id/read
├── call/           GET /call/history, /call/ice-servers
├── calendar/       GET /calendar, /calendar/upcoming, /calendar/summary, /calendar/:id; POST/PATCH/DELETE /calendar/:id
├── finance/        GET /finance, /finance/summary, /finance/calendar, /finance/:id; POST/PATCH/DELETE /finance/:id
├── upload/         POST /upload (multipart, Cloudinary)
├── socket/         unified WebSocket gateway (chat + call + feed broadcasts)
└── health/         GET /health
```

### Socket events

Tất cả sự kiện realtime đi qua một gateway tại [src/modules/socket/socket.gateway.ts](src/modules/socket/socket.gateway.ts). Auth qua JWT trong handshake `auth.token`. Sau khi auth thành công, socket join phòng `user:{userId}`.

**Client → Server (chat)**
- `chat:send` `{ conversationId, type, content?, mediaUrl? }`
- `chat:typing` `{ conversationId, isTyping }`
- `chat:read` `{ conversationId, messageId? }`

**Client → Server (call)**
- `call:invite` `{ calleeId, offerSdp, mode? }`
- `call:accept` `{ callSessionId, answerSdp }`
- `call:decline` `{ callSessionId }`
- `call:end` `{ callSessionId }`
- `call:ice` `{ callSessionId, candidate }`
- `call:track_state` `{ callSessionId, muted?, cameraOff? }`
- `call:restart_offer` `{ callSessionId, offerSdp }` (ICE restart)
- `call:restart_answer` `{ callSessionId, answerSdp }`

**Server → Client**
- `chat:message`, `chat:typing`, `chat:read`, `chat:conversation_updated`
- `call:incoming`, `call:ringing`, `call:accepted`, `call:declined`, `call:ended`, `call:ice`, `call:offline`, `call:busy`, `call:track_state`, `call:restart_offer`, `call:restart_answer`
- `post:created`, `comment:updated`, `reaction:updated`
- `calendar:created`, `calendar:updated`, `calendar:deleted` (private — chỉ owner room)
- `finance:created`, `finance:updated`, `finance:deleted` (private)

Chi tiết flow signaling: [docs/VIDEO_CALL.md](../docs/VIDEO_CALL.md).

### Global behaviors

| Layer | File | Mục đích |
|-------|------|----------|
| Filter | `common/filters/all-exceptions.filter.ts` | Catch mọi exception → BaseResponse format |
| Interceptor | `common/interceptors/transform.interceptor.ts` | Wrap response `{success, data}` → `{status, message, data}` |
| Middleware | `common/middleware/http-logger.middleware.ts` | Log mỗi request với method, URL, status, duration, body, response |
| Guard | `modules/auth/guards/jwt-auth.guard.ts` | Global JWT guard — opt-out bằng `@Public()` decorator |
| Pipe | `main.ts` ValidationPipe | class-validator, stopAtFirstError, transform |

## Database

### Schemas
- `User` — email, phone, password (bcrypt), username, name, avatar, bio
- `Post` — userId, type (image/video), mediaUrl, caption, visibility, reactionCount, commentCount
- `Comment` — postId, userId, content, parentId (nested)
- `Reaction` — postId, userId, type
- `Friend` — requesterId, addresseeId, status (pending/accepted/declined)
- `Conversation` — participants[2], lastMessage, lastMessageAt, unreadCounts map
- `Message` — conversationId, senderId, type (text/image/video), content/mediaUrl, readBy[]
- `CallSession` — callerId, calleeId, mode (audio/video), status, startedAt, endedAt
- `CalendarEvent` — userId, title, description, startDate, endDate, color, reminder
- `FinanceTransaction` — userId, type (income/expense), amount, category, note, date, receiptImageUrl

### Indexes quan trọng
- `User.email`, `User.phone`, `User.username` — unique
- `Conversation.participants` — composite cho lookup pair
- `Message.conversationId + createdAt` — cho cursor pagination
- `CallSession.callerId/calleeId + status` — cho `isUserBusy` check

## Cloudinary

Upload pipeline:
1. Client POST `multipart/form-data` lên `/api/upload`
2. Multer giữ file trong memory (50MB limit)
3. `UploadService` stream lên Cloudinary qua `upload_stream()`
4. Response trả về `{ url, publicId, resourceType, format, bytes, ... }`
5. Cloudinary tự transcode video (eager async) sang format chuẩn

Whitelist MIME: `image/{jpeg,png,gif,webp,heic,heif}`, `video/{mp4,quicktime,x-msvideo,webm}`.

## TURN/STUN cho WebRTC

`GET /call/ice-servers` trả về ICE servers theo thứ tự ưu tiên:
1. **Metered managed** (nếu config `METERED_API_KEY` + `METERED_SUBDOMAIN`)
2. **OpenRelay** free TURN — default
3. **STUN only** nếu `DISABLE_TURN=true`

Chi tiết: [docs/VIDEO_CALL.md §6](../docs/VIDEO_CALL.md).

## Logging

`HttpLoggerMiddleware` log mọi request:
```
[Nest] HTTP   POST http://localhost:3000/api/auth/login 200 256b 142.3ms ip=...
[Nest] HTTP     body: { "identifier": "user@example.com", "password": "***" }
[Nest] HTTP     response: { "status": 200, "data": { "accessToken": "eyJh…z890", ... } }
```

Token + password tự động mask. Skip `/api/health`, `/api/docs`, `/uploads`.

## Khoảng trống

- **Không có rate limiting** — production cần `@nestjs/throttler` cho auth/upload
- **Không có helmet** — production cần security headers
- **CORS `origin: *`** — production phải allowlist domain cụ thể
- **Không có tests** — chưa viết `*.spec.ts` cho service nào
- **Không có Dockerfile** — deploy thủ công hoặc tự thêm
- **Notifications module** — chưa có (push notification gap)

## Reference

- Mobile app: [../halo_app/README.md](../halo_app/README.md)
- Web test client: [../halo_web/README.md](../halo_web/README.md)
- Video call deep dive: [../docs/VIDEO_CALL.md](../docs/VIDEO_CALL.md)
- API explorer: http://localhost:3000/api/docs
