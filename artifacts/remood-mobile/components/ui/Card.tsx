import React from 'react';
import { View, ViewStyle, StyleSheet, ViewProps, StyleProp } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'bordered';
}

export function Card({ style, variant = 'default', ...props }: CardProps) {
  const colors = useColors();

  const getStyles = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      overflow: 'hidden',
    };

    if (variant === 'bordered') {
      base.borderWidth = 1;
      base.borderColor = colors.border;
    } else if (variant === 'elevated') {
      base.shadowColor = '#000';
      base.shadowOffset = { width: 0, height: 4 };
      base.shadowOpacity = 0.3;
      base.shadowRadius = 8;
      base.elevation = 5;
    }

    return base;
  };

  return <View style={[getStyles(), style]} {...props} />;
}
