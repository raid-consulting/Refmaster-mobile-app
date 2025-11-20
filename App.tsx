import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';
import { RecorderScreen } from './src/screens/RecorderScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { ActionButton } from './src/components/ActionButton';

type TabKey = 'home' | 'recorder' | 'review';

const tabCopy: Record<TabKey, string> = {
  home: 'Home',
  recorder: 'Recorder',
  review: 'Review',
};

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');

  const screen = useMemo(() => {
    switch (tab) {
      case 'recorder':
        return <RecorderScreen />;
      case 'review':
        return <ReviewScreen />;
      default:
        return <HomeScreen />;
    }
  }, [tab]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>{screen}</View>
      <View style={styles.tabBar}>
        {(['home', 'recorder', 'review'] as TabKey[]).map((key) => (
          <ActionButton
            key={key}
            label={tabCopy[key]}
            onPress={() => setTab(key)}
            tone={tab === key ? 'primary' : 'ghost'}
          />
        ))}
      </View>
      <Text style={styles.helper}>Skeleton UI for cross-platform development. No binary assets included.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#091522',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  helper: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    paddingBottom: 12,
  },
});
