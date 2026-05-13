import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
  recognizeReceiptText,
  SCAN_RECEIPT_SUPPORTED,
} from '@/lib/scan-receipt';

import {
  FinanceTransactionDto,
  useCreateFinance,
  useDeleteFinance,
  useFinance,
  useFinanceCalendar,
  useFinanceSummary,
  useUpdateFinance,
  useUpload,
} from '@/api';
import {
  GlassButton,
  GlassCard,
  GlassContainer,
  GlassHeader,
  GlassModal,
} from '@/components/glass';
import {
  Button,
  EmptyList,
  FocusAwareStatusBar,
  Image,
  Input,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { CategoryPieChart } from '@/components/finance/CategoryPieChart';
import { getSocket } from '@/lib/socket';
import { translate } from '@/lib';

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatInputMoney(text: string): string {
  const numeric = text.replace(/[^0-9]/g, '');
  if (!numeric) return '';
  return Number(numeric).toLocaleString('en-US');
}

function parseMoney(text: string): number {
  return Number(text.replace(/[^0-9]/g, ''));
}

/**
 * Extract the most likely total/amount from OCR text.
 * Strategies:
 * 1. Look for keywords like "total", "tổng", "thanh toán", "thành tiền" near a number
 * 2. Fall back to the largest number found
 */
function extractAmountFromText(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Normalize: replace dots/commas used as thousand separators
  // Vietnamese format: 1.000.000 or 1,000,000
  const parseNumber = (raw: string): number | null => {
    // Remove currency symbols
    let cleaned = raw.replace(/[đ₫VND$€]/gi, '').trim();
    // Handle "1.234.567" or "1,234,567" (thousand separators)
    if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/[.,]/g, '');
    }
    // Handle "1.234,56" format (European decimal)
    else if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    const n = Number(cleaned);
    return isNaN(n) || n <= 0 ? null : n;
  };

  const numberPattern = /[\d.,]+[\d]/g;

  // Strategy 1: Find amounts near keywords
  const keywords = /(?:t[oổ]ng|total|thanh\s*to[aá]n|th[aà]nh\s*ti[eề]n|grand\s*total|amount|sum|pay)/i;
  for (const line of lines) {
    if (keywords.test(line)) {
      const matches = line.match(numberPattern);
      if (matches) {
        for (const m of matches) {
          const val = parseNumber(m);
          if (val && val >= 1000) return val;
        }
      }
    }
  }

  // Strategy 2: Collect all numbers, return the largest one (likely the total)
  const allNumbers: number[] = [];
  for (const line of lines) {
    const matches = line.match(numberPattern);
    if (matches) {
      for (const m of matches) {
        const val = parseNumber(m);
        if (val && val >= 100) allNumbers.push(val);
      }
    }
  }

  if (allNumbers.length === 0) return null;
  return Math.max(...allNumbers);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fixed tab bar height (matches GlassBottomTab height)
const TAB_BAR_HEIGHT = 80;

