import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Typography } from './Typography';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface Option {
  label: string;
  value: string;
}

interface SelectBottomSheetProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SelectBottomSheet({
  label,
  value,
  options,
  onChange,
  placeholder = 'اختر...',
}: SelectBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const colors = useColors();

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (val: string) => {
    Haptics.selectionAsync();
    onChange(val);
    setIsVisible(false);
  };

  return (
    <View style={styles.container}>
      <Typography variant="label" weight="medium" style={{ marginBottom: 6 }}>
        {label}
      </Typography>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsVisible(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.input,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
        <Typography
          variant="body"
          color={selectedOption ? 'default' : 'muted'}
          style={{ flex: 1, marginRight: 8 }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Typography>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setIsVisible(false)}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: colors.radius * 2,
                borderTopRightRadius: colors.radius * 2,
              },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.closeBtn}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Typography variant="h3" weight="semibold">
                  {label}
                </Typography>
                <View style={{ width: 40 }} />
              </View>
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: value === item.value ? colors.card : 'transparent'
                      },
                    ]}
                    onPress={() => handleSelect(item.value)}
                  >
                    {value === item.value ? (
                      <Feather name="check" size={20} color={colors.primary} />
                    ) : (
                      <View style={{ width: 20 }} />
                    )}
                    <Typography
                      variant="body"
                      weight={value === item.value ? 'semibold' : 'regular'}
                      color={value === item.value ? 'primary' : 'default'}
                      style={{ flex: 1, marginRight: 12 }}
                    >
                      {item.label}
                    </Typography>
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  trigger: {
    borderWidth: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    height: '72%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 8,
    marginLeft: -8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
});
