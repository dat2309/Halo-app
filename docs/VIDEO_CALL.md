# Video Call 1-1

Tài liệu kỹ thuật cho tính năng cuộc gọi video peer-to-peer trong Halo, từ luồng signaling tới triển khai code.

---

## 1. Tổng quan

| Hạng mục | Mô tả |
|----------|-------|
| Phạm vi | 1-1, audio + video, không group |
| Kiến trúc | WebRTC peer-to-peer (mesh), Socket.IO làm signaling |
| Media | Trực tiếp giữa 2 thiết bị, server **không** chạm media |
| Signaling | Socket.IO trên cùng gateway hiện có |
| TURN | OpenRelay (Metered) free mặc định, có thể nâng cấp |
| Lưu trữ | `CallSession` collection cho lịch sử + busy detection |
| Push notify | Chưa có — app phải đang mở để nhận `call:incoming` |

WebRTC tự lo media transport (DTLS-SRTP). Backend chỉ làm 3 việc:
1. Xác thực socket bằng JWT
2. Forward signaling messages (SDP offer/answer + ICE candidates)
3. Lưu/tra `CallSession` để biết user nào đang bận

---

## 2. Luồng tổng quát

```
   CALLER                  BACKEND (Socket.IO)              CALLEE
   ──────                  ───────────────────              ──────
   getUserMedia
   new RTCPeerConnection
   createOffer + setLocalDesc
       │
       │  call:invite { calleeId, offerSdp }
       ├────────────────────────────►
       │                              checkOnline + isBusy
       │                              createSession (status=ringing)
       │                              call:incoming  { callSessionId,
       │  call:ringing  { callSessionId,                  callerId, offerSdp }
       │     calleeId }              ────────────────────────►
       │◄─────────────────────                              │
       │                                                    │ user taps Accept
       │                                                    │ getUserMedia
       │                                                    │ setRemoteDesc(offer)
       │                                                    │ createAnswer
       │                                                    │ setLocalDesc(answer)
       │                              call:accept { callSessionId,
       │                                              answerSdp }
       │                              ◄────────────────────
       │                              markAccepted (status=active)
       │  call:accepted { answerSdp }
       │◄─────────────────────
       │ setRemoteDesc(answer)
       │ peerAccepted = true → flush buffered ICE
       │
       ├──── call:ice (n lần) ─────►  relay  ──────────────►
       │◄─── call:ice (n lần) ─────   relay  ◄──────────────
       │
       │ pc.connectionState = "connected"
       │ ★ Media flowing P2P (qua TURN nếu cần) ★
       │
       │                                       user taps End
       │                              call:end ◄─────────────
       │  call:ended
       │◄───────────────────── markEnded (status=ended)
       │
       │ cleanup
```

Caller emit ICE **trước** khi callee chấp nhận → backend không có ai để relay → caller **buffer** local ICE candidates đến khi nhận `call:accepted`, sau đó flush hết một lượt. Logic này nằm ở [CallProvider.flushOutgoingIce()](../halo_app/src/lib/call/CallProvider.tsx).

Tương tự: ICE candidate từ peer có thể tới **trước** khi `setRemoteDescription()` xong → buffer rồi flush ngay sau khi remote description set xong, qua [CallProvider.flushRemoteIce()](../halo_app/src/lib/call/CallProvider.tsx).

---

## 3. State machine phía app

```
        ┌──────┐
        │ idle │ ◄──────────────────────────────┐
        └──┬───┘                                │
           │ startCall(peerId)                  │ endCall / cleanup
           ▼                                    │
   ┌──────────────────┐                         │
   │ outgoing_ringing │── call:declined ────────┤
   └─────────┬────────┘── call:offline ─────────┤
             │            call:busy             │
             │ call:accepted                    │
             ▼                                  │
       ┌────────────┐                           │
       │ connecting │── connection failed ──────┤
       └─────┬──────┘                           │
             │ pc.connectionState='connected'   │
             ▼                                  │
        ┌────────┐                              │
        │ active │── call:ended ────────────────┘
        └────────┘

        ┌──────┐
        │ idle │ ── call:incoming ──► incoming_ringing
        └──────┘                              │ accept
                                              ▼
                                          connecting → active
                                              │ decline
                                              ▼
                                             idle
```

