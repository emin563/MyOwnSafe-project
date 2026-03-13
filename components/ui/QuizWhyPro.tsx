import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PillButton } from './PillButton';

type Props = {
  onUpgrade: () => void;
  onClose?: () => void;
};

type StorageAnswer = 'cloud' | 'device' | 'mixed' | null;
type CloudTrustAnswer = 'trust' | 'unsure' | 'dont_trust' | null;
type ControlAnswer = 'low' | 'medium' | 'high' | null;
type PaymentsAnswer = 'yes' | 'no' | 'unknown' | null;
type ValueAnswer = 'worth_it' | 'unsure' | 'expensive' | null;

type StepId = 'storage' | 'cloudTrust' | 'control' | 'payments' | 'value' | 'model' | 'cta';

const STEP_ORDER: StepId[] = [
  'storage',
  'cloudTrust',
  'control',
  'payments',
  'value',
  'model',
  'cta',
];

export function QuizWhyPro({ onUpgrade, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [storageAnswer, setStorageAnswer] = useState<StorageAnswer>(null);
  const [cloudTrustAnswer, setCloudTrustAnswer] = useState<CloudTrustAnswer>(null);
  const [controlAnswer, setControlAnswer] = useState<ControlAnswer>(null);
  const [paymentsAnswer, setPaymentsAnswer] = useState<PaymentsAnswer>(null);
  const [valueAnswer, setValueAnswer] = useState<ValueAnswer>(null);

  const currentStep = STEP_ORDER[stepIndex];

  const shouldSkipStep = (id: StepId) => {
    if (id === 'cloudTrust' && storageAnswer === 'device') {
      return true;
    }
    if (id === 'value' && paymentsAnswer !== 'yes') {
      return true;
    }
    return false;
  };

  const goNext = () => {
    let next = stepIndex + 1;
    while (next < STEP_ORDER.length && shouldSkipStep(STEP_ORDER[next])) {
      next += 1;
    }
    if (next < STEP_ORDER.length) {
      setStepIndex(next);
    }
  };

  const goBack = () => {
    let prev = stepIndex - 1;
    while (prev >= 0 && shouldSkipStep(STEP_ORDER[prev])) {
      prev -= 1;
    }
    if (prev >= 0) {
      setStepIndex(prev);
    }
  };

  const hasPrevious = useMemo(() => {
    for (let i = stepIndex - 1; i >= 0; i -= 1) {
      if (!shouldSkipStep(STEP_ORDER[i])) return true;
    }
    return false;
  }, [stepIndex, storageAnswer, paymentsAnswer]);

  const isLastQuestionStep = useMemo(() => {
    // Last question step before CTA in the dynamic flow.
    return currentStep === 'model';
  }, [currentStep]);

  const questionTitle = (() => {
    switch (currentStep) {
      case 'storage':
        return 'Where do you usually store your important documents today?';
      case 'cloudTrust':
        return 'How do you feel about how cloud providers use your data?';
      case 'control':
        return 'How important is it that only you control access to your documents?';
      case 'payments':
        return 'Do you currently pay monthly or yearly fees for storage or document apps?';
      case 'value':
        return 'Do you feel the service you are paying for is worth the ongoing cost?';
      case 'model':
        return 'Imagine a different model:';
      case 'cta':
        return 'What would you like to do next?';
      default:
        return '';
    }
  })();

  const modelDescription =
    'All your documents are stored only on your device, fully offline.\n' +
    'You pay once for Pro. No subscriptions, ever.\n' +
    'You remove the 3-file and 3-category limits and can store as much as you want.';

  const hasSelection = (() => {
    switch (currentStep) {
      case 'storage':
        return storageAnswer !== null;
      case 'cloudTrust':
        return cloudTrustAnswer !== null;
      case 'control':
        return controlAnswer !== null;
      case 'payments':
        return paymentsAnswer !== null;
      case 'value':
        return valueAnswer !== null;
      case 'model':
        return true; // model step just presents info with options right below
      default:
        return false;
    }
  })();

  const renderOptions = () => {
    if (currentStep === 'storage') {
      return (
        <>
          <QuizOption
            label="Mostly in cloud services (Google Drive, iCloud, Dropbox…)"
            selected={storageAnswer === 'cloud'}
            onPress={() => setStorageAnswer('cloud')}
          />
          <QuizOption
            label="Mostly on my phone"
            selected={storageAnswer === 'device'}
            onPress={() => setStorageAnswer('device')}
          />
          <QuizOption
            label="A mix of both"
            selected={storageAnswer === 'mixed'}
            onPress={() => setStorageAnswer('mixed')}
          />
        </>
      );
    }
    if (currentStep === 'cloudTrust') {
      return (
        <>
          <QuizOption
            label="I fully trust them"
            selected={cloudTrustAnswer === 'trust'}
            onPress={() => setCloudTrustAnswer('trust')}
          />
          <QuizOption
            label="I’m not sure, I haven’t really thought about it"
            selected={cloudTrustAnswer === 'unsure'}
            onPress={() => setCloudTrustAnswer('unsure')}
          />
          <QuizOption
            label="I don’t completely trust them"
            selected={cloudTrustAnswer === 'dont_trust'}
            onPress={() => setCloudTrustAnswer('dont_trust')}
          />
        </>
      );
    }
    if (currentStep === 'control') {
      return (
        <>
          <QuizOption
            label="Not very important"
            selected={controlAnswer === 'low'}
            onPress={() => setControlAnswer('low')}
          />
          <QuizOption
            label="Nice to have"
            selected={controlAnswer === 'medium'}
            onPress={() => setControlAnswer('medium')}
          />
          <QuizOption
            label="Very important – only I should have access"
            selected={controlAnswer === 'high'}
            onPress={() => setControlAnswer('high')}
          />
        </>
      );
    }
    if (currentStep === 'payments') {
      return (
        <>
          <QuizOption
            label="Yes, I pay for one or more services"
            selected={paymentsAnswer === 'yes'}
            onPress={() => setPaymentsAnswer('yes')}
          />
          <QuizOption
            label="No, I’m using free services"
            selected={paymentsAnswer === 'no'}
            onPress={() => setPaymentsAnswer('no')}
          />
          <QuizOption
            label="I’m not sure / don’t remember"
            selected={paymentsAnswer === 'unknown'}
            onPress={() => setPaymentsAnswer('unknown')}
          />
        </>
      );
    }
    if (currentStep === 'value') {
      return (
        <>
          <QuizOption
            label="Yes, absolutely worth it"
            selected={valueAnswer === 'worth_it'}
            onPress={() => setValueAnswer('worth_it')}
          />
          <QuizOption
            label="Not sure / sometimes"
            selected={valueAnswer === 'unsure'}
            onPress={() => setValueAnswer('unsure')}
          />
          <QuizOption
            label="Not really, it feels expensive"
            selected={valueAnswer === 'expensive'}
            onPress={() => setValueAnswer('expensive')}
          />
        </>
      );
    }
    if (currentStep === 'model') {
      return (
        <>
          <Text style={styles.modelText}>{modelDescription}</Text>
          <View style={styles.modelOptions}>
            <QuizOption
              label="Exactly what I’m looking for"
              selected={false}
              onPress={onUpgrade}
            />
            <QuizOption
              label="Sounds good"
              selected={false}
              onPress={onUpgrade}
            />
            <QuizOption
              label="I’m not sure yet"
              selected={false}
              onPress={goNext}
            />
            <QuizOption
              label="I prefer subscriptions"
              selected={false}
              onPress={goNext}
            />
          </View>
        </>
      );
    }
    return null;
  };

  const renderCtaStep = () => {
    return (
      <View style={styles.ctaContainer}>
        <PillButton
          label="Unlock Pro and remove limits"
          variant="primary"
          size="lg"
          onPress={onUpgrade}
          style={styles.ctaPrimary}
        />
        <PillButton
          label="Maybe later, keep using Free"
          variant="ghost"
          size="md"
          onPress={onClose || (() => {})}
        />
        <Text style={styles.ctaHint}>
          You can upgrade anytime from Settings. Your existing documents always stay safe on your
          device.
        </Text>
      </View>
    );
  };

  const stepLabel = useMemo(() => {
    const displayIndex = stepIndex + 1;
    if (currentStep === 'cta') {
      return 'Summary';
    }
    return `Step ${displayIndex}`;
  }, [stepIndex, currentStep]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.stepLabel}>{stepLabel}</Text>
        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.question}>{questionTitle}</Text>
      <View style={styles.options}>{currentStep === 'cta' ? renderCtaStep() : renderOptions()}</View>

      {currentStep !== 'cta' && currentStep !== 'model' && (
        <View style={styles.navRow}>
          <PillButton
            label="Back"
            variant="ghost"
            size="sm"
            onPress={goBack}
            disabled={!hasPrevious}
          />
          <PillButton
            label={isLastQuestionStep ? 'Continue' : 'Next'}
            variant="primary"
            size="sm"
            onPress={goNext}
            disabled={!hasSelection}
          />
        </View>
      )}
    </View>
  );
}

type QuizOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function QuizOption({ label, selected, onPress }: QuizOptionProps) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  question: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  options: {
    gap: Spacing.sm,
  },
  option: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.surfaceRaised,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
  optionLabelSelected: {
    color: Colors.text,
  },
  modelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modelOptions: {
    gap: Spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  ctaContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ctaPrimary: {
    alignSelf: 'stretch',
  },
  ctaHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
});

