import { Directory, File, Paths } from 'expo-file-system';

function getArchiveDirectory(): Directory {
  return new Directory(Paths.document, 'archive');
}

function ensureArchiveDir(): Directory {
  const archiveDirectory = getArchiveDirectory();
  const info = archiveDirectory.info();
  if (!info.exists) {
    archiveDirectory.create();
  }
  return archiveDirectory;
}

/**
 * Saves a file from a temporary URI (e.g., from camera or image picker) into
 * the app's permanent archive directory. Returns the permanent local URI.
 */
export async function saveFileToArchive(tempUri: string, fileName?: string): Promise<string> {
  try {
    const archiveDirectory = ensureArchiveDir();

    const ext = tempUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const uniqueName = fileName ?? `doc_${Date.now()}.${ext}`;
    const sourceFile = new File(tempUri);
    const destinationFile = new File(archiveDirectory, uniqueName);
    sourceFile.copy(destinationFile);

    return destinationFile.uri;
  } catch (error) {
    throw error;
  }
}

/**
 * Copies a file within the archive to a new unique name. Returns the new file URI.
 */
export async function copyFileInArchive(sourceUri: string, suggestedExt?: string): Promise<string> {
  const archiveDirectory = ensureArchiveDir();
  const ext = suggestedExt ?? sourceUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const uniqueName = `doc_${Date.now()}.${ext}`;
  const sourceFile = new File(sourceUri);
  const destinationFile = new File(archiveDirectory, uniqueName);
  sourceFile.copy(destinationFile);
  return destinationFile.uri;
}

/**
 * Deletes a file from the archive directory by its local URI.
 * Fails silently if the file does not exist.
 */
export async function deleteFileFromArchive(fileUri: string): Promise<void> {
  try {
    const file = new File(fileUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Silently ignore deletion errors
  }
}

/**
 * Returns the total size of the archive directory in bytes.
 */
export async function getArchiveSize(): Promise<number> {
  try {
    const archiveDirectory = ensureArchiveDir();
    const info = archiveDirectory.info();
    if (info.exists) {
      return info.size ?? 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

/**
 * Checks whether a file exists at the given local URI.
 */
export async function fileExists(fileUri: string): Promise<boolean> {
  try {
    return new File(fileUri).exists;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable string for a byte size, e.g. "4.2 MB".
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
