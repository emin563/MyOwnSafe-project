import {
  loadQuizWhyProState,
  persistQuizAiFreedom,
  persistQuizPrivacy,
  persistQuizStepIndex,
  persistQuizSubscription,
} from '@/services/quizWhyProStorage';
import { useAppStore } from '@/store/app-store';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PillButton } from './PillButton';

type Props = {
  onUpgrade: () => void;
  onClose?: () => void;
};

type TiredOfSubs = 'frustrated' | 'dont_mind' | null;
type PrivacyWorry = 'prefer_local' | 'trust' | null;
type AiFreedom = 'want_choice' | 'fine' | null;

type StepId = 'subscriptions' | 'privacy' | 'aiFreedom' | 'model' | 'cta';

const STEP_ORDER: StepId[] = ['subscriptions', 'privacy', 'aiFreedom', 'model', 'cta'];

function buildPersonalizedPitch(answers: {
  tiredOfSubs: TiredOfSubs;
  privacy: PrivacyWorry;
  aiFreedom: AiFreedom;
}): { headline: string; body: string } {
  const { tiredOfSubs, privacy, aiFreedom } = answers;
  const frustrated = tiredOfSubs === 'frustrated';
  const prefersLocal = privacy === 'prefer_local';
  const wantsAiChoice = aiFreedom === 'want_choice';

  let headline = "Here's why Pro may fit you";
  if (frustrated && prefersLocal) {
    headline = 'Since you value privacy and hate subscription fatigue';
  } else if (frustrated) {
    headline = "Since you're tired of subscription pressure";
  } else if (prefersLocal) {
    headline = 'Since you want your files on your device—not a random company cloud';
  } else if (wantsAiChoice) {
    headline = 'Since you want to choose your own AI tools';
  }

  let body =
    'Pro removes Free limits (25 documents, 5 categories, 10 tags) so you can grow your vault. One purchase—yours forever, no monthly bill.\n\n';

  if (prefersLocal) {
    body +=
      'Your vault stays on your device for everyday use. Optional Google Drive sync goes only to the Google account you connect.\n\n';
  } else if (privacy === 'trust') {
    body += 'You still get unlimited room, full backup tools, and the complete prompt library with a single one-time unlock.\n\n';
  }

  if (wantsAiChoice) {
    body +=
      'The full prompt library and sharing flow let you use ChatGPT, Gemini, Copilot, or others when you choose—no lock-in to our stack.\n\n';
  }

  body += 'Unlock once, own it forever.';
  return { headline, body };
}

/** Feedback copy for the current question, derived from answers (persists when using Back/Next). */
function feedbackForQuestion(
  step: 'subscriptions' | 'privacy' | 'aiFreedom',
  tiredOfSubs: TiredOfSubs,
  privacy: PrivacyWorry,
  aiFreedom: AiFreedom
): string | null {
  switch (step) {
    case 'subscriptions':
      if (tiredOfSubs === 'frustrated') {
        return "We agree. That's why MyOwnSafe Pro is a strict one-time payment—no subscriptions.";
      }
      if (tiredOfSubs === 'dont_mind') {
        return 'Fair enough. Pro is still a single payment forever whenever you want unlimited room.';
      }
      return null;
    case 'privacy':
      if (privacy === 'prefer_local') {
        return 'Good match: your vault stays on your device by default. Optional Drive is your Google account, your rules.';
      }
      if (privacy === 'trust') {
        return 'Noted. Pro still gives you unlimited slots, backup, and the full prompt library when you want more power.';
      }
      return null;
    case 'aiFreedom':
      if (aiFreedom === 'want_choice') {
        return 'Pro unlocks the full prompt library and sharing so you use whichever AI app you trust.';
      }
      if (aiFreedom === 'fine') {
        return 'Understood. Pro still removes vault limits with one purchase—no monthly fees.';
      }
      return null;
    default:
      return null;
  }
}

