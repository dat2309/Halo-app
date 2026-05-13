import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ResizeMode, Video } from 'expo-av';
import { useFocusEffect, useRouter } from 'expo-router';
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Keyboard,
    KeyboardEvent,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useMicrophonePermission,
} from 'react-native-vision-camera';

import { useAddPost, useUpload } from '@/api';
import { FocusAwareStatusBar, Image, Text, View } from '@/components/ui';
import { translate } from '@/lib';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_VIDEO_SECONDS = 30;
type CaptureKind = 'image' | 'video';
type Mode = 'photo' | 'video';

function getFileUri(path: string): string {
    if (path.startsWith('file://')) return path;
    if (Platform.OS === 'android') return `file://${path}`;
    return path;
}

export default function CameraScreen() {
    const cameraRef = useRef<Camera>(null);
    const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
    const device = useCameraDevice(cameraPosition);
    const router = useRouter();

    const { hasPermission: hasCamPerm, requestPermission: reqCamPerm } =
        useCameraPermission();
    const { hasPermission: hasMicPerm, requestPermission: reqMicPerm } =
        useMicrophonePermission();

    const [mode, setMode] = useState<Mode>('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [capturedKind, setCapturedKind] = useState<CaptureKind>('image');
    const [isPhotoReady, setIsPhotoReady] = useState(false);
    const [caption, setCaption] = useState('');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(20);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { mutateAsync: upload, isPending: uploading } = useUpload();
    const { mutateAsync: addPost, isPending: posting } = useAddPost();

    useEffect(() => {
        if (!hasCamPerm) reqCamPerm();
    }, [hasCamPerm, reqCamPerm]);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            'keyboardWillShow',
            (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height + 20)
        );
        const hideSub = Keyboard.addListener('keyboardWillHide', () =>
            setKeyboardHeight(20)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const stopTimer = useCallback(() => {
        if (recordTimer.current) {
            clearInterval(recordTimer.current);
            recordTimer.current = null;
        }
    }, []);

    const resetCapture = useCallback(() => {
        setCapturedUri(null);
        setCapturedKind('image');
        setCaption('');
        setIsPhotoReady(false);
        setIsPrivate(false);
        fadeAnim.setValue(0);
        setRecordSeconds(0);
        stopTimer();
    }, [fadeAnim, stopTimer]);

    useFocusEffect(
        useCallback(() => {
            return () => resetCapture();
        }, [resetCapture])
    );

    const ensureMicPermission = useCallback(async () => {
        if (hasMicPerm) return true;
        const granted = await reqMicPerm();
        if (!granted) {
            Alert.alert(
                translate('camera.permission_needed_title'),
                translate('camera.permission_microphone_message')
            );
        }
        return granted;
    }, [hasMicPerm, reqMicPerm]);

    const handleSwitchMode = async (next: Mode) => {
        if (next === mode || isRecording) return;
        if (next === 'video') {
            const ok = await ensureMicPermission();
            if (!ok) return;
        }
        setMode(next);
    };

    const handleCapturePhoto = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePhoto();
            setCapturedKind('image');
            setCapturedUri(getFileUri(photo.path));
            setIsPhotoReady(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } catch (e: any) {
            setCameraError(e?.message ?? 'Capture failed');
        }
    };

    const startVideoRecording = async () => {
        if (!cameraRef.current) return;
        const ok = await ensureMicPermission();
        if (!ok) return;

        try {
            setIsRecording(true);
            setRecordSeconds(0);
            recordTimer.current = setInterval(() => {
                setRecordSeconds((s) => {
                    if (s + 1 >= MAX_VIDEO_SECONDS) {
                        stopVideoRecording();
                        return MAX_VIDEO_SECONDS;
                    }
                    return s + 1;
                });
            }, 1000);

            cameraRef.current.startRecording({
                onRecordingFinished: (video) => {
                    stopTimer();
                    setIsRecording(false);
                    setCapturedKind('video');
                    setCapturedUri(getFileUri(video.path));
                    setIsPhotoReady(true);
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                },
                onRecordingError: (error) => {
                    stopTimer();
                    setIsRecording(false);
                    setCameraError(error.message);
                },
            });
        } catch (e: any) {
            stopTimer();
            setIsRecording(false);
            setCameraError(e?.message ?? 'Record failed');
        }
    };

    const stopVideoRecording = async () => {
        if (!cameraRef.current || !isRecording) return;
        try {
            await cameraRef.current.stopRecording();
        } catch (e: any) {
            stopTimer();
            setIsRecording(false);
            setCameraError(e?.message ?? 'Stop failed');
        }
    };

    const handleCaptureButton = () => {
        if (mode === 'photo') {
            handleCapturePhoto();
            return;
        }
        if (isRecording) stopVideoRecording();
        else startVideoRecording();
    };

    const handleSend = async () => {
        if (!capturedUri) return;
        const isVideo = capturedKind === 'video';
        const uploaded = await upload({
            uri: capturedUri,
            type: isVideo ? 'video/mp4' : 'image/jpeg',
            name: isVideo ? 'video.mp4' : 'image.jpg',
        });
        await addPost({
            type: isVideo ? 'video' : 'image',
            mediaUrl: uploaded.url,
            caption: caption.trim() ? caption.trim() : undefined,
            visibility: isPrivate ? 'private' : 'public',
        } as any);
        resetCapture();
        router.replace('/');
    };

    const formatTimer = (s: number) =>
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const captureDisabled =
        uploading || posting || (!hasCamPerm && !capturedUri);

    return (
        <View className="flex-1 bg-black">
            <FocusAwareStatusBar />
            <KeyboardAwareScrollView
                enabled
                extraKeyboardSpace={40}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1, position: 'relative' }}
            >
                <View className="flex-1">
                    {/* Top bar */}
                    <View className="absolute top-0 left-0 right-0 z-10 px-6 pt-10 flex-row items-center justify-between">
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text className="text-2xl font-semibold text-white">✕</Text>
                        </TouchableOpacity>

                        {/* Mode toggle (hidden while previewing) */}
                        {!capturedUri && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                    padding: 4,
                                    borderRadius: 24,
                                    gap: 4,
                                }}
                            >
                                {(['photo', 'video'] as const).map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => handleSwitchMode(m)}
                                        disabled={isRecording}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 6,
                                            borderRadius: 20,
                                            backgroundColor:
                                                mode === m ? 'rgba(255,255,255,0.95)' : 'transparent',
                                            opacity: isRecording && mode !== m ? 0.4 : 1,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: mode === m ? '#000' : '#fff',
                                                fontWeight: '700',
                                                fontSize: 13,
                                            }}
                                        >
                                            {translate(`camera.${m}`)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => setIsPrivate((p) => !p)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: isPrivate
                                    ? 'rgba(255,200,0,0.3)'
                                    : 'rgba(255,255,255,0.15)',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                            }}
                        >
                            <Ionicons
                                name={isPrivate ? 'lock-closed' : 'lock-open'}
                                size={16}
                                color={isPrivate ? '#fbbf24' : 'white'}
                            />
                            <Text
                                style={{
                                    color: isPrivate ? '#fbbf24' : 'white',
                                    fontSize: 13,
                                    fontWeight: '600',
                                }}
                            >
                                {translate(isPrivate ? 'camera.private' : 'camera.public')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Camera / Preview */}
                    <View
                        style={{
                            height: SCREEN_HEIGHT * 0.75,
                            marginTop: 32,
                            marginHorizontal: 8,
                            borderRadius: 24,
                            overflow: 'hidden',
                            backgroundColor: 'black',
                        }}
                    >
                        {device && hasCamPerm && (
                            <Camera
                                ref={cameraRef}
                                style={{ flex: 1 }}
                                device={device}
                                isActive={!capturedUri}
                                photo={mode === 'photo'}
                                video={mode === 'video'}
                                audio={mode === 'video'}
                                onError={(error) => setCameraError(error.message)}
                            />
                        )}

                        {!hasCamPerm && !capturedUri && (
                            <View className="absolute inset-0 items-center justify-center bg-black/80 px-10">
                                <Text className="text-center text-white font-medium mb-4">
                                    {translate('camera.permission_camera_message')}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => reqCamPerm()}
                                    className="bg-white/20 px-4 py-2 rounded-lg"
                                >
                                    <Text className="text-white">{translate('camera.retry')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {cameraError && (
                            <View className="absolute inset-0 items-center justify-center bg-black/80 px-10">
                                <Text className="text-center text-white font-medium mb-4">
                                    {cameraError.includes('invalid-output-configuration')
                                        ? translate('camera.error_invalid_output')
                                        : translate('camera.error_default', { message: cameraError })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setCameraError(null)}
                                    className="bg-white/20 px-4 py-2 rounded-lg"
                                >
                                    <Text className="text-white">{translate('camera.retry')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Recording indicator */}
                        {isRecording && (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: 16,
                                    alignSelf: 'center',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: 'rgba(0,0,0,0.55)',
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                }}
                            >
                                <View
                                    style={{
                                        height: 10,
                                        width: 10,
                                        borderRadius: 5,
                                        backgroundColor: '#ef4444',
                                    }}
                                />
                                <Text style={{ color: '#fff', fontWeight: '700' }}>
                                    {formatTimer(recordSeconds)} / {formatTimer(MAX_VIDEO_SECONDS)}
                                </Text>
                            </View>
                        )}

                        {/* Preview: image */}
                        {capturedUri && capturedKind === 'image' && isPhotoReady && (
                            <Animated.View
                                style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}
                            >
                                <Image
                                    source={{ uri: capturedUri }}
                                    style={{ flex: 1, width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            </Animated.View>
                        )}

                        {/* Preview: video */}
                        {capturedUri && capturedKind === 'video' && isPhotoReady && (
                            <Animated.View
                                style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}
                            >
                                <Video
                                    source={{ uri: capturedUri }}
                                    style={{ flex: 1, width: '100%', height: '100%' }}
                                    shouldPlay
                                    isLooping
                                    isMuted={false}
                                    resizeMode={ResizeMode.COVER}
                                />
                            </Animated.View>
                        )}

                        {/* Caption overlay */}
                        {capturedUri && isPhotoReady && (
                            <View
                                style={{
                                    position: 'absolute',
                                    bottom: 20 + keyboardHeight,
                                    left: 0,
                                    right: 0,
                                    alignItems: 'center',
                                }}
                            >
                                <BlurView
                                    intensity={50}
                                    tint="light"
                                    style={{
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        maxWidth: '70%',
                                        paddingHorizontal: 2,
                                        paddingVertical: 2,
                                        backgroundColor: 'rgba(255, 223, 0, 0.3)',
                                    }}
                                >
                                    <TextInput
                                        value={caption}
                                        onChangeText={setCaption}
                                        placeholder={translate('camera.note_placeholder')}
                                        placeholderTextColor="rgba(255,255,255,0.7)"
                                        multiline
                                        textAlign="center"
                                        textAlignVertical="center"
                                        style={{
                                            color: '#fff',
                                            fontSize: 14,
                                            lineHeight: 16,
                                            minHeight: 36,
                                            paddingVertical: 0,
                                        }}
                                    />
                                </BlurView>
                            </View>
                        )}
                    </View>

                    {/* Buttons */}
                    <View
                        style={{
                            height: SCREEN_HEIGHT * 0.2,
                            width: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {!capturedUri && (
                            <>
                                <TouchableOpacity
                                    onPress={handleCaptureButton}
                                    disabled={captureDisabled}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={{
                                            height: 80,
                                            width: 80,
                                            borderRadius: 40,
                                            borderWidth: 4,
                                            borderColor: isRecording ? '#ef4444' : 'white',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            backgroundColor: 'transparent',
                                        }}
                                    >
                                        <View
                                            style={
                                                isRecording
                                                    ? {
                                                          height: 32,
                                                          width: 32,
                                                          borderRadius: 6,
                                                          backgroundColor: '#ef4444',
                                                      }
                                                    : {
                                                          height: 60,
                                                          width: 60,
                                                          borderRadius: 30,
                                                          backgroundColor:
                                                              mode === 'video' ? '#ef4444' : 'white',
                                                      }
                                            }
                                        />
                                    </View>
                                </TouchableOpacity>

                                {mode === 'video' && !isRecording && (
                                    <Text
                                        style={{
                                            color: 'rgba(255,255,255,0.7)',
                                            fontSize: 11,
                                            marginTop: 8,
                                        }}
                                    >
                                        {translate('camera.max_duration_hint')}
                                    </Text>
                                )}

                                <TouchableOpacity
                                    onPress={() =>
                                        setCameraPosition((prev) =>
                                            prev === 'front' ? 'back' : 'front'
                                        )
                                    }
                                    activeOpacity={0.7}
                                    disabled={isRecording}
                                    style={{
                                        position: 'absolute',
                                        right: 16,
                                        height: 64,
                                        width: 64,
                                        borderRadius: 32,
                                        borderWidth: 2,
                                        borderColor: 'white',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: 'transparent',
                                        opacity: isRecording ? 0.4 : 1,
                                    }}
                                >
                                    <Ionicons name="camera-reverse" size={28} color="white" />
                                </TouchableOpacity>
                            </>
                        )}

                        {capturedUri && isPhotoReady && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: 40,
                                }}
                            >
                                <TouchableOpacity
                                    onPress={resetCapture}
                                    style={{
                                        height: 64,
                                        width: 64,
                                        borderRadius: 32,
                                        borderWidth: 2,
                                        borderColor: 'white',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Ionicons name="refresh" size={28} color="white" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSend}
                                    disabled={uploading || posting}
                                    style={{
                                        height: 64,
                                        width: 64,
                                        borderRadius: 32,
                                        borderWidth: 2,
                                        borderColor: 'yellow',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255,255,0,0.2)',
                                    }}
                                >
                                    {uploading || posting ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Ionicons name="send" size={28} color="white" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAwareScrollView>
        </View>
    );
}
