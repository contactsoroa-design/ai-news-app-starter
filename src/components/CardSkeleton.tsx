import React from 'react';
import { StyleSheet, View } from 'react-native';
import { size, themes } from '../theme/tokens';

export function CardSkeleton() {
  const colors = themes.neutral;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.thumbnail,
          { backgroundColor: colors.panel, borderColor: colors.line },
        ]}
      />
      <View style={styles.contentBlock}>
        <View style={styles.sourceRow}>
          <View style={[styles.avatar, { backgroundColor: colors.panel }]} />
          <View style={styles.sourceLines}>
            <View style={[styles.lineShort, { backgroundColor: colors.panel }]} />
            <View style={[styles.lineSub, { backgroundColor: colors.panel }]} />
          </View>
        </View>
        <View style={[styles.headlineLine, { backgroundColor: colors.panel }]} />
        <View style={[styles.headlineLine, { backgroundColor: colors.panel }]} />
        <View style={[styles.headlineLineShort, { backgroundColor: colors.panel }]} />
        <View style={[styles.summaryLine, { backgroundColor: colors.panel }]} />
        <View style={[styles.summaryLine, { backgroundColor: colors.panel }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  thumbnail: {
    position: 'absolute',
    left: size.pageSide,
    right: size.pageSide,
    top: size.thumbTop,
    height: size.thumbHeight,
    borderRadius: size.thumbRadius,
    borderWidth: 1,
  },
  contentBlock: {
    position: 'absolute',
    left: size.pageSide,
    top: size.contentTop,
    right: size.contentRight,
    gap: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: size.sourceIcon,
    height: size.sourceIcon,
    borderRadius: size.sourceIcon / 2,
  },
  sourceLines: {
    gap: 6,
    flex: 1,
  },
  lineShort: {
    height: 14,
    width: '55%',
    borderRadius: 6,
  },
  lineSub: {
    height: 11,
    width: '40%',
    borderRadius: 6,
  },
  headlineLine: {
    height: 22,
    width: '100%',
    borderRadius: 6,
  },
  headlineLineShort: {
    height: 22,
    width: '75%',
    borderRadius: 6,
  },
  summaryLine: {
    height: 15,
    width: '92%',
    borderRadius: 6,
  },
});