`CallStatus` được khai báo trong [CallProvider.tsx](../halo_app/src/lib/call/CallProvider.tsx):
```ts
type CallStatus =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'active';
```

[CallOverlay](../halo_app/src/components/call/CallOverlay.tsx) render khi `status !== 'idle'` — luôn full-screen Modal, layout đổi theo từng state.

---

## 4. Backend

### 4.1. Socket events (signaling)

Tất cả events nằm trong [socket.gateway.ts](../backend/src/modules/socket/socket.gateway.ts). Mọi handler bắt buộc có JWT auth (xác thực ở `handleConnection`).

**Client → Server**

| Event | Payload | Mục đích |
|-------|---------|----------|
| `call:invite` | `{ calleeId, offerSdp }` | Caller khởi tạo cuộc gọi |
| `call:accept` | `{ callSessionId, answerSdp }` | Callee chấp nhận |
| `call:decline` | `{ callSessionId }` | Callee từ chối |
| `call:end` | `{ callSessionId }` | Bên nào cũng có thể end |
| `call:ice` | `{ callSessionId, candidate }` | Trao đổi ICE candidate (2 chiều) |

**Server → Client**

| Event | Payload | Khi nào |
|-------|---------|---------|
| `call:ringing` | `{ callSessionId, calleeId }` | Phản hồi `call:invite` → caller |
| `call:incoming` | `{ callSessionId, callerId, offerSdp }` | Đẩy invite về callee |
| `call:accepted` | `{ callSessionId, answerSdp }` | Báo caller rằng callee đã accept |
| `call:declined` | `{ callSessionId }` | Báo caller rằng callee declined |
| `call:ended` | `{ callSessionId, reason }` | Báo bên còn lại rằng cuộc gọi end |
| `call:ice` | `{ callSessionId, candidate }` | Relay ICE candidate |
| `call:offline` | `{ calleeId }` | Callee không online |
| `call:busy` | `{ calleeId }` | Callee đang trong cuộc gọi khác |

### 4.2. Per-user rooms

Tại [socket.gateway.ts:handleConnection](../backend/src/modules/socket/socket.gateway.ts), sau khi verify JWT, socket join `user:{userId}`. Mọi signaling event chỉ được emit về đúng room của bên nhận:

```ts
this.emitToUser(data.calleeId, 'call:incoming', { ... });
```

Điều này tránh broadcast tới mọi user và đảm bảo riêng tư.

### 4.3. CallSession schema

[backend/src/modules/call/schemas/call-session.schema.ts](../backend/src/modules/call/schemas/call-session.schema.ts):

```ts
{
  _id, callerId, calleeId,
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'aborted',
  startedAt, endedAt,
  createdAt, updatedAt
}
```

`status` chuyển: `ringing` → `active` (khi accept) → `ended`/`declined`/`aborted`.

### 4.4. CallService

[backend/src/modules/call/call.service.ts](../backend/src/modules/call/call.service.ts) cung cấp:

- `isUserBusy(userId)` — kiểm tra user có session đang `ringing`/`active` không
- `createSession(callerId, calleeId)` — tạo session mới với status `ringing`
- `findActive(id)` — tra session đang `ringing`/`active`
- `markAccepted(id)` — set `active` + `startedAt`
- `markEnded(id, reason)` — set `ended`/`declined`/`aborted` + `endedAt`
- `abortActiveCallsForUser(userId)` — gọi khi user disconnect khỏi mọi socket: huỷ tất cả call đang dở
- `historyForUser(userId, limit)` — dùng cho `GET /call/history`

### 4.5. REST endpoints

| Endpoint | Mục đích |
|----------|----------|
| `GET /call/history?limit=30` | Lịch sử cuộc gọi gần đây của user |
| `GET /call/ice-servers` | Trả về STUN/TURN servers cho `new RTCPeerConnection` |

