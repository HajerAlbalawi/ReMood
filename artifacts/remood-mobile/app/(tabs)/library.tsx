import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Button, Card, Input } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/contexts/StoreContext';
import { useGoodreadsProfile } from '@/hooks/useGoodreadsProfile';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

function extractGoodreadsUserId(value: string): string {
  return value.trim().match(/\d{1,20}/)?.[0] ?? '';
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const store = useStore();
  const profile = useGoodreadsProfile(store.goodreadsUserId);

  const [inputVal, setInputVal] = useState(store.goodreadsUserId || '');
  const [isEditing, setIsEditing] = useState(!store.goodreadsUserId);

  const isWeb = Platform.OS === 'web';

  const handleSave = () => {
    const val = extractGoodreadsUserId(inputVal);
    if (!val) {
      store.setGoodreadsUserId(null);
    } else {
      store.setGoodreadsUserId(val);
    }
    setIsEditing(false);
  };

  const handleDisconnect = () => {
    store.setGoodreadsUserId(null);
    setInputVal('');
    setIsEditing(true);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + (isWeb ? 67 : 24),
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.header}>
        <Feather name="book" size={32} color={colors.primary} style={{ marginBottom: 16 }} />
        <Typography variant="h2" weight="bold">مكتبتي في Goodreads</Typography>
        <Typography variant="body" color="muted" align="center" style={{ marginTop: 8 }}>
          اربط حسابك لتخصيص الترشيحات وتجنب الكتب التي قرأتها سابقاً.
        </Typography>
      </View>

      {isEditing ? (
        <Card style={styles.card}>
          <Input
            label="رقم حساب Goodreads"
            placeholder="مثال: 12345678"
            value={inputVal}
            onChangeText={setInputVal}
            keyboardType="default"
            containerStyle={{ marginBottom: 16 }}
          />
          <Button
            title="حفظ وارتباط"
            onPress={handleSave}
            disabled={!inputVal.trim()}
          />
          {store.goodreadsUserId && (
            <Button
              title="إلغاء"
              variant="ghost"
              onPress={() => {
                setInputVal(store.goodreadsUserId || '');
                setIsEditing(false);
              }}
              style={{ marginTop: 8 }}
            />
          )}
        </Card>
      ) : (
        <View style={styles.connectedContainer}>
          <Card variant="elevated" style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
                <Feather name="check" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Typography variant="h3" weight="semibold">حساب متصل</Typography>
                <Typography variant="bodySm" color="muted">ID: {store.goodreadsUserId}</Typography>
              </View>
              <Button variant="ghost" size="sm" icon={<Feather name="edit-2" size={16} color={colors.foreground} />} onPress={() => setIsEditing(true)} />
            </View>

            {profile.isLoading && (
              <Typography variant="bodySm" color="muted" align="center" style={{ marginTop: 16 }}>
                جاري جلب البيانات...
              </Typography>
            )}

            {!profile.isLoading && (
              <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                  <Typography variant="h2" weight="bold" color="primary">
                    {profile.shelves.read?.estimatedTotal || 0}
                  </Typography>
                  <Typography variant="caption" color="muted">قرأتها</Typography>
                </View>
                <View style={styles.statBox}>
                  <Typography variant="h2" weight="bold" color="primary">
                    {profile.shelves.currentlyReading?.estimatedTotal || 0}
                  </Typography>
                  <Typography variant="caption" color="muted">أقرأها</Typography>
                </View>
                <View style={styles.statBox}>
                  <Typography variant="h2" weight="bold" color="primary">
                    {profile.shelves.toRead?.estimatedTotal || 0}
                  </Typography>
                  <Typography variant="caption" color="muted">أنوي قراءتها</Typography>
                </View>
              </View>
            )}

            {!profile.isLoading && profile.preferredGenres.length > 0 && (
              <View style={styles.genresContainer}>
                <Typography variant="label" weight="semibold" style={{ marginBottom: 12 }}>
                  تفضيلات القراءة المستنتجة:
                </Typography>
                <View style={styles.tagsContainer}>
                  {profile.preferredGenres.slice(0, 8).map(genre => (
                    <View key={genre} style={[styles.tag, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Typography variant="caption">{genre}</Typography>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Card>

          <Button
            title="إلغاء الارتباط"
            variant="destructive"
            onPress={handleDisconnect}
            style={{ marginTop: 24 }}
          />
        </View>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  card: {
    padding: 20,
  },
  connectedContainer: {
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statBox: {
    alignItems: 'center',
  },
  genresContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tagsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});
