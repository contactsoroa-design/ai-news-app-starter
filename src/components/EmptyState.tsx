import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size, text, themes } from '../theme/tokens';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container} accessible accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          style={styles.button}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themes.neutral.background,
    paddingHorizontal: size.pageSide,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: text.primary,
    fontSize: size.headline.fontSize,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: text.muted,
    fontSize: size.summary.fontSize,
    textAlign: 'center',
    lineHeight: size.summary.fontSize * size.summary.lineHeight,
  },
  button: {
    marginTop: 20,
    minHeight: size.minTap,
    minWidth: size.minTap,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: themes.neutral.panel,
    borderWidth: 1,
    borderColor: themes.neutral.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: text.primary,
    fontSize: size.summary.fontSize,
    fontWeight: '700',
  },
});