`/call/ice-servers` ưu tiên theo thứ tự:
1. **Metered managed** nếu có `METERED_API_KEY` + `METERED_SUBDOMAIN`
2. **OpenRelay** (free TURN công khai, default)
3. **STUN only** nếu `DISABLE_TURN=true`

Cache kết quả Metered 1 giờ để tránh hit API mỗi lần invite.

### 4.6. Auto-abort khi user mất kết nối

Trong [socket.gateway.ts:handleDisconnect](../backend/src/modules/socket/socket.gateway.ts), sau khi socket disconnect:
1. Kiểm tra user còn socket nào khác không (`isUserOnline`)
2. Nếu không còn: gọi `callService.abortActiveCallsForUser(userId)` để huỷ mọi session đang dở
3. Emit `call:ended` cho bên còn lại với `reason: 'peer_disconnected'`

Điều này xử lý case: user kill app khi đang call → bên kia tự động nhận thông báo kết thúc.

---

## 5. Mobile app

### 5.1. Kiến trúc

```
   app/_layout.tsx
       │
       │  <CallProvider>             ← context: state + actions
       │     <Children>              ← toàn bộ app
       │     <CallOverlay />         ← full-screen modal khi status != idle
       │  </CallProvider>
```

Hai khối chính:
- [`src/lib/call/CallProvider.tsx`](../halo_app/src/lib/call/CallProvider.tsx): **headless** — quản lý peer connection, media stream, signaling, state machine. Mount global ở root.
- [`src/components/call/CallOverlay.tsx`](../halo_app/src/components/call/CallOverlay.tsx): **view layer** — render Modal với `RTCView`, nút điều khiển. Đọc state qua `useCall()`.

### 5.2. CallProvider API

```ts
const {
  status,            // CallStatus
  callSessionId,     // string | null
  peerId,            // string | null  — userId của đối phương
  role,              // 'caller' | 'callee' | null
  localStream,       // MediaStream | null
  remoteStream,      // MediaStream | null
  isMuted,           // boolean
  isCameraOff,       // boolean
  error,             // 'offline' | 'busy' | 'declined' | message | null

  startCall,         // (peerId: string) => Promise<void>
  acceptIncoming,    // () => Promise<void>
  declineIncoming,   // () => void
  endCall,           // () => void
  toggleMute,        // () => void
  toggleCamera,      // () => void   (bật/tắt video track)
  switchCamera,      // () => void   (front ↔ back)
} = useCall();
```

### 5.3. Khởi tạo cuộc gọi (caller)

```ts
// Ví dụ trong chat thread header:
const { startCall } = useCall();
const onTapVideoCall = () => startCall(peerUserId);
```

Bên trong `startCall(peerId)` ([CallProvider.tsx](../halo_app/src/lib/call/CallProvider.tsx)):
1. Set `status = 'outgoing_ringing'`, `role = 'caller'`, `peerId`
2. Fetch ICE servers từ `/call/ice-servers`
3. `mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } })`
4. `new RTCPeerConnection({ iceServers })` + attach tracks
5. Gắn listener `icecandidate`, `track`, `connectionstatechange`
6. `createOffer()` + `setLocalDescription()`
7. Emit `call:invite` với `offerSdp`
8. Chờ `call:ringing` → lưu `callSessionId`
9. Chờ `call:accepted`:
   - `setRemoteDescription(answer)`
   - Đặt `peerAcceptedRef = true`
   - Flush buffered local ICE candidates
10. Chờ `pc.connectionState === 'connected'` → `status = 'active'`

### 5.4. Nhận cuộc gọi (callee)

`CallProvider` lắng nghe `call:incoming` ở mount-level (chỉ một lần khi app start):
- Set `status = 'incoming_ringing'`
- Lưu offer SDP trong ref
- `CallOverlay` tự hiện modal với 2 nút Accept/Decline

User bấm Accept → `acceptIncoming()`:
1. Set `status = 'connecting'`
2. Fetch ICE servers, getUserMedia, build peer connection
3. `setRemoteDescription(offer)`
4. Flush incoming ICE đã buffer
5. `createAnswer()` + `setLocalDescription()`
6. Set `peerAccepted = true` + `callSessionId` (đã biết từ payload)
7. Emit `call:accept` với `answerSdp`
8. Flush outgoing ICE
9. Chờ `connectionState === 'connected'` → `status = 'active'`

