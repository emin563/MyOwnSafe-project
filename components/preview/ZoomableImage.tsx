import React from 'react';
import { StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  uri: string;
  style: ImageStyle;
  contentContainerStyle?: ViewStyle;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Pinch-to-zoom for preview screens (react-native-reanimated + gesture-handler).
 */
export function ZoomableImage({ uri, style, contentContainerStyle }: Props) {
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      baseScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = baseScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
      } else if (scale.value > MAX_SCALE) {
        scale.value = withTiming(MAX_SCALE);
      }
      baseScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View style={[styles.center, contentContainerStyle, animatedStyle]}>
        <Image source={{ uri }} style={style} contentFit="contain" transition={200} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
