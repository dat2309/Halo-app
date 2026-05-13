import React, { useEffect } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Switch } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type CalendarEventDto,
  useCalendarEvents,
  useCalendarSummary,
  useCreateEvent,
  useDeleteEvent,
  useUpcomingEvents,
  useUpdateEvent,
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
  Input,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { getSocket } from '@/lib/socket';
import { translate } from '@/lib';

const colorOptions = ['#8B5CF6', '#F472B6', '#34D399', '#60A5FA', '#FBBF24'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDaysInMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

function formatDayLabel(date: Date): { dow: string; day: string } {
  const dow = date.toLocaleDateString(undefined, { weekday: 'short' });
  const day = date.toLocaleDateString(undefined, { day: '2-digit' });
  return { dow, day };
}

function toTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format date as DD/MM/YYYY
function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Fixed tab bar height (matches GlassBottomTab height)
const TAB_BAR_HEIGHT = 80;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = React.useState<Date>(() =>
    startOfDay(new Date())
  );
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() =>
    startOfMonth(new Date())
  );

  // Fetch Summary for the Month
  const { data: summaryData, refetch: refetchSummary } = useCalendarSummary({
    variables: {
      month: currentMonth.getMonth() + 1,
      year: currentMonth.getFullYear(),
    }
  });

  // Fetch Events for the Selected Date
  const { data: eventsData, isPending, isError, refetch: refetchEvents } = useCalendarEvents({
    variables: {
      date: getLocalISODate(selectedDate),

    }
  });

  const { mutateAsync: createEvent, isPending: creating } = useCreateEvent();
  const { mutateAsync: updateEvent, isPending: updating } = useUpdateEvent();
  const { mutateAsync: deleteEvent } = useDeleteEvent();
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const { data: upcomingEvents, refetch: refetchUpcoming } = useUpcomingEvents({
    variables: { limit: 5 },
  });

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [endDate, setEndDate] = React.useState<Date>(new Date());
  const [color, setColor] = React.useState<string | undefined>(colorOptions[0]);
  const [reminder, setReminder] = React.useState(false);
  const [reminderTime, setReminderTime] = React.useState<Date>(new Date());
  const [showModal, setShowModal] = React.useState(false);

  // Date/Time Picker states
  const [showStartDatePicker, setShowStartDatePicker] = React.useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = React.useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date());
    setReminder(false);
    setReminderTime(new Date());
    setColor(colorOptions[0]);
    setEditingEventId(null);
    setShowModal(false);
  };

  const openEditEvent = (event: CalendarEventDto) => {
    setEditingEventId(event._id);
    setTitle(event.title);
    setDescription(event.description ?? '');
    setStartDate(new Date(event.startDate));
    setEndDate(new Date(event.endDate));
    setColor(event.color ?? colorOptions[0]);
    setReminder(!!event.reminder);
    setReminderTime(event.reminderTime ? new Date(event.reminderTime) : new Date());
    setShowModal(true);
  };

  const refetchAll = () => {
    refetchEvents();
    refetchSummary();
    refetchUpcoming();
  };

  const submit = async () => {
    if (!title) return;

    if (endDate < startDate) {
      Alert.alert(
        translate('calendar.invalid_date_title'),
        translate('calendar.invalid_date_message')
      );
      return;
    }

    const payload = {
      title,
      description,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color,
      reminder,
      reminderTime: reminder ? reminderTime.toISOString() : undefined,
    };

    try {
      if (editingEventId) {
        await updateEvent({ id: editingEventId, ...payload });
      } else {
        await createEvent(payload);
      }
      resetForm();
      refetchAll();
    } catch {
      Alert.alert(
        translate('common.error'),
        translate('calendar.update_failed')
      );
    }
  };

  // Real-time updates via Socket.IO
  useEffect(() => {
    let socketInstance: any;

    getSocket().then(socket => {
      if (!socket) return;
      socketInstance = socket;
      const handler = () => {
        refetchEvents();
        refetchSummary();
      };
      socket.on('calendar:created', handler);
      socket.on('calendar:updated', handler);
      socket.on('calendar:deleted', handler);
    });

    return () => {
      if (socketInstance) {
        socketInstance.off('calendar:created');
        socketInstance.off('calendar:updated');
        socketInstance.off('calendar:deleted');
      }
    };
  }, [refetchEvents, refetchSummary]);

  // Flatten paginated data
  const items = React.useMemo(() => {
    if (!eventsData?.pages) return [];
    return eventsData.pages.flatMap(page => page.list);
  }, [eventsData]);
  const summary = summaryData ?? [];

  // Generate month grid (1-31)
  const monthDays = React.useMemo(() => {
    const daysCount = getDaysInMonth(currentMonth);
    const days: Date[] = [];
    for (let i = 1; i <= daysCount; i++) {
      const d = new Date(currentMonth);
      d.setDate(i);
      days.push(startOfDay(d));
    }
    return days;
  }, [currentMonth]);

  const contentPadding = TAB_BAR_HEIGHT + insets.bottom + 20;

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(startOfMonth(newDate));
  };

  const goToToday = () => {
    const today = startOfDay(new Date());
    setSelectedDate(today);
    setCurrentMonth(startOfMonth(today));
  };

  const handleDeleteEvent = (eventId: string) => {
    Alert.alert(
      translate('calendar.delete_event_title'),
      translate('calendar.delete_event_message'),
      [
        { text: translate('common.cancel'), style: 'cancel' },
        {
          text: translate('calendar.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteEvent({ id: eventId });
            refetchEvents();
            refetchSummary();
            refetchUpcoming();
          },
        },
      ]
    );
  };

  return (
    <GlassContainer>
      <FocusAwareStatusBar />
      <GlassHeader
        title={`${currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}
        right={<GlassButton label="Today" onPress={goToToday} />}
      />

      {/* Month Navigation */}
      <View className="flex-row items-center justify-between px-4 py-1">
        <Pressable
          onPress={() => changeMonth(-1)}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10"
        >
          <Text className="text-xl text-gray-900 dark:text-white">{'<'}</Text>
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {currentMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
        </Text>
        <Pressable
          onPress={() => changeMonth(1)}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10"
        >
          <Text className="text-xl text-gray-900 dark:text-white">{'>'}</Text>
        </Pressable>
      </View>

      {/* Upcoming Events */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-3 py-2"
          contentContainerStyle={{ gap: 8 }}
        >
          {upcomingEvents.map((evt) => (
            <View
              key={evt._id}
              className="rounded-2xl px-4 py-3"
              style={{
                backgroundColor: (evt.color ?? '#FBBF24') + '20',
                borderColor: evt.color ?? '#FBBF24',
                borderWidth: 1,
                minWidth: 140,
              }}
            >
              <Text className="text-xs text-gray-500 dark:text-white/60">
                {new Date(evt.startDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text
                className="text-sm font-semibold text-gray-900 dark:text-white mt-1"
                numberOfLines={1}
              >
                {evt.title}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-white/50">
                {toTimeLabel(evt.startDate)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <ScrollView
        className="mt-2 flex-1 px-3"
        contentContainerStyle={{ paddingBottom: contentPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isPending}
            onRefresh={() => {
              refetchEvents();
              refetchSummary();
            }}
            tintColor={Platform.OS === 'ios' ? '#000' : undefined}
          />
        }
      >
        {/* Month Grid */}
        <View className="mb-4 flex-row flex-wrap gap-2">
          {monthDays.map((d) => {
            const localDateKey = getLocalISODate(d);

            const isSelected = localDateKey === getLocalISODate(selectedDate);
            const isToday =
              localDateKey === getLocalISODate(new Date());
            const { day } = formatDayLabel(d);

            // Check if this day has events in summary
            // Overlap check: Event Start <= Day End AND Event End >= Day Start
            const dayStart = startOfDay(d).getTime();
            const dayEnd = endOfDay(d).getTime();

            const hasEvents = summary.some(s => {
              const eventStart = new Date(s.startDate).getTime();
              const eventEnd = new Date(s.endDate).getTime();
              return eventStart <= dayEnd && eventEnd >= dayStart;
            });

            return (
              <Pressable
                key={localDateKey}
                onPress={() => setSelectedDate(startOfDay(d))}
                className={`h-12 w-12 items-center justify-center rounded-xl relative ${isSelected
                  ? 'bg-yellow-400/30 border-2 border-yellow-400'
                  : isToday
                    ? 'border-2 border-yellow-400/40 bg-gray-100 dark:bg-white/5'
                    : 'bg-gray-100 dark:bg-white/5'
                  }`}
              >
                <Text
                  className={`text-sm font-semibold ${isSelected ? 'text-yellow-400' : 'text-gray-900 dark:text-white'}`}
                >
                  {day}
                </Text>
                {hasEvents && !isSelected && (
                  <View className="absolute bottom-1 h-1 w-1 rounded-full bg-yellow-400" />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Events Timeline */}
        <Text className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
          Events for {formatDateDDMMYYYY(selectedDate)}
        </Text>

        {isError ? (
          <Text className="text-red-500">Error loading events</Text>
        ) : items.length === 0 ? (
          <EmptyList isLoading={isPending} />
        ) : (
          items.map((event) => (
            <Pressable
              key={event._id}
              className="mb-3 flex-row gap-3"
              onPress={() => openEditEvent(event)}
              onLongPress={() => handleDeleteEvent(event._id)}
            >
              {/* Time Column */}
              <View className="w-20 items-start pt-4">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                  {new Date(event.startDate).getDate()}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-white/60">
                  {formatDateDDMMYYYY(new Date(event.startDate))}
                </Text>
              </View>

              {/* Event Card */}
              <View className="flex-1">
                <View
                  className="rounded-3xl"
                  style={{
                    borderColor: event.color ?? '#FBBF24',
                    backgroundColor: (event.color ?? '#FBBF24') + '10',
                    borderWidth: 1,
                  }}
                >
                  <GlassCard className="p-4" style={{ backgroundColor: 'transparent' }}>
                    <Text className="text-gray-900 dark:text-white text-lg font-semibold">
                      {event.title}
                    </Text>
                    <Text className="text-gray-500 dark:text-white/70">
                      {toTimeLabel(event.startDate)} →{' '}
                      {toTimeLabel(event.endDate)}
                    </Text>
                    {event.description ? (
                      <Text className="mt-1 text-gray-500 dark:text-white/70">
                        {event.description}
                      </Text>
                    ) : null}
                  </GlassCard>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowModal(true)}
        className="absolute right-6 h-14 w-14 items-center justify-center rounded-full bg-yellow-300 shadow-lg"
        style={{ bottom: TAB_BAR_HEIGHT + 20, zIndex: 999 }}
        accessibilityRole="button"
        accessibilityLabel="Add event"
      >
        <Text className="text-3xl leading-none text-black">+</Text>
      </Pressable>

      {showModal ? (
        <GlassModal onDismiss={resetForm}>
          <KeyboardAwareScrollView
            enabled={true}
            extraKeyboardSpace={40}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
              {editingEventId
                ? translate('calendar.edit_event')
                : translate('calendar.new_event')}
            </Text>
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Date/Time Pickers */}
            <View className="my-2">
              <Text className="text-gray-900 dark:text-white mb-1">Start Date & Time</Text>
              <Pressable
                onPress={() => setShowStartDatePicker(true)}
                className="rounded-xl bg-gray-100 dark:bg-white/10 p-3 mb-2"
              >
                <Text className="text-gray-900 dark:text-white">
                  {formatDateDDMMYYYY(startDate)}{' '}
                  {startDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>
            </View>

            <View className="my-2">
              <Text className="text-gray-900 dark:text-white mb-1">End Date & Time</Text>
              <Pressable
                onPress={() => setShowEndDatePicker(true)}
                className="rounded-xl bg-gray-100 dark:bg-white/10 p-3 mb-2"
              >
                <Text className="text-gray-900 dark:text-white">
                  {formatDateDDMMYYYY(endDate)}{' '}
                  {endDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>
            </View>

            <View className="my-2">
              <Text className="text-gray-900 dark:text-white mb-2">Color</Text>
              <View className="flex-row flex-wrap gap-2">
                {colorOptions.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="h-8 w-8 rounded-full"
                    style={{
                      backgroundColor: c,
                      borderWidth: color === c ? 2 : 0,
                      borderColor: '#fff',
                    }}
                  />
                ))}
              </View>
            </View>

            <View className="my-2 flex-row items-center justify-between">
              <Text className="text-gray-900 dark:text-white">Reminder</Text>
              <Switch value={reminder} onValueChange={setReminder} />
            </View>

            <Button
              label={editingEventId ? translate('calendar.save') : 'Confirm'}
              loading={creating || updating}
              onPress={submit}
            />
            {editingEventId ? (
              <View className="mt-3">
                <Button
                  label={translate('calendar.delete')}
                  variant="destructive"
                  onPress={() => {
                    const id = editingEventId;
                    resetForm();
                    handleDeleteEvent(id);
                  }}
                />
              </View>
            ) : null}
          </KeyboardAwareScrollView>

          {/* Date/Time Picker Modals */}
          <DateTimePickerModal
            isVisible={showStartDatePicker}
            mode="datetime"
            date={startDate}
            onConfirm={(date: Date) => {
              setStartDate(date);
              setShowStartDatePicker(false);
            }}
            onCancel={() => setShowStartDatePicker(false)}
          />
          <DateTimePickerModal
            isVisible={showEndDatePicker}
            mode="datetime"
            date={endDate}
            onConfirm={(date: Date) => {
              setEndDate(date);
              setShowEndDatePicker(false);
            }}
            onCancel={() => setShowEndDatePicker(false)}
          />
        </GlassModal>
      ) : null}
    </GlassContainer>
  );
}
