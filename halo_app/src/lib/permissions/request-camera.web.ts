/**
 * Web fallback — browser asks for permission inline when
 * `navigator.mediaDevices.getUserMedia()` is called, so we no-op here.
 */
export async function requestCameraAndMicrophone() {
  // no-op
}
