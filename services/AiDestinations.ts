export type AiDestinationId = 'chatgpt' | 'gemini' | 'claude' | 'copilot' | 'more';

export type AiDestination = {
  id: AiDestinationId;
  title: string;
  description: string;
  /**
   * Best-effort deep link scheme. If not installed / unsupported, we fall back to share sheet.
   * Note: schemes may vary by platform/app version.
   */
  deepLinkUrl?: string;
};

export const AI_DESTINATIONS: AiDestination[] = [
  {
    id: 'chatgpt',
    title: 'ChatGPT',
    description: 'Open ChatGPT, then attach the document.',
    deepLinkUrl: 'chatgpt://',
  },
  {
    id: 'gemini',
    title: 'Gemini',
    description: 'Open Gemini, then attach the document.',
    deepLinkUrl: 'gemini://',
  },
  {
    id: 'claude',
    title: 'Claude',
    description: 'Open Claude, then attach the document.',
    deepLinkUrl: 'claude://',
  },
  {
    id: 'copilot',
    title: 'Microsoft Copilot',
    description: 'Open Copilot, then attach the document.',
    deepLinkUrl: 'copilot://',
  },
  {
    id: 'more',
    title: 'More…',
    description: 'Choose any app from the system share sheet.',
  },
];