export function QuizWhyPro({ onUpgrade, onClose }: Props) {
  const isPro = useAppStore((s) => s.isPro);
  const [stepIndex, setStepIndex] = useState(0);
  const [tiredOfSubs, setTiredOfSubs] = useState<TiredOfSubs>(null);
  const [privacy, setPrivacy] = useState<PrivacyWorry>(null);
  const [aiFreedom, setAiFreedom] = useState<AiFreedom>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isPro) {
        setHydrated(true);
        return;
      }
      try {
        const data = await loadQuizWhyProState();
        if (cancelled) return;
        setTiredOfSubs(data.tiredOfSubs);
        setPrivacy(data.privacy);
        setAiFreedom(data.aiFreedom);
        setStepIndex(data.stepIndex);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPro]);

  const currentStep = STEP_ORDER[stepIndex];

  const currentQuestionFeedback = useMemo(() => {
    if (currentStep === 'subscriptions' || currentStep === 'privacy' || currentStep === 'aiFreedom') {
      return feedbackForQuestion(currentStep, tiredOfSubs, privacy, aiFreedom);
    }
    return null;
  }, [currentStep, tiredOfSubs, privacy, aiFreedom]);

  const hasAnswerForCurrentQuestion = useMemo(() => {
    switch (currentStep) {
      case 'subscriptions':
        return tiredOfSubs !== null;
      case 'privacy':
        return privacy !== null;
      case 'aiFreedom':
        return aiFreedom !== null;
      default:
        return false;
    }
  }, [currentStep, tiredOfSubs, privacy, aiFreedom]);

  const goNext = () => {
    setStepIndex((i) => {
      const next = Math.min(i + 1, STEP_ORDER.length - 1);
      void persistQuizStepIndex(next);
      return next;
    });
  };

  const goBack = () => {
    setStepIndex((i) => {
      const prev = Math.max(0, i - 1);
      void persistQuizStepIndex(prev);
      return prev;
    });
  };

  const questionTitle = (() => {
    switch (currentStep) {
      case 'subscriptions':
        return 'Are you tired of scanner apps forcing you into expensive monthly subscriptions?';
      case 'privacy':
        return 'Does it worry you that many document apps upload your sensitive PDFs to their own cloud servers?';
      case 'aiFreedom':
        return 'Do you want to use ChatGPT, Gemini, or Copilot with your documents—on your terms—instead of locking everything into one app?';
      case 'model':
        return '';
      case 'cta':
        return 'What would you like to do next?';
      default:
        return '';
    }
  })();

  const pitch = useMemo(
    () =>
      buildPersonalizedPitch({
        tiredOfSubs,
        privacy,
        aiFreedom,
      }),
    [tiredOfSubs, privacy, aiFreedom]
  );

  const onPickSubs = (v: NonNullable<TiredOfSubs>) => {
    if (tiredOfSubs !== null) return;
    setTiredOfSubs(v);
    void persistQuizSubscription(v);
  };

  const onPickPrivacy = (v: NonNullable<PrivacyWorry>) => {
    if (privacy !== null) return;
    setPrivacy(v);
    void persistQuizPrivacy(v);
  };

  const onPickAi = (v: NonNullable<AiFreedom>) => {
    if (aiFreedom !== null) return;
    setAiFreedom(v);
    void persistQuizAiFreedom(v);
  };

  const renderQuestionOptions = () => {
    if (currentStep === 'subscriptions') {
      return (
        <>
          <QuizOption
            label="Yes — it's frustrating"
            selected={tiredOfSubs === 'frustrated'}
            locked={tiredOfSubs !== null}
            onPress={() => onPickSubs('frustrated')}
          />
          <QuizOption
            label="No — I don't mind"
            selected={tiredOfSubs === 'dont_mind'}
            locked={tiredOfSubs !== null}
            onPress={() => onPickSubs('dont_mind')}
          />
          {tiredOfSubs !== null ? (
            <Text style={styles.lockedHint}>
              Saved on this device. You can read the note above again; this choice can’t be changed.
            </Text>
          ) : null}
        </>
      );
    }
    if (currentStep === 'privacy') {
      return (
        <>
          <QuizOption
            label="Yes — I prefer on-device storage or my own Google Drive"
            selected={privacy === 'prefer_local'}
            locked={privacy !== null}
            onPress={() => onPickPrivacy('prefer_local')}
          />
          <QuizOption
            label="No — I generally trust them"
            selected={privacy === 'trust'}
            locked={privacy !== null}
            onPress={() => onPickPrivacy('trust')}
          />
          {privacy !== null ? (
            <Text style={styles.lockedHint}>
              Saved on this device. You can read the note above again; this choice can’t be changed.
            </Text>
          ) : null}
        </>
      );
    }
    if (currentStep === 'aiFreedom') {
      return (
        <>
          <QuizOption
            label="Yes — I want that flexibility"
            selected={aiFreedom === 'want_choice'}
            locked={aiFreedom !== null}
            onPress={() => onPickAi('want_choice')}
          />
          <QuizOption
            label="Not really a priority"
            selected={aiFreedom === 'fine'}
            locked={aiFreedom !== null}
            onPress={() => onPickAi('fine')}
          />
          {aiFreedom !== null ? (
            <Text style={styles.lockedHint}>
              Saved on this device. You can read the note above again; this choice can’t be changed.
            </Text>
          ) : null}
        </>
      );
    }
    return null;
  };

  const renderModelStep = () => (
    <>
      <Text style={styles.modelHeadline}>{pitch.headline}</Text>
      <Text style={styles.modelText}>{pitch.body}</Text>
      <View style={styles.modelActions}>
        <PillButton
          label="Unlock Pro (One-time)"
          variant="primary"
          size="lg"
          onPress={onUpgrade}
          style={styles.modelPrimaryBtn}
        />
        <TouchableOpacity onPress={goNext} activeOpacity={0.7} style={styles.modelSecondaryWrap}>
          <Text style={styles.modelSecondaryText}>Not sure yet — see more options</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderCtaStep = () => (
    <View style={styles.ctaContainer}>
      <PillButton
        label="Unlock Pro (One-time) — remove limits now"
        variant="primary"
        size="lg"
        onPress={onUpgrade}
        style={styles.ctaPrimary}
      />
      <PillButton
        label="Not now — keep using Free"
        variant="ghost"
        size="md"
        onPress={onClose || (() => {})}
      />
      <Text style={styles.ctaHint}>
        You can upgrade anytime from Settings. Your existing documents stay on your device.
      </Text>
    </View>
  );

  const stepBadge = useMemo(() => {
    if (currentStep === 'cta') return 'Summary';
    if (currentStep === 'model') return 'Your pitch';
    const q = stepIndex + 1;
    return `Question ${q} of 3`;
  }, [currentStep, stepIndex]);

  const isQuestionStep =
    currentStep === 'subscriptions' || currentStep === 'privacy' || currentStep === 'aiFreedom';
  const nextLabel = currentStep === 'aiFreedom' ? 'See your fit' : 'Next';

  if (isPro) {
    return null;
  }

  if (!hydrated) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.framingTitle}>Is Pro right for you?</Text>
      <Text style={styles.framingSub}>{"Let's find your fit—in under a minute."}</Text>
      <Text style={styles.framingRule}>
        Your answers are saved on this device and stay the same after you leave, restart the app, or come back later—you
        can’t change a choice once it’s tapped. This helps us tailor the pitch; upgrading clears this quiz.
      </Text>

      <View style={styles.headerRow}>
        <Text style={styles.stepLabel}>{stepBadge}</Text>
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

      {questionTitle ? <Text style={styles.question}>{questionTitle}</Text> : null}

      {currentQuestionFeedback ? (
        <View style={styles.microFeedbackBox}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={styles.microIcon} />
          <Text style={styles.microFeedbackText}>{currentQuestionFeedback}</Text>
        </View>
      ) : null}

      <View style={styles.options}>
        {isQuestionStep ? renderQuestionOptions() : null}
        {currentStep === 'model' ? renderModelStep() : null}
        {currentStep === 'cta' ? renderCtaStep() : null}
      </View>

      {isQuestionStep && (
        <View style={styles.navRow}>
          <PillButton label="Back" variant="ghost" size="sm" onPress={goBack} disabled={stepIndex === 0} />
          <PillButton
            label={nextLabel}
            variant="primary"
            size="sm"
            onPress={goNext}
            disabled={!hasAnswerForCurrentQuestion}
          />
        </View>
      )}

      {currentStep === 'model' && (
        <View style={styles.navRow}>
          <PillButton label="Back" variant="ghost" size="sm" onPress={goBack} />
        </View>
      )}
    </View>
  );
}

type QuizOptionProps = {
  label: string;
  selected: boolean;
  locked?: boolean;
  onPress: () => void;
};

function QuizOption({ label, selected, locked, onPress }: QuizOptionProps) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected, locked && styles.optionLocked]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={locked}
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
  loadingCard: {
    minHeight: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  framingTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
    textAlign: 'center',
  },
  framingSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  framingRule: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
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
  microFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 163, 127, 0.35)',
  },
  microIcon: {
    marginTop: 2,
  },
  microFeedbackText: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
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
  optionLocked: {
    opacity: 0.85,
  },
  lockedHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 18,
    marginTop: Spacing.xs,
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
  modelHeadline: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightBold,
    marginBottom: Spacing.sm,
  },
  modelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modelActions: {
    gap: Spacing.sm,
  },
  modelPrimaryBtn: {
    alignSelf: 'stretch',
  },
  modelSecondaryWrap: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  modelSecondaryText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.md,
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
