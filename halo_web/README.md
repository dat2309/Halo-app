# Halo Web — Test client for chat & video call

Tối giản React + Vite app để test 2 tính năng chính qua **trình duyệt thay vì mobile**:

- Login bằng email/phone + password
- Chat 1-1 với danh sách conversation + thread realtime
- **Video** và **audio-only** call 1-1 (WebRTC native trình duyệt, signaling qua Socket.IO)
- **Screen sharing** trong call (chỉ web có — mobile chưa support)
- Call quality indicator (3 vạch sóng RTT)
- Call duration timer
- Missed call message render trong chat
- ICE restart khi mất kết nối

Hữu ích khi:
- Test với 2 user mà không cần 2 thiết bị thật
- Debug WebRTC nhanh (DevTools, `chrome://webrtc-internals`)
- Demo flow chat/call cho team không cài app mobile
- Test screen share (mobile chưa làm được)

## Yêu cầu

- Node 20+, pnpm hoặc npm
- Backend chạy ở `http://localhost:3000/api` (hoặc đổi qua env)
- Webcam + microphone (cho video call test)
- Chrome / Edge / Firefox bản mới (test trên Chrome 120+)

## Setup

```bash
cd halo_web
pnpm install        # (hoặc npm install)
cp .env.example .env
# Sửa VITE_API_URL nếu backend không ở port mặc định
pnpm dev
```

Mở http://localhost:5173 — đăng nhập với account đã tồn tại trên backend.

## Test gọi giữa 2 trình duyệt

1. Mở 2 cửa sổ Chrome — 1 cửa sổ Normal, 1 cửa sổ **Incognito** (để có 2 phiên đăng nhập độc lập, không share localStorage)
2. Login 2 user khác nhau ở 2 cửa sổ
3. Chọn 1 conversation cùng kết bạn nhau
4. Bấm **📹** (video) hoặc **📞** (audio) ở cửa sổ A → cửa sổ B sẽ thấy modal incoming với nút Accept/Decline
5. Cả 2 cửa sổ hiển thị video/audio — webcam/mic laptop dùng chung nhưng 2 stream độc lập

### Test screen sharing

Trong cuộc gọi video, bấm **🖥 Share screen** → Chrome hỏi chọn screen/window/tab → bên kia thấy màn hình thay vì webcam. Bấm "Stop sharing" trên thanh Chrome hoặc button "🛑 Stop sharing" trong app → tự swap về webcam.

## Test gọi web ↔ mobile

1. Login user A trên web (browser)
2. Login user B trên app mobile (custom dev client đã build)
3. Đảm bảo 2 user đã add friend nhau
4. Một bên start call → bên còn lại nhận ringing → accept → video 2 chiều

## Debug

- DevTools Console: log đầy đủ `[Socket] connected`, `[ICE local] candidate:... typ relay ...`, `[PC state] ...`
- `chrome://webrtc-internals` — Chrome built-in tool xem chi tiết peer connection, ICE candidates, RTP stats
- Network tab → WebSocket frames thấy socket events `chat:send`, `call:invite`, etc.

## Kiến trúc

```
src/
├── App.tsx               # Auth gate + providers
├── main.tsx              # Vite entry
├── lib/
│   ├── api.ts            # axios + JWT interceptor + localStorage token
│   ├── auth.tsx          # AuthProvider, useAuth, login/logout
│   ├── socket.ts         # Socket.IO client singleton
│   └── call.tsx          # CallProvider — WebRTC peer connection + signaling
├── pages/
│   ├── Login.tsx
│   └── Chat.tsx          # 2-column layout (list + thread)
└── components/
    ├── ConversationList.tsx
    ├── ChatThread.tsx
    └── CallOverlay.tsx   # Full-screen modal khi đang call
```

## Hạn chế đã biết

- Chỉ chat **text** — không gửi ảnh/video (đủ cho test signaling)
- Không có register UI — phải tạo user qua app mobile hoặc Swagger UI (`/api/docs` → POST `/auth/register`)
- Không support push notification (browser tab phải đang mở để nhận `call:incoming`)
- Permissions: Chrome sẽ hỏi quyền camera/mic lần đầu start call. Trên `http://` ngoài `localhost` thì Chrome có thể block — dùng `localhost` hoặc deploy HTTPS
- Screen share **chỉ tab/window/màn hình** — không capture audio tab (chromium limitation)

## Reference

- Root project: [../README.md](../README.md)
- Backend: [../backend/README.md](../backend/README.md)
- Mobile: [../halo_app/README.md](../halo_app/README.md)
- Video call deep dive: [../docs/VIDEO_CALL.md](../docs/VIDEO_CALL.md)

## Cleanup

Web không tạo data riêng — mọi conversation/message/call đều dùng chung backend Mongo với app mobile. Đăng xuất chỉ xoá localStorage token.
