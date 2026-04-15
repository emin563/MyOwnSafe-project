import * as Sharing from 'expo-sharing';
import { withExternalActivityGuard } from '@/store/auth-flags';

/**
 * Serialize expo-sharing calls. On Android, a second `shareAsync` while the first is still
 * resolving throws: "Another share request is being processed now."
 */
let shareChain: Promise<unknown> = Promise.resolve();

export async function sharingShareAsyncSerialized(
  uri: string,
  options?: Sharing.SharingOptions
): Promise<void> {
  const next = shareChain.then(() =>
    withExternalActivityGuard(() => Sharing.shareAsync(uri, options))
  );
  shareChain = next.then(() => undefined).catch(() => undefined);
  await next;
}
