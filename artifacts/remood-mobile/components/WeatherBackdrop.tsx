import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface WeatherBackdropProps {
  conditionGroup?: string;
  timeOfDay: TimeOfDay;
  imageUri?: string | null;
}

function gradientFor(condition: string, time: TimeOfDay): [string, string, string] {
  if (condition === 'Rain' || condition === 'Drizzle') {
    return time === 'night'
      ? ['#070b18', '#15253e', '#17232a']
      : ['#182736', '#466275', '#26392f'];
  }
  if (condition === 'Snow') {
    return time === 'night'
      ? ['#090d1d', '#24395d', '#21304b']
      : ['#40536a', '#9eafbf', '#667b86'];
  }
  if (condition === 'Clouds' || condition === 'Atmosphere') {
    return time === 'night'
      ? ['#0b0b18', '#211b2b', '#352523']
      : ['#253340', '#64798a', '#8a7b70'];
  }
  if (condition === 'Thunderstorm') {
    return ['#02040a', '#101827', '#18202b'];
  }
  if (time === 'morning') return ['#071329', '#8d3e13', '#ec9a32'];
  if (time === 'evening') return ['#080014', '#6c173e', '#e8731d'];
  if (time === 'night') return ['#01030d', '#061637', '#102654'];
  return ['#07366a', '#2792d0', '#a9d8e6'];
}

export function WeatherBackdrop({
  conditionGroup = 'Clear',
  timeOfDay,
  imageUri,
}: WeatherBackdropProps) {
  const colors = gradientFor(conditionGroup, timeOfDay);
  const isNight = timeOfDay === 'night';
  const hasClouds = ['Clouds', 'Rain', 'Drizzle', 'Snow', 'Thunderstorm', 'Atmosphere'].includes(conditionGroup);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {imageUri ? (
        <Image source={{ uri: imageUri }} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.customImage]} />
      ) : null}
      <LinearGradient
        colors={['transparent', 'rgba(4, 8, 18, 0.08)', 'rgba(4, 8, 18, 0.72)']}
        style={StyleSheet.absoluteFill}
      />
      {!isNight ? (
        <View
          style={[
            styles.sun,
            timeOfDay === 'morning' ? styles.morningSun : timeOfDay === 'evening' ? styles.eveningSun : styles.afternoonSun,
          ]}
        />
      ) : (
        <View style={styles.moon}>
          <View style={styles.moonCutout} />
        </View>
      )}
      {hasClouds ? (
        <View style={styles.clouds}>
          <View style={[styles.cloud, styles.cloudOne]} />
          <View style={[styles.cloud, styles.cloudTwo]} />
          <View style={[styles.cloud, styles.cloudThree]} />
        </View>
      ) : null}
      <View style={styles.farHills} />
      <View style={styles.midHills} />
      <View style={styles.nearGround} />
      <View style={styles.foreground} />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  customImage: { opacity: 0.48 },
  sun: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffe8a3',
    shadowColor: '#ffae32',
    shadowOpacity: 0.8,
    shadowRadius: 35,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  morningSun: { left: '28%', top: '40%' },
  afternoonSun: { right: '12%', top: '12%' },
  eveningSun: { left: '34%', top: '48%' },
  moon: {
    position: 'absolute',
    right: '15%',
    top: '12%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f4edcf',
    shadowColor: '#b8d1ff',
    shadowOpacity: 0.8,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  moonCutout: {
    position: 'absolute',
    right: -8,
    top: -4,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#071634',
  },
  clouds: StyleSheet.absoluteFill,
  cloud: {
    position: 'absolute',
    height: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(232, 242, 247, 0.24)',
  },
  cloudOne: { top: '15%', left: '-8%', width: '58%' },
  cloudTwo: { top: '23%', right: '-16%', width: '68%', opacity: 0.68 },
  cloudThree: { top: '32%', left: '24%', width: '42%', opacity: 0.42 },
  farHills: {
    position: 'absolute',
    bottom: '19%',
    left: '-15%',
    width: '130%',
    height: '28%',
    borderRadius: 180,
    backgroundColor: 'rgba(18, 49, 49, 0.48)',
    transform: [{ scaleX: 1.3 }],
  },
  midHills: {
    position: 'absolute',
    bottom: '7%',
    left: '-20%',
    width: '140%',
    height: '24%',
    borderRadius: 180,
    backgroundColor: 'rgba(10, 34, 27, 0.74)',
    transform: [{ scaleX: 1.25 }],
  },
  nearGround: {
    position: 'absolute',
    bottom: '-12%',
    left: '-15%',
    width: '130%',
    height: '25%',
    borderRadius: 180,
    backgroundColor: 'rgba(4, 16, 16, 0.9)',
  },
  foreground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '9%',
    backgroundColor: 'rgba(2, 8, 12, 0.96)',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251, 191, 36, 0.12)',
  },
});