import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';

export function WaveformVisualizer({isRecording, colors}: {isRecording: boolean, colors: any}) {
  const animValues = useRef([...Array(10)].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (isRecording) {
      const animations = animValues.map((anim) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 3 + 1,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
          ])
        );
      });
      animations.forEach(a => a.start());
      return () => animations.forEach(a => a.stop());
    } else {
        animValues.forEach(anim => anim.setValue(1));
    }
  }, [isRecording, animValues]);

  return (
    <View style={localStyles.container}>
      {animValues.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            localStyles.bar,
            {
              backgroundColor: colors.primary,
              transform: [{scaleY: anim}],
            },
          ]}
        />
      ))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 60,
    width: '100%',
    marginVertical: 20,
  },
  bar: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
});
