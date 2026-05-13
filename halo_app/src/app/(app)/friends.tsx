import { useMe, useFriends, usePendingRequests, useSearchUsers, useSendRequest, useAcceptRequest, useDeclineRequest, useUnfriend, useGetOrCreateConversation, type SearchUserDto } from "@/api";
import { GlassHeader } from "@/components/glass";
import { Input, colors } from "@/components/ui";
import { translate } from "@/lib";
import { Search, Copy, UserMinus, UserCheck, MessageCircle, UserPlus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import {
  Button,
  EmptyList,
  FocusAwareStatusBar,
  Text,
  Image,
} from '@/components/ui';
const TAB_BAR_HEIGHT = 80;

export default function FriendsScreen() {
    // const insets = useSafeAreaInsets();
    const contentPadding = TAB_BAR_HEIGHT + 20 + 20; // Hardcoded bottom inset

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
    const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());

    // Debounce: only fire the search 300ms after the user stops typing
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data: user } = useMe();
    const username = user?.data?.username || '';
    const myId = user?.data?._id;

    const { data: friends, refetch: refetchFriends } = useFriends();
    const { data: pendingRequests, refetch: refetchPending } = usePendingRequests();

    const {
        data: searchData,
        isFetching: isSearching,
    } = useSearchUsers({
        variables: { q: searchQuery, limit: 20 },
        enabled: searchQuery.length > 0,
    });
    const searchResults: SearchUserDto[] =
        searchData?.pages?.flatMap((p) => p.list) ?? [];

    const { mutateAsync: sendRequest } = useSendRequest();
    const { mutateAsync: acceptRequest } = useAcceptRequest();
    const { mutateAsync: declineRequest } = useDeclineRequest();
    const { mutateAsync: unfriendAction } = useUnfriend();
    const { mutateAsync: openConversation } = useGetOrCreateConversation();
    const router = useRouter();

    const openChatWithFriend = async (friendId: string) => {
        try {
            const conv = await openConversation({ peerId: friendId });
            router.push({
                pathname: `/chat/${conv._id}` as any,
                params: { peerId: friendId },
            });
        } catch (e: any) {
            Alert.alert(
                translate('common.error'),
                e?.response?.data?.message || translate('chat.send_failed')
            );
        }
    };

    const handleSendRequest = async (target: SearchUserDto) => {
        try {
            await sendRequest({ username: target.username } as any);
            setSentRequestIds((prev) => new Set(prev).add(target._id));
        } catch (e: any) {
            Alert.alert(
                translate('common.error'),
                e?.response?.data?.message || translate('friends.send_failed')
            );
        }
    };

    const friendIds = new Set((friends ?? []).map((f: any) => f?._id));

    const handleAccept = async (requestId: string) => {
        try {
            await acceptRequest({ requestId } as any);
            refetchFriends();
            refetchPending();
        } catch (e) {
            Alert.alert(
                translate('common.error'),
                translate('friends.accept_failed')
            );
        }
    };

    const handleDecline = async (requestId: string) => {
        try {
            await declineRequest({ requestId } as any);
            refetchPending();
        } catch (e) {
            Alert.alert(
                translate('common.error'),
                translate('friends.decline_failed')
            );
        }
    };

    const handleUnfriend = (friendId: string, name: string) => {
        Alert.alert(
            translate('friends.unfriend_title'),
            translate('friends.unfriend_message', { name }),
            [
                { text: translate('common.cancel'), style: 'cancel' },
                {
                    text: translate('friends.unfriend'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await unfriendAction({ friendId } as any);
                            refetchFriends();
                        } catch (e) {
                            Alert.alert(
                                translate('common.error'),
                                translate('friends.unfriend_failed')
                            );
                        }
                    },
                },
            ]
        );
    };

    const copyInviteLink = async () => {
        if (!username) {
            Alert.alert(
                translate('common.error'),
                translate('friends.username_missing')
            );
            return;
        }
        try {
            await Clipboard.setStringAsync(`halo://invite?u=${username}`);
            Alert.alert(
                translate('friends.copied_title'),
                translate('friends.copied_message')
            );
        } catch (e) {
            Alert.alert(
                translate('common.error'),
                translate('friends.copy_failed')
            );
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <GlassHeader title="Friends" textColor="text-black dark:text-white" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: contentPadding }}
                className="px-4"
                keyboardShouldPersistTaps="always"
            >
                {/* Search Bar */}
                <View className="mt-6 mb-4">
                    <Text className="text-gray-500 dark:text-gray-400 mb-2 ml-1 text-sm font-medium">FIND FRIENDS</Text>
                    <View className="flex-row items-center gap-2">
                        <View className="flex-1 flex-row items-center bg-gray-100 dark:bg-neutral-900 rounded-2xl px-3 h-12">
                            <Search size={18} color="#9ca3af" />
                            <Input
                                placeholder="Search by name or username"
                                value={searchInput}
                                onChangeText={setSearchInput}
                                autoCapitalize="none"
                                returnKeyType="search"
                                className="flex-1 ml-2 border-none bg-transparent h-12"
                            />
                            {isSearching ? (
                                <ActivityIndicator size="small" color="#9ca3af" />
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Search Results */}
                {searchQuery.length > 0 ? (
                    <View className="mb-6">
                        {searchResults.length === 0 && !isSearching ? (
                            <View className="items-center py-8">
                                <Text className="text-gray-400">
                                    {translate('friends.not_found_message')}
                                </Text>
                            </View>
                        ) : (
                            searchResults
                                .filter((u) => u._id !== myId)
                                .map((u) => {
                                    const isFriend = friendIds.has(u._id);
                                    const isSent = sentRequestIds.has(u._id);
                                    return (
                                        <Pressable
                                            key={u._id}
                                            onPress={() => router.push(`/user/${u._id}` as any)}
                                            className="flex-row items-center justify-between bg-gray-50 dark:bg-neutral-900 p-3 rounded-2xl mb-2"
                                        >
                                            <View className="flex-row items-center gap-3 flex-1">
                                                <View className="h-11 w-11 rounded-full bg-gray-200 overflow-hidden">
                                                    {u.avatar ? (
                                                        <Image source={{ uri: u.avatar }} className="h-full w-full" />
                                                    ) : (
                                                        <View className="h-full w-full items-center justify-center">
                                                            <Text className="text-base text-gray-400">{u.name?.[0] ?? '?'}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-black dark:text-white font-semibold" numberOfLines={1}>
                                                        {u.name || u.username}
                                                    </Text>
                                                    <Text className="text-gray-500 text-xs" numberOfLines={1}>
                                                        @{u.username}
                                                    </Text>
                                                </View>
                                            </View>
                                            {isFriend ? (
                                                <Text className="text-gray-400 text-xs px-2">Friend</Text>
                                            ) : isSent ? (
                                                <Text className="text-gray-400 text-xs px-2">Sent</Text>
                                            ) : (
                                                <Pressable
                                                    onPress={(e) => {
                                                        e.stopPropagation?.();
                                                        handleSendRequest(u);
                                                    }}
                                                    className="bg-yellow-400 px-3 py-2 rounded-xl flex-row items-center gap-1"
                                                    hitSlop={8}
                                                >
                                                    <UserPlus size={14} color="#000" />
                                                    <Text className="text-black text-xs font-bold">Add</Text>
                                                </Pressable>
                                            )}
                                        </Pressable>
                                    );
                                })
                        )}
                    </View>
                ) : null}

                {/* Invite Section */}
                <View className="mb-8 flex-row gap-3">
                    <Pressable
                        onPress={copyInviteLink}
                        className="flex-1 bg-yellow-400/10 dark:bg-yellow-400/20 border border-yellow-400/30 rounded-3xl p-4 flex-row items-center justify-center gap-2"
                    >
                        <Copy size={18} color="#facc15" />
                        <Text className="text-yellow-600 dark:text-yellow-400 font-bold">Copy Link</Text>
                    </Pressable>
                    {/* <Pressable
                        onPress={() => qrModal.present()}
                        className="flex-1 bg-purple-400/10 dark:bg-purple-400/20 border border-purple-400/30 rounded-3xl p-4 flex-row items-center justify-center gap-2"
                    >
                        <QrCode size={18} color="#a855f7" />
                        <Text className="text-purple-600 dark:text-purple-400 font-bold">QR Code</Text>
                    </Pressable> */}
                </View>

                {/* Tabs */}
                <View className="flex-row mb-6 bg-gray-100 dark:bg-neutral-900 p-1 rounded-2xl">
                    <Pressable
                        onPress={() => {
                            console.log('Friends tab pressed');
                            setActiveTab('friends');
                        }}
                        hitSlop={10}
                        className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'friends' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold ${activeTab === 'friends' ? 'text-black dark:text-white' : 'text-gray-500'}`}>
                            Friends ({friends?.length || 0})
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            console.log('Pending tab pressed');
                            setActiveTab('pending');
                        }}
                        hitSlop={10}
                        className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'pending' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold ${activeTab === 'pending' ? 'text-black dark:text-white' : 'text-gray-500'}`}>
                            Pending ({pendingRequests?.length || 0})
                        </Text>
                    </Pressable>
                </View>

                {/* List Content */}
                <View>
                    {activeTab === 'friends' ? (
                        friends?.length ? (
                            friends.map((friend) => (
                                <View
                                    key={friend._id}
                                    className="flex-row items-center justify-between bg-gray-50 dark:bg-neutral-900 p-4 rounded-3xl mb-3"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <View className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden">
                                            {friend?.avatar ? (
                                                <Image source={{ uri: friend.avatar }} className="h-full w-full" />
                                            ) : (
                                                <View className="h-full w-full items-center justify-center">
                                                    <Text className="text-lg text-gray-400">{friend?.name ? friend.name[0] : '?'}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View>
                                            <Text className="text-black dark:text-white font-bold">{friend?.name || 'Unknown'}</Text>
                                            <Text className="text-gray-500 text-sm">@{friend?.username || 'user'}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Pressable
                                            onPress={() => openChatWithFriend(friend?._id)}
                                            className="p-2"
                                            accessibilityLabel="Message"
                                        >
                                            <MessageCircle size={20} color="#facc15" />
                                        </Pressable>
                                        <Pressable onPress={() => handleUnfriend(friend?._id, friend?.name || '')} className="p-2">
                                            <UserMinus size={20} color="#ef4444" />
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View className="items-center py-10">
                                <Text className="text-gray-400">No friends yet. Start by inviting someone!</Text>
                            </View>
                        )
                    ) : (
                        pendingRequests?.length ? (
                            pendingRequests.map((req) => (
                                <View
                                    key={req._id}
                                    className="bg-gray-50 dark:bg-neutral-900 p-4 rounded-3xl mb-3"
                                >
                                    <View className="flex-row items-center justify-between mb-4">
                                        <View className="flex-row items-center gap-3">
                                            <View className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                                                {req?.requester?.avatar ? (
                                                    <Image source={{ uri: req.requester.avatar }} className="h-full w-full" />
                                                ) : (
                                                    <View className="h-full w-full items-center justify-center">
                                                        <Text className="text-base text-gray-400">{req?.requester?.name ? req.requester.name[0] : '?'}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View>
                                                <Text className="text-black dark:text-white font-bold">{req?.requester?.name || 'Unknown User'}</Text>
                                                <Text className="text-gray-500 text-xs">Requested friendship</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View className="flex-row gap-2">
                                        <Pressable
                                            onPress={() => handleAccept(req?._id)}
                                            className="flex-1 h-10 bg-black dark:bg-white rounded-xl items-center justify-center flex-row gap-2"
                                        >
                                            <UserCheck size={16} color={colors?.neutral ? colors.neutral[100] : '#fff'} />
                                            <Text className="text-white dark:text-black font-bold">Accept</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleDecline(req?._id)}
                                            className="flex-1 h-10 border border-gray-200 dark:border-neutral-800 rounded-xl items-center justify-center"
                                        >
                                            <Text className="text-gray-500 font-bold">Decline</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View className="items-center py-10">
                                <Text className="text-gray-400">No pending requests.</Text>
                            </View>
                        )
                    )}
                </View>
            </ScrollView>


            {/* <Modal
                ref={qrModal.ref}
                snapPoints={['50%']}
                style={{ backgroundColor: 'transparent' }}
            >
                <View className="flex-1 items-center justify-center p-6">
                    <View className="items-center bg-white p-8 rounded-4xl shadow-xl border border-gray-100">
                        <Text className="text-xl font-bold mb-2 text-black">My Code</Text>
                        <Text className="text-gray-500 mb-6 font-medium">@{username}</Text>

                        <View className="p-4 bg-white rounded-3xl shadow-sm border border-gray-100">
                            {username ? (
                                <QRCode
                                    value={`halo://invite?u=${username}`}
                                    size={200}
                                    color="black"
                                    backgroundColor="white"
                                />
                            ) : (
                                <ActivityIndicator />
                            )}
                        </View>

                        <Text className="text-center text-gray-400 mt-6 text-xs max-w-[200px]">
                            Scan this code to add me as a friend on Halo
                        </Text>
                    </View>
                </View>
            </Modal> */}
        </View >
    );
}