export default function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const contentPadding = TAB_BAR_HEIGHT + insets.bottom;

  const [currentMonth, setCurrentMonth] = React.useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [viewMode, setViewMode] = React.useState<'list' | 'calendar'>('calendar');
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Yearly Summary for Chart
  const { data: summaryData, refetch: refetchSummary } = useFinanceSummary({
    variables: { year: currentMonth.getFullYear() },
  });

  // Monthly Transactions for List
  const { data: monthData, isPending, isError, refetch: refetchList } = useFinance({
    variables: {
      limit: 1000,
      startDate: startOfMonth(currentMonth).toISOString(),
      endDate: endOfMonth(currentMonth).toISOString(),
    },
  });

  // Calendar data
  const { data: calendarData, refetch: refetchCalendar } = useFinanceCalendar({
    variables: {
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth() + 1,
    },
  });

  const { mutateAsync: createFinance, isPending: creating } =
    useCreateFinance();
  const { mutateAsync: updateFinance, isPending: updatingTx } =
    useUpdateFinance();
  const { mutateAsync: deleteFinance } = useDeleteFinance();
  const { mutateAsync: uploadFile, isPending: uploading } = useUpload();

  const [editingTxId, setEditingTxId] = React.useState<string | null>(null);
  const editingDateRef = React.useRef<string | null>(null);

  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [note, setNote] = React.useState('');
  const [type, setType] =
    React.useState<FinanceTransactionDto['type']>('expense');
  const [receiptUri, setReceiptUri] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setType('expense');
    setReceiptUri(null);
    setScanning(false);
    setEditingTxId(null);
    editingDateRef.current = null;
    setShowModal(false);
  };

  const openEditTx = (tx: FinanceTransactionDto) => {
    setEditingTxId(tx._id);
    editingDateRef.current = tx.date;
    setAmount(tx.amount.toLocaleString('en-US'));
    setCategory(tx.category);
    setNote(tx.note ?? '');
    setType(tx.type);
    setReceiptUri(tx.receiptImageUrl ?? null);
    setShowModal(true);
  };

  const confirmDeleteTx = (id: string) => {
    Alert.alert(
      translate('finance.delete_title'),
      translate('finance.delete_message'),
      [
        { text: translate('common.cancel'), style: 'cancel' },
        {
          text: translate('finance.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFinance({ id });
              if (editingTxId === id) resetForm();
              refetch();
            } catch {
              Alert.alert(
                translate('common.error'),
                translate('finance.delete_failed')
              );
            }
          },
        },
      ]
    );
  };

  const scanReceipt = async (uri: string) => {
    if (!SCAN_RECEIPT_SUPPORTED) return;
    setScanning(true);
    try {
      const text = await recognizeReceiptText(uri);
      const extractedAmount = extractAmountFromText(text);
      if (extractedAmount) {
        setAmount(extractedAmount.toLocaleString('en-US'));
        Alert.alert(
          translate('finance.amount_detected_title'),
          translate('finance.amount_detected_message', {
            amount: extractedAmount.toLocaleString('en-US'),
          })
        );
      } else {
        Alert.alert(
          translate('finance.no_amount_title'),
          translate('finance.no_amount_message')
        );
      }
    } catch {
      Alert.alert(
        translate('finance.scan_failed_title'),
        translate('finance.scan_failed_message')
      );
    } finally {
      setScanning(false);
    }
  };

  const refetch = React.useCallback(() => {
    refetchSummary();
    refetchList();
    refetchCalendar();
  }, [refetchSummary, refetchList, refetchCalendar]);

  const pickReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setReceiptUri(uri);
      scanReceipt(uri);
    }
  };

  const takeReceiptPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        translate('finance.permission_needed_title'),
        translate('finance.permission_camera_message')
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setReceiptUri(uri);
      scanReceipt(uri);
    }
  };

  const submit = async () => {
    const numericAmount = parseMoney(amount);
    if (!numericAmount || !category) return;

    let receiptImageUrl: string | undefined;
    // Upload only when user picked a NEW local file (file:// / content://).
    // For edit, keep existing remote URL untouched.
    if (receiptUri && /^(file:|content:)/i.test(receiptUri)) {
      const uploaded = await uploadFile({
        uri: receiptUri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });
      receiptImageUrl = uploaded.url;
    } else if (receiptUri) {
      receiptImageUrl = receiptUri;
    }

    const payload = {
      amount: numericAmount,
      category,
      note,
      type,
      date: editingDateRef.current ?? new Date().toISOString(),
      receiptImageUrl,
    };

    try {
      if (editingTxId) {
        await updateFinance({ id: editingTxId, ...payload });
      } else {
        await createFinance(payload);
      }
      resetForm();
      refetch();
    } catch {
      Alert.alert(
        translate('common.error'),
        translate('finance.update_failed')
      );
    }
  };

  useEffect(() => {
    let socketInstance: any;

    getSocket().then(socket => {
      if (!socket) return;
      socketInstance = socket;
      const handler = () => refetch();
      socket.on('finance:created', handler);
      socket.on('finance:updated', handler);
      socket.on('finance:deleted', handler);
    });

    return () => {
      if (socketInstance) {
        socketInstance.off('finance:created');
        socketInstance.off('finance:updated');
        socketInstance.off('finance:deleted');
      }
    };
  }, [refetch]);

  // Flatten paginated data
  const items = React.useMemo(() => {
    if (!monthData?.pages) return [];
    return monthData.pages.flatMap(page => page.list);
  }, [monthData]);
  const totalIncome = items
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = items
    .filter((i) => i.type === 'expense')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalBalance = totalIncome - totalExpense;

  const categoryBreakdown = React.useMemo(() => {
    const map = new Map<string, number>();
    items
      .filter((i) => i.type === 'expense')
      .forEach((i) => {
        map.set(i.category, (map.get(i.category) ?? 0) + i.amount);
      });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [items]);

  const yearSummary = React.useMemo(() => {
    const summary = summaryData ?? Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    const series = summary.map((m) => {
      let colorClass = 'bg-gray-300 dark:bg-white/30';
      if (m.income > m.expense) {
        colorClass = 'bg-green-500';
      } else if (m.expense > m.income) {
        colorClass = 'bg-red-500';
      }
      return {
        ...m,
        index: m.month - 1,
        label: `T${m.month}`,
        colorClass,
        total: Math.max(m.income, m.expense),
      };
    });

    const maxVal = Math.max(...series.map((s) => s.total), 1);
    return { series, maxVal };
  }, [summaryData]);

  // Calendar grid helpers
  const calendarGrid = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad to complete the last row
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [currentMonth]);

  const getDayKey = (day: number) => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedDayTransactions = React.useMemo(() => {
    if (!selectedDay || !calendarData) return [];
    return calendarData[selectedDay] ?? [];
  }, [selectedDay, calendarData]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
    setSelectedDay(null);
  };

  const selectMonth = (monthIndex: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(monthIndex);
    setCurrentMonth(newDate);
  };

  const goToToday = () => {
    setCurrentMonth(startOfMonth(new Date()));
    setSelectedDay(null);
  };

  return (
    <GlassContainer>
      <FocusAwareStatusBar />
      <GlassHeader
        title="Finance"
        right={<GlassButton label="Today" onPress={goToToday} />}
      />

      {/* Month Navigation */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => changeMonth(-1)}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10"
        >
          <Text className="text-xl text-black dark:text-white">{'<'}</Text>
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 dark:text-white">
          {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          onPress={() => changeMonth(1)}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10"
        >
          <Text className="text-xl text-black dark:text-white">{'>'}</Text>
        </Pressable>
      </View>

      {/* View Mode Toggle */}
      <View className="flex-row mx-4 mb-2 rounded-xl bg-gray-100 dark:bg-white/10 p-1">
        <Pressable
          onPress={() => setViewMode('list')}
          className={`flex-1 items-center py-2 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-white/20 shadow-sm' : ''}`}
        >
          <Text className={`font-semibold ${viewMode === 'list' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/40'}`}>
            List
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('calendar')}
          className={`flex-1 items-center py-2 rounded-lg ${viewMode === 'calendar' ? 'bg-white dark:bg-white/20 shadow-sm' : ''}`}
        >
          <Text className={`font-semibold ${viewMode === 'calendar' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/40'}`}>
            Calendar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: contentPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isPending}
            onRefresh={refetch}
            tintColor={Platform.OS === 'ios' ? '#000' : undefined}
          />
        }
      >
        {viewMode === 'list' ? (
          <>
            <View className="px-4 pt-2">
              <Text className="text-gray-500 dark:text-white/70">Monthly Balance</Text>
              <Text
                className="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(totalBalance)}
              </Text>

              <View className="mt-4 flex-col gap-3">
                <GlassCard className="p-4 bg-green-500/20 border-green-500/30">
                  <Text className="text-gray-500 dark:text-green-200/70">Income</Text>
                  <Text
                    className="mt-1 text-2xl font-bold text-green-500"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    +{formatCurrency(totalIncome)}
                  </Text>
                </GlassCard>
                <GlassCard className="p-4 bg-red-500/20 border-red-500/30">
                  <Text className="text-gray-500 dark:text-red-200/70">Expense</Text>
                  <Text
                    className="mt-1 text-2xl font-bold text-red-500"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    -{formatCurrency(totalExpense)}
                  </Text>
                </GlassCard>
              </View>

              <View className="mt-4">
                <Text className="mb-2 text-gray-500 dark:text-white/70">Yearly Spending Chart ({currentMonth.getFullYear()})</Text>
                <View className="h-44 rounded-3xl bg-gray-100/50 dark:bg-white/5 p-4">
                  <View className="flex-1 flex-row items-end justify-between">
                    {yearSummary.series.map((s) => {
                      const isSelected = s.index === currentMonth.getMonth();
                      const barHeight = Math.max(
                        6,
                        (s.total / yearSummary.maxVal) * 80
                      );

                      return (
                        <Pressable
                          key={s.index}
                          onPress={() => selectMonth(s.index)}
                          className="flex-1 items-center justify-end h-full relative"
                        >
                          <View
                            className={`${isSelected ? 'w-2.5' : 'w-1.5'} rounded-full ${s.colorClass} ${isSelected ? 'opacity-100 shadow-lg' : 'opacity-40'}`}
                            style={{ height: `${barHeight}%`, minHeight: 4 }}
                          />
                          <View className="mt-2 items-center h-6">
                            <Text
                              className={`text-[10px] ${isSelected ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-white/40'}`}
                              numberOfLines={1}
                            >
                              {s.label}
                            </Text>
                            {isSelected && (
                              <View className="absolute -bottom-1 h-1 w-1 rounded-full bg-blue-500" />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {categoryBreakdown.length > 0 && (
              <View className="mt-4 px-4">
                <Text className="mb-2 text-gray-500 dark:text-white/70">
                  Expense Breakdown
                </Text>
                <View className="rounded-3xl bg-gray-100/50 dark:bg-white/5 p-4">
                  <CategoryPieChart data={categoryBreakdown} />
                </View>
              </View>
            )}

            <View className="mt-4 flex-1 px-3">
              <Text className="px-1 pb-2 text-gray-500 dark:text-white/70">Transactions</Text>
              {isError ? (
                <Text className="text-red-500">Error loading finance</Text>
              ) : items.length === 0 ? (
                <EmptyList isLoading={isPending} />
              ) : (
                items.map((tx) => (
                  <TransactionItem
                    key={tx._id}
                    tx={tx}
                    onImagePress={setPreviewImage}
                    onPress={() => openEditTx(tx)}
                    onLongPress={() => confirmDeleteTx(tx._id)}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          /* Calendar View */
          <View className="px-4 pt-2">
            {/* Weekday headers */}
            <View className="flex-row mb-1">
              {WEEKDAYS.map((d) => (
                <View key={d} className="flex-1 items-center py-1">
                  <Text className="text-xs text-gray-400 dark:text-white/40 font-medium">{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View className="flex-row flex-wrap">
              {calendarGrid.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={{ width: '14.28%' }} className="aspect-square p-0.5" />;
                }

                const dayKey = getDayKey(day);
                const dayTxs = calendarData?.[dayKey] ?? [];
                const hasReceipt = dayTxs.some((tx) => tx.receiptImageUrl);
                const dayTotal = dayTxs.reduce((sum, tx) =>
                  sum + (tx.type === 'expense' ? -tx.amount : tx.amount), 0);
                const isSelected = selectedDay === dayKey;
                const isToday = dayKey === new Date().toISOString().split('T')[0];

                return (
                  <View key={dayKey} style={{ width: '14.28%' }} className="aspect-square p-0.5">
                    <Pressable
                      onPress={() => setSelectedDay(isSelected ? null : dayKey)}
                      className={`flex-1 rounded-xl items-center justify-center overflow-hidden ${
                        isSelected
                          ? 'bg-yellow-300 dark:bg-yellow-500/40'
                          : isToday
                            ? 'bg-blue-100 dark:bg-blue-500/20'
                            : 'bg-gray-50 dark:bg-white/5'
                      }`}
                    >
                      {hasReceipt ? (
                        // Show first receipt image as background
                        <>
                          <Image
                            source={{ uri: dayTxs.find((tx) => tx.receiptImageUrl)!.receiptImageUrl }}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                          <View className="absolute inset-0 bg-black/40" />
                          <Text className={`text-xs font-bold text-white z-10 ${isToday ? 'underline' : ''}`}>
                            {day}
                          </Text>
                          {dayTxs.length > 1 && (
                            <Text className="text-[9px] text-white/80 z-10">{dayTxs.length} items</Text>
                          )}
                        </>
                      ) : (
                        <>
                          <Text className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-black'
                              : isToday
                                ? 'text-blue-600 dark:text-blue-300'
                                : 'text-gray-700 dark:text-white/70'
                          }`}>
                            {day}
                          </Text>
                          {dayTxs.length > 0 && (
                            <Text className={`text-[9px] mt-0.5 font-medium ${
                              dayTotal >= 0 ? 'text-green-500' : 'text-red-400'
                            }`} numberOfLines={1}>
                              {dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}
                            </Text>
                          )}
                          {dayTxs.length > 0 && (
                            <View className="flex-row gap-0.5 mt-0.5">
                              {dayTxs.slice(0, 3).map((tx, i) => (
                                <View
                                  key={i}
                                  className={`h-1 w-1 rounded-full ${
                                    tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'
                                  }`}
                                />
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Selected day detail */}
            {selectedDay && (
              <View className="mt-4">
                <Text className="text-gray-500 dark:text-white/70 mb-2 font-medium">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>

                {selectedDayTransactions.length === 0 ? (
                  <Text className="text-gray-400 dark:text-white/30 text-center py-6">
                    No transactions
                  </Text>
                ) : (
                  <>
                    {/* Receipt images gallery */}
                    {selectedDayTransactions.some((tx) => tx.receiptImageUrl) && (
                      <View className="mb-3">
                        <Text className="text-xs text-gray-400 dark:text-white/40 mb-2">Receipts</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                          {selectedDayTransactions
                            .filter((tx) => tx.receiptImageUrl)
                            .map((tx) => {
                              const imageSize = (screenWidth - 32 - 16) / 3;
                              return (
                                <Pressable
                                  key={tx._id}
                                  onPress={() => setPreviewImage(tx.receiptImageUrl!)}
                                  className="rounded-2xl overflow-hidden"
                                  style={{ width: imageSize, height: imageSize }}
                                >
                                  <Image
                                    source={{ uri: tx.receiptImageUrl }}
                                    style={{ width: imageSize, height: imageSize }}
                                    contentFit="cover"
                                  />
                                  <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                    <Text className="text-[11px] text-white font-semibold" numberOfLines={1}>
                                      {tx.category}
                                    </Text>
                                    <Text className={`text-[10px] font-medium ${tx.type === 'income' ? 'text-green-300' : 'text-red-300'}`} numberOfLines={1}>
                                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                        </View>
                      </View>
                    )}

                    {/* Transaction list for selected day */}
                    {selectedDayTransactions.map((tx) => (
                      <TransactionItem
                        key={tx._id}
                        tx={tx}
                        onImagePress={setPreviewImage}
                        onPress={() => openEditTx(tx)}
                        onLongPress={() => confirmDeleteTx(tx._id)}
                      />
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowModal(true)}
        className="absolute right-6 h-14 w-14 items-center justify-center rounded-full bg-yellow-300 shadow-lg"
        style={{ bottom: TAB_BAR_HEIGHT + 20, zIndex: 999 }}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
      >
        <Text className="text-3xl leading-none text-black">+</Text>
      </Pressable>

      {/* Full-screen image preview */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View className="flex-1 bg-black">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPreviewImage(null)}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={{ width: screenWidth, height: screenHeight * 0.8 }}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPreviewImage(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
          >
            <Text className="text-white text-2xl font-bold">✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {showModal ? (
        <GlassModal onDismiss={resetForm}>
          <KeyboardAwareScrollView
            enabled={true}
            extraKeyboardSpace={40}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
              {editingTxId
                ? translate('finance.edit_transaction')
                : translate('finance.new_transaction')}
            </Text>

            <Input
              label="Amount"
              value={amount}
              keyboardType="numeric"
              onChangeText={(text) => setAmount(formatInputMoney(text))}
            />
            <Input
              label="Category"
              value={category}
              onChangeText={setCategory}
            />
            <Input label="Note" value={note} onChangeText={setNote} />

            {/* Receipt Image */}
            <View className="mb-4 mt-2">
              <Text className="text-gray-500 dark:text-white/60 text-sm mb-2">Receipt Photo (auto-scan amount)</Text>
              {receiptUri ? (
                <View className="items-center">
                  <View className="rounded-xl overflow-hidden" style={{ width: '100%', height: 160 }}>
                    <Image
                      source={{ uri: receiptUri }}
                      style={{ width: '100%', height: 160 }}
                      contentFit="cover"
                    />
                    {scanning && (
                      <View className="absolute inset-0 items-center justify-center bg-black/50">
                        <ActivityIndicator size="large" color="#FBBF24" />
                        <Text className="text-white text-sm mt-2 font-medium">Scanning...</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row gap-4 mt-2">
                    <Pressable onPress={() => scanReceipt(receiptUri)}>
                      <Text className="text-yellow-500 text-sm font-medium">Re-scan</Text>
                    </Pressable>
                    <Pressable onPress={() => { setReceiptUri(null); setScanning(false); }}>
                      <Text className="text-red-400 text-sm">Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  {SCAN_RECEIPT_SUPPORTED ? (
                    <Pressable
                      onPress={takeReceiptPhoto}
                      className="flex-1 items-center justify-center rounded-xl py-3 border border-dashed border-yellow-400 dark:border-yellow-500/40 bg-yellow-50 dark:bg-yellow-500/10"
                    >
                      <Text className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Scan Receipt</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={pickReceipt}
                    className="flex-1 items-center justify-center rounded-xl py-3 border border-gray-300 dark:border-white/20"
                  >
                    <Text className="text-gray-500 dark:text-white/70 text-sm">Gallery</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View className="mb-6 flex-row gap-3">
              <Pressable
                onPress={() => setType('income')}
                className={`flex-1 items-center justify-center rounded-xl py-3 border ${type === 'income'
                  ? 'bg-green-500 border-green-500'
                  : 'bg-transparent border-gray-300 dark:border-white/20'
                  }`}
              >
                <Text className={`font-semibold ${type === 'income' ? 'text-white' : 'text-gray-500 dark:text-white/70'}`}>
                  Income
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setType('expense')}
                className={`flex-1 items-center justify-center rounded-xl py-3 border ${type === 'expense'
                  ? 'bg-red-500 border-red-500'
                  : 'bg-transparent border-gray-300 dark:border-white/20'
                  }`}
              >
                <Text className={`font-semibold ${type === 'expense' ? 'text-white' : 'text-gray-500 dark:text-white/70'}`}>
                  Expense
                </Text>
              </Pressable>
            </View>

            <Button
              label={editingTxId ? translate('finance.save') : 'Confirm'}
              loading={creating || updatingTx || uploading}
              onPress={submit}
            />
            {editingTxId ? (
              <View className="mt-3">
                <Button
                  label={translate('finance.delete')}
                  variant="destructive"
                  onPress={() => {
                    const id = editingTxId;
                    resetForm();
                    confirmDeleteTx(id);
                  }}
                />
              </View>
            ) : null}
          </KeyboardAwareScrollView>
        </GlassModal>
      ) : null}
    </GlassContainer>
  );
}

function TransactionItem({
  tx,
  onImagePress,
  onPress,
  onLongPress,
}: {
  tx: FinanceTransactionDto;
  onImagePress?: (uri: string) => void;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable className="mb-3" onPress={onPress} onLongPress={onLongPress}>
      <GlassCard>
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            {tx.receiptImageUrl ? (
              <Pressable
                onPress={() => onImagePress?.(tx.receiptImageUrl!)}
                className="h-10 w-10 shrink-0 rounded-lg overflow-hidden"
              >
                <Image
                  source={{ uri: tx.receiptImageUrl }}
                  style={{ width: 40, height: 40 }}
                  contentFit="cover"
                />
              </Pressable>
            ) : (
              <View
                className={`h-10 w-10 shrink-0 items-center justify-center rounded-full ${tx.type === 'income'
                  ? 'bg-green-500/20'
                  : 'bg-red-500/20'
                  }`}
              >
                <Text className="text-lg">
                  {tx.category === 'Food'
                    ? '🍔'
                    : tx.category === 'Transport'
                      ? '🚗'
                      : '💰'}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text
                className="text-gray-900 dark:text-white text-base font-semibold"
                numberOfLines={1}
              >
                {tx.category}
              </Text>
              <Text
                className="text-gray-500 dark:text-white/60"
                numberOfLines={1}
              >
                {new Date(tx.date).toLocaleDateString()} • {tx.note}
              </Text>
            </View>
          </View>
          <Text
            className={`text-base font-bold shrink-0 ${tx.type === 'income'
              ? 'text-green-400'
              : 'text-red-400'
              }`}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {tx.type === 'income' ? '+' : '-'}
            {formatCurrency(tx.amount)}
          </Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}
