/**
 * Notification utilities — daily study reminder.
 *
 * Schedules a single repeating local notification at the user's chosen
 * time. The notification body includes the current streak so users feel
 * the cost of missing a day.
 *
 * Usage:
 *   await requestNotificationPermission()   // call once on app start
 *   await scheduleReminder(8, 0, 5)         // 08:00, 5-day streak
 *   await cancelReminder()                  // user disables reminders
 *
 * The reminder hour + minute are persisted in AsyncStorage under
 * REMINDER_KEY so the settings screen can read the saved preference
 * without querying the notification system.
 */
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const REMINDER_KEY = "reminder:time";   // "HH:MM" or null
const CHANNEL_ID = "daily-reminder";
const IDENTIFIER = "allteacher-daily-reminder";

// Configure how notifications are displayed when the app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Request permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Fixed reminder time — 8:00 PM every day.
const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

/** Schedule the daily 8 PM reminder.
 *  Cancels any existing reminder first so there's never a duplicate.
 *  streakDays is embedded in the notification body — pass 0 if unknown.
 */
export async function scheduleReminder(streakDays = 0): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {});

  const streakLine =
    streakDays > 0
      ? `🔥 ${streakDays}-day streak — don't break it now.`
      : "Open AllTeacher and keep learning.";

  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: "Time to practice! 📚",
      body: streakLine,
      sound: false,
    },
    trigger: {
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      repeats: true,
    } as any,
  });

  await AsyncStorage.setItem(REMINDER_KEY, "enabled");
}

/** Cancel the daily reminder and clear the stored preference. */
export async function cancelReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {});
  await AsyncStorage.removeItem(REMINDER_KEY);
}

/** Returns true if a reminder is currently scheduled. */
export async function isReminderEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(REMINDER_KEY);
  return val === "enabled";
}
