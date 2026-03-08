import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Document } from '@/db/types';
import type { NotificationRequest } from 'expo-notifications';

const DAYS_BEFORE_EXPIRY = 7;
const NOTIFICATIONS_SUPPORTED =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// #region agent log
function sendDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  fetch('http://127.0.0.1:7480/ingest/66512b4c-ea2c-44b0-a600-fed3b773abbf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8dfdc1',
    },
    body: JSON.stringify({
      sessionId: '8dfdc1',
      runId: 'notifications-expo-go-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

async function getNotificationsModule() {
  if (!NOTIFICATIONS_SUPPORTED) {
    // #region agent log
    sendDebugLog(
      'N1',
      'services/NotificationService.ts:31',
      'notifications-module-skipped',
      {
        executionEnvironment: Constants.executionEnvironment,
        supported: NOTIFICATIONS_SUPPORTED,
      }
    );
    // #endregion
    return null;
  }

  return import('expo-notifications');
}

export async function configureNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  // #region agent log
  sendDebugLog(
    'N2',
    'services/NotificationService.ts:53',
    'notifications-handler-configured',
    {
      executionEnvironment: Constants.executionEnvironment,
    }
  );
  // #endregion

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
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

  // #region agent log
  sendDebugLog(
    'N3',
    'services/NotificationService.ts:77',
    'notifications-permission-requested',
    {
      executionEnvironment: Constants.executionEnvironment,
    }
  );
  // #endregion

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

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Document Expiring Soon',
      body: `"${doc.title}" expires on ${doc.expiry_date}. Tap to review.`,
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