### 5.5. Cleanup

`endCall()`, `declineIncoming()`, hoặc nhận `call:ended` đều gọi `cleanup()`:
- `pc.close()`
- Stop tất cả tracks của `localStream`
- Reset toàn bộ state về `idle`
- Clear buffer refs

Quan trọng: phải `track.stop()` để giải phóng camera/mic phần cứng, nếu không icon đỏ "đang ghi" sẽ kẹt ở status bar.

### 5.6. CallOverlay

[CallOverlay.tsx](../halo_app/src/components/call/CallOverlay.tsx) render đúng UI theo `status`:

| Status | Hiển thị |
|--------|----------|
| `outgoing_ringing` | Avatar peer + "Đang đổ chuông..." + nút End (đỏ) |
| `incoming_ringing` | Avatar caller + "Cuộc gọi đến" + 2 nút Accept/Decline |
| `connecting` | Avatar + "Đang kết nối..." |
| `active` | Remote video full-screen + local self-view nhỏ ở góc + thanh điều khiển dưới (Mute / Camera off / Switch / End) |

Self-view dùng `mirror` prop để hiện ảnh gương (UX chuẩn).

### 5.7. Entry points

Hiện có 1 entry chính:
- **Chat thread**: nút video trên header — [`(app)/chat/[id].tsx`](../halo_app/src/app/(app)/chat/[id].tsx)

Để mở rộng: bất kỳ chỗ nào có `peerUserId` đều có thể gọi `useCall().startCall(peerId)`. Ví dụ:
- Nút "Call" trong public profile
- Long-press trên friend trong [friends.tsx](../halo_app/src/app/(app)/friends.tsx)
- Trong post (call author của post)

---

## 6. ICE / STUN / TURN

### 6.1. Tại sao cần TURN

- **STUN** cho biết public IP/port của thiết bị qua NAT đối xứng có thể đoán được.
- Trên **symmetric NAT** (rất phổ biến với 4G/CG-NAT của nhà mạng VN), STUN không đủ → cần TURN làm relay.
- Không có TURN, cross-network call thường fail ~30-50% trường hợp.

### 6.2. Cấu hình TURN

Mặc định **OpenRelay** miễn phí từ Metered, không cần signup, hard-coded credentials công khai:

```
turn:openrelay.metered.ca:80
turn:openrelay.metered.ca:443
turn:openrelay.metered.ca:443?transport=tcp
username: openrelayproject
credential: openrelayproject
```

Upgrade lên Metered managed (free 50GB/tháng) nếu cần ổn định hơn — thêm vào `backend/.env`:
```
METERED_API_KEY=xxxx
METERED_SUBDOMAIN=halo
```

Self-host coturn nếu muốn full control — xem `docs/TURN_SELFHOST.md` (chưa viết).

### 6.3. Verify TURN có hoạt động

Trong dev mode, mở Metro logs khi bấm Call. Tìm dòng:
```
[ICE local] candidate:... typ relay raddr ...
```

- `typ host` — local IP, dùng cho cùng wifi
- `typ srflx` — public IP qua STUN
- `typ relay` — đi qua TURN ★

Nếu chỉ thấy `host` + `srflx` mà call cross-network fail → TURN không reachable, cần kiểm tra firewall hoặc đổi sang Metered managed.

---

## 7. Test guide

### 7.1. Setup

1. Backend: `cd backend && pnpm install && pnpm run start:dev`
2. App: `cd halo_app && pnpm install && pnpm run prebuild:development`
3. **Build EAS dev client** (không chạy được trên Expo Go vì `react-native-webrtc` là native module):
   ```
   pnpm run build:development:ios       # hoặc :android
   ```

### 7.2. Smoke test (cùng wifi)

- 2 thiết bị thật, mỗi máy login 1 tài khoản khác nhau
- A: vào Friends → bấm icon Message bên cạnh B → mở chat thread
- A: bấm icon video trên header
- B: thấy CallOverlay modal incoming → bấm Accept
- 2 bên thấy remote video → call thành công

