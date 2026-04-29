import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Document } from '@/db/types';
import type { NotificationRequest } from 'expo-notifications';

const DAYS_BEFORE_EXPIRY = 7;
const MAX_NOTIFICATION_TITLE_LEN = 60;
const NOTIFICATIONS_SUPPORTED =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

async function getNotificationsModule() {
  if (!NOTIFICATIONS_SUPPORTED) {
    return null;
  }

  return import('expo-notifications');
}

export async function configureNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('vault-expiry', {
      name: 'Document expiry reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

/**
 * Current notification permission without prompting (for Settings / status UI).
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return 'unsupported';
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Requests local notification permissions from the OS.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedules a local notification to fire DAYS_BEFORE_EXPIRY days before
 * the document's expiry_date. Returns the notification identifier, or null
 * if no scheduling was needed (already expired or no date set).
 */
export async function scheduleExpiryNotification(
  doc: Pick<Document, 'id' | 'title' | 'expiry_date'>
): Promise<string | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  if (!doc.expiry_date) return null;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') {
      return null;
    }
  }

  const expiryDate = new Date(doc.expiry_date);
  const now = new Date();

  if (expiryDate <= now) {
    // Document has already expired — no notification needed
    return null;
  }

  const warningDate = new Date(expiryDate);
  warningDate.setDate(warningDate.getDate() - DAYS_BEFORE_EXPIRY);

  // If the warning date is already in the past, schedule for 24 hours from now
  // (so the user gets notified even on last-minute entries)
  const triggerDate = warningDate > now ? warningDate : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // If the trigger would fire after expiry, skip it
  if (triggerDate >= expiryDate) return null;

  const safeTitle =
    doc.title.length > MAX_NOTIFICATION_TITLE_LEN
      ? `${doc.title.slice(0, MAX_NOTIFICATION_TITLE_LEN)}…`
      : doc.title;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Document Expiring Soon',
      body: `"${safeTitle}" expires on ${doc.expiry_date}. Tap to review.`,
      data: { documentId: doc.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notificationId;
}

/**
 * Cancels a previously scheduled local notification by its identifier.
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancels all pending scheduled notifications for this app.
 */
export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Returns all currently pending scheduled notifications.
 */
export async function getAllScheduledNotifications(): Promise<
  NotificationRequest[]
> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return [];

  return Notifications.getAllScheduledNotificationsAsync();
}
