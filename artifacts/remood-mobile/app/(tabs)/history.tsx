import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Platform, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Button, Card } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/contexts/StoreContext';
import { Recommendation } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { RecommendationView } from '@/components/RecommendationView';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const store = useStore();
  const [activeRec, setActiveRec] = useState<Recommendation | null>(null);

  const isWeb = Platform.OS === 'web';

  const handleClear = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('هل أنت متأكد من مسح السجل؟')) {
        store.clearHistory();
      }
    } else {
      Alert.alert(
        'مسح السجل',
        'هل أنت متأكد من مسح جميع الترشيحات السابقة؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'مسح', style: 'destructive', onPress: () => store.clearHistory() }
        ]
      );
    }
  };

  if (activeRec) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          data={[activeRec]}
          keyExtractor={() => 'view'}
          renderItem={({ item }) => <RecommendationView data={item} />}
          contentContainerStyle={{
            paddingTop: insets.top + (isWeb ? 67 : 20),
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
          }}
          ListHeaderComponent={
            <Button
              variant="ghost"
              icon={<Feather name="arrow-right" size={20} color={colors.foreground} />}
              onPress={() => setActiveRec(null)}
              style={{ alignSelf: 'flex-end', marginBottom: 16 }}
            />
          }
        />
      </View>
    );
  }

  if (store.history.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Feather name="clock" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
        <Typography variant="h2" weight="bold" color="muted">لا يوجد سجل</Typography>
        <Typography variant="body" color="muted" align="center" style={{ marginTop: 8, paddingHorizontal: 40 }}>
          الترشيحات التي تقوم بطلبها ستظهر هنا للرجوع إليها لاحقاً.
        </Typography>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 24) }]}>
        <Typography variant="h2" weight="bold">السجل</Typography>
        <Button
          title="مسح"
          variant="ghost"
          size="sm"
          onPress={handleClear}
          textStyle={{ color: colors.destructive }}
        />
      </View>

      <FlatList
        data={store.history}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
        }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => setActiveRec(item)}>
            <Card variant="elevated" style={styles.historyCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Feather name="book-open" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Typography variant="body" weight="semibold">
                    {item.books.length} ترشيحات
                  </Typography>
                  <Typography variant="caption" color="muted">
                    {item.mood} • {item.category}
                  </Typography>
                </View>
                <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  historyCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251,191,36,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