### 7.3. Cross-network test

- Máy A dùng 4G, máy B dùng wifi (hoặc ngược lại)
- Lặp lại flow như trên
- Quan sát log: phải có `typ relay` mới chắc TURN đang work

### 7.4. Edge case test

| Case | Expected |
|------|----------|
| Callee offline | Caller nhận `call:offline` → Alert "User offline" |
| Callee đang call người khác | Caller nhận `call:busy` → Alert "User busy" |
| Caller kill app trước khi callee accept | Callee modal tự đóng + `call:ended { reason: 'peer_disconnected' }` |
| Mạng caller chập chờn | `pc.connectionState` → `disconnected` → `failed` (chưa handle UI, sẽ stuck) |
| 2 user gọi nhau cùng lúc | Người sau nhận `call:busy` |

---

## 8. Giới hạn đã biết

1. **Không có push notification**: app phải đang foreground/background mới nhận được `call:incoming`. Nếu app bị kill → miss call. Hướng xử lý: tích hợp `expo-notifications` + APNs/FCM, hoặc native CallKit/ConnectionService (chưa làm — đã chốt skip).
2. **Reconnect logic chưa có**: khi `pc.connectionState` chuyển sang `disconnected`/`failed`, app không tự thử reconnect. Cần thêm `iceRestart` trong tương lai.
3. **Audio routing**: chưa wire bluetooth/loudspeaker switch. iOS mặc định ra earpiece khi có video — có thể cần `expo-av Audio.setAudioModeAsync` hoặc native module.
4. **Bandwidth adaptation**: không tự giảm video resolution khi mạng kém. WebRTC tự lo một phần nhưng có thể tinh chỉnh qua `RTCRtpSender.setParameters({ encodings: [...] })`.
5. **Đa thiết bị**: nếu user A login trên 2 máy, cả 2 đều nhận `call:incoming`. Bên nào accept trước thắng, bên còn lại sẽ thấy `call:ended` khi gateway gửi tới room. Hiện chấp nhận behavior này.
6. **Không có call recording / screen share** — out of scope.

---

## 9. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Cách khắc phục |
|-------------|------------------------|----------------|
| App crash khi bấm video | `react-native-webrtc` chưa link native | Chạy lại `pnpm run prebuild:development` + rebuild EAS dev client |
| Modal hiện nhưng không có video local | Quyền camera/mic bị deny | Vào Settings của OS, cấp lại quyền |
| Caller bấm xong nhưng không thấy gì | `call:incoming` không tới callee | Check socket auth — JWT hợp lệ? Callee online? Backend log có `[Socket] User {id} connected`? |
| Cùng wifi OK, 4G fail | NAT symmetric block | Kiểm tra log có `typ relay` không. Nếu không → upgrade lên Metered managed |
| Camera bị kẹt ở status bar sau khi end call | Không stop tracks | `cleanup()` phải gọi `track.stop()` cho mọi track |
| Echo / âm vang | `audio` track không được attach đúng AEC | Vision Camera mặc định đã có AEC; check `getUserMedia({ audio: true })` không bị override |
| `pc.connectionState` mãi không vào `connected` | ICE candidate exchange fail | Bật log ICE, check cả 2 bên thấy `typ relay` chưa; check firewall của TURN |

---

## 10. Tham chiếu

- File chính: [`backend/src/modules/socket/socket.gateway.ts`](../backend/src/modules/socket/socket.gateway.ts), [`backend/src/modules/call/`](../backend/src/modules/call/), [`halo_app/src/lib/call/CallProvider.tsx`](../halo_app/src/lib/call/CallProvider.tsx), [`halo_app/src/components/call/CallOverlay.tsx`](../halo_app/src/components/call/CallOverlay.tsx)
- WebRTC spec: https://www.w3.org/TR/webrtc/
- react-native-webrtc: https://github.com/react-native-webrtc/react-native-webrtc
- OpenRelay: https://www.metered.ca/tools/openrelay/
- coturn: https://github.com/coturn/coturn
