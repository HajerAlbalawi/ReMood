import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodySm' | 'caption' | 'label';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: 'default' | 'muted' | 'primary' | 'destructive';
}

export function Typography({
  variant = 'body',
  weight = 'regular',
  align = 'right',
  color = 'default',
  style,
  ...props
}: TypographyProps) {
  const colors = useColors();

  const getFontSize = () => {
    switch (variant) {
      case 'h1': return 32;
      case 'h2': return 24;
      case 'h3': return 20;
      case 'body': return 16;
      case 'bodySm': return 14;
      case 'caption': return 12;
      case 'label': return 14;
      default: return 16;
    }
  };

  const getFontFamily = () => {
    switch (weight) {
      case 'regular': return 'Inter_400Regular';
      case 'medium': return 'Inter_500Medium';
      case 'semibold': return 'Inter_600SemiBold';
      case 'bold': return 'Inter_700Bold';
      default: return 'Inter_400Regular';
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'muted': return colors.mutedForeground;
      case 'primary': return colors.primary;
      case 'destructive': return colors.destructive;
      case 'default':
      default: return colors.foreground;
    }
  };

  return (
    <Text
      style={[
        {
          fontSize: getFontSize(),
          fontFamily: getFontFamily(),
          textAlign: align,
          color: getTextColor(),
          writingDirection: 'rtl',
        },
        style,
      ]}
      {...props}
    />
  );
}
