import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeContext';

export function FeatureItem({title}: {title: string}) {
  const {styles} = useAppTheme();

  return (
    <View style={styles.featureItem}>
      <View style={styles.featureDot} />
      <Text style={styles.featureText}>{title}</Text>
    </View>
  );
}
