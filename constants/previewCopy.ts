/** User-facing copy for in-app preview + handoff to other apps (not Sharing). */
export const PREVIEW_COPY = {
  screenTitle: 'Preview',
  openInAppA11y: 'Open in another app',
  openInAppShort: 'Open in another app',
  chooseApp: 'Choose app',
  copyText: 'Copy text',
  copied: 'Copied',
  loading: 'Loading preview…',
  unavailableTitle: 'Preview unavailable',
  pdfSubtitle: 'In-app preview. For annotations or full features, open in another app.',
  wordSubtitle: 'Document as plain text (sections + tables like rows). Full layout: open in another app.',
  excelSubtitle: 'Table as plain text. Full workbook: open in another app.',
  documentSubtitle: 'Text preview. For formatted view, open in another app.',
  imageSubtitle: 'Image preview. Pinch to zoom.',
  markdownSubtitle:
    'Simplified markdown preview. For exact rendering, open in another app.',
  importHint:
    'Tap a row for an in-app preview. Use Open in another app from the preview screen for Word, Excel, or PDF in another app.',
  documentCardHintOffice: 'Tap for in-app text preview · full layout in another app',
  documentCardHintPdf: 'Tap for in-app PDF preview',
  documentCardHintOther: 'Use Share in the toolbar to send to another app',
} as const;
