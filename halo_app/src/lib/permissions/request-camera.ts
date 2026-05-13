import { Camera } from 'react-native-vision-camera';

export async function requestCameraAndMicrophone() {
  await Camera.requestCameraPermission();
  await Camera.requestMicrophonePermission();
}
