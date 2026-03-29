import {
  getGoogleDriveAccountLinkStatus,
  subscribeGoogleDriveLinkStatusChanged,
  type GoogleDriveAccountLinkStatus,
} from '@/services/GoogleDriveSync';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

const defaultStatus: GoogleDriveAccountLinkStatus = {
  configured: false,
  linked: false,
  autoUploadEnabled: false,
};

/**
 * Loads {@link getGoogleDriveAccountLinkStatus}, refreshes when the screen is focused,
 * and when the user connects or disconnects Google Drive in-session.
 */
export function useGoogleDriveAccountLinkStatus() {
  const [status, setStatus] = useState<GoogleDriveAccountLinkStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getGoogleDriveAccountLinkStatus();
      setStatus(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    return subscribeGoogleDriveLinkStatusChanged(() => {
      void refresh();
    });
  }, [refresh]);

  return { status, loading, refresh };
}
