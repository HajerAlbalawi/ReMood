import React from 'react';
import { TextInput, TextInputProps, View, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Typography } from './Typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const colors = useColors();

  return (
    <View style={containerStyle}>
      {label && (
        <Typography variant="label" weight="medium" style={{ marginBottom: 6 }}>
          {label}
        </Typography>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: colors.foreground },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          {...props}
        />
      </View>
      {error && (
        <Typography variant="caption" color="destructive" style={{ marginTop: 4 }}>
          {error}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
});
