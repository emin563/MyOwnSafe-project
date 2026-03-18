import React, { useMemo, useState } from 'react';
import { PromptTemplateSheet } from './PromptTemplateSheet';
import { AiDestinationSheet } from './AiDestinationSheet';
import type { FileType } from '@/db/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  document: {
    id: number;
    title: string;
    fileType: FileType;
    categoryName?: string | null;
  };
  fileUri: string;
};

export function UseAiWorkflowSheet({ visible, onClose, document, fileUri }: Props) {
  const [destVisible, setDestVisible] = useState(false);

  const closeAll = () => {
    setDestVisible(false);
    onClose();
  };

  const promptVisible = visible && !destVisible;

  return (
    <>
      <PromptTemplateSheet
        visible={promptVisible}
        onClose={onClose}
        onContinueToAi={() => setDestVisible(true)}
        document={document}
        fileUri={fileUri}
      />
      <AiDestinationSheet
        visible={visible && destVisible}
        onClose={closeAll}
        fileUri={fileUri}
        minimal
      />
    </>
  );
}

