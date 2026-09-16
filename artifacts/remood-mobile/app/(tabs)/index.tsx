import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography, Button, Card, SelectBottomSheet } from '@/components/ui';
import { BOOK_LENGTHS, CATEGORIES, CITIES, LANGUAGES, MOODS, READING_STYLES } from '@/constants/options';
import { WeatherBackdrop } from '@/components/WeatherBackdrop';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/contexts/StoreContext';
import { useGoodreadsProfile } from '@/hooks/useGoodreadsProfile';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  RecommendationInputCityBookLang,
  RecommendationInputAgeGroup,
  Recommendation,
  RecommendationInputReadingStyle,
  useCreateRecommendation,
  useGetWeather,
  getGetWeatherQueryKey,
} from '@workspace/api-client-react';
import { RecommendationView } from '@/components/RecommendationView';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function weatherIcon(condition?: string): keyof typeof Feather.glyphMap {
  if (condition === 'Rain' || condition === 'Drizzle') return 'cloud-rain';
  if (condition === 'Thunderstorm') return 'zap';
  if (condition === 'Snow') return 'cloud-snow';
  if (condition === 'Clouds') return 'cloud';
  return 'sun';
}

function Pill({
  label,
  selected,
  onPress,
  colors,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        compact && styles.compactPill,
        {
          backgroundColor: selected ? colors.primary : 'rgba(0, 0, 0, 0.22)',
          borderColor: selected ? colors.primary : 'rgba(255, 255, 255, 0.14)',
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Typography
        variant={compact ? 'caption' : 'bodySm'}
        weight={selected ? 'semibold' : 'regular'}
        style={{ color: selected ? colors.primaryForeground : colors.foreground }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

export default function TabOneScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const store = useStore();
  const isWeb = Platform.OS === 'web';
  const profile = useGoodreadsProfile(store.goodreadsUserId);

  const [cityId, setCityId] = useState(CITIES[0].value);
  const [mood, setMood] = useState(MOODS[0].value);
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [ageGroup, setAgeGroup] = useState<RecommendationInputAgeGroup>('adult');
  const [bookLanguage, setBookLanguage] = useState('ar');
  const [readingStyle, setReadingStyle] = useState('');
  const [bookLength, setBookLength] = useState('');
  const [activeRec, setActiveRec] = useState<Recommendation | null>(null);

  const selectedCity = CITIES.find((city) => city.value === cityId) ?? CITIES[0];
  const timeOfDay = getTimeOfDay();
  const season = getSeason();
  const cityParams = {
    city: selectedCity.label,
    lat: selectedCity.lat,
    lng: selectedCity.lng,
  };
  const { data: weather, isLoading: isWeatherLoading, isError: isWeatherError, refetch: refetchWeather } =
    useGetWeather(cityParams, {
      query: {
        enabled: !!selectedCity,
        queryKey: getGetWeatherQueryKey(cityParams),
      },
    });

  const createRec = useCreateRecommendation({
    mutation: {
      onSuccess: (data: Recommendation) => {
        void store.addRecommendation(data);
        setActiveRec(data);
      },
    },
  });

  const selectedLanguage = LANGUAGES.find((language) => language.value === bookLanguage) ?? LANGUAGES[0];
  const seasonLabel = useMemo(() => {
    const labels: Record<string, string> = {
      spring: 'الربيع',
      summer: 'الصيف',
      autumn: 'الخريف',
      winter: 'الشتاء',
    };
    return labels[season];
  }, [season]);

  const handleGenerate = () => {
    if (!weather || !mood || !category || createRec.isPending) return;
    const previouslyRecommended = store.history.flatMap((recommendation) =>
      recommendation.books.map((book) => book.title),
    );
    const excludedTitles = [...new Set([
      ...profile.excludeBooks,
      ...previouslyRecommended,
    ])].slice(-1800);
    createRec.mutate({
      data: {
        city: selectedCity.label,
        cityName: selectedCity.label,
        mood,
        category,
        weatherCondition: weather.condition,
        temperature: weather.temperature,
        cityBookLang: bookLanguage as RecommendationInputCityBookLang,
        language: bookLanguage,
        ageGroup: ageGroup || undefined,
        bookLength: bookLength || undefined,
        timeOfDay,
        season,
        readingStyle: (readingStyle || undefined) as RecommendationInputReadingStyle | undefined,
        excludeBooks: excludedTitles.length > 0 ? excludedTitles : undefined,
        preferredGenres: profile.preferredGenres.length > 0 ? profile.preferredGenres : undefined,
      },
    });
  };

  if (!store.isReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (activeRec) {
    return (
      <View style={styles.screen}>
        <WeatherBackdrop conditionGroup="Clear" timeOfDay={timeOfDay} />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + (isWeb ? 67 : 16),
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Button
            variant="ghost"
            icon={<Feather name="arrow-right" size={20} color={colors.foreground} />}
            onPress={() => setActiveRec(null)}
            style={{ alignSelf: 'flex-end', marginBottom: 8 }}
          />
          <RecommendationView data={activeRec} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WeatherBackdrop
        conditionGroup={weather?.conditionGroup ?? 'Clear'}
        timeOfDay={timeOfDay}
      />
      <KeyboardAwareScrollViewCompat
        style={styles.transparentScroll}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? 67 : 18),
          paddingBottom: insets.bottom + 112,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.glassBadge}>
              <Feather name="sunrise" size={13} color={colors.primary} />
              <Typography variant="caption" style={styles.translucentText}>{seasonLabel}</Typography>
            </View>
            <View style={styles.glassBadge}>
              <Feather name="clock" size={13} color={colors.primary} />
              <Typography variant="caption" style={styles.translucentText}>{timeOfDay === 'night' ? 'ليلة القارئ' : 'وقت القراءة'}</Typography>
            </View>
          </View>
          <Typography variant="h1" weight="bold" color="primary" style={styles.logo}>ReMood</Typography>
          <Typography variant="body" color="muted" align="center" style={styles.subtitle}>
            رفيقك الشخصي لاختيار الكتاب المناسب لمزاجك
          </Typography>
        </View>

        <Card variant="bordered" style={styles.quoteCard}>
          <Feather name="message-circle" size={22} color={colors.primary} style={{ alignSelf: 'center' }} />
          <Typography align="center" color="muted" style={styles.quote}>
            «كل كتاب هو رحلة جديدة، اختر الرحلة التي تشبه شعورك اليوم.»
          </Typography>
        </Card>

        <Card variant="bordered" style={styles.panel}>
          <View style={styles.sectionHeading}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3" weight="semibold" color="primary">المكان والطقس</Typography>
              <Typography variant="caption" color="muted" style={{ marginTop: 4 }}>
                اكتشف القراءة المناسبة لمكانك وطقسك
              </Typography>
            </View>
            <Feather name="map-pin" size={20} color={colors.primary} />
          </View>
          <SelectBottomSheet
            label="أين أنت الآن؟"
            value={cityId}
            options={CITIES}
            onChange={setCityId}
          />
          <View style={styles.weatherChips}>
            {isWeatherLoading ? (
              <View style={styles.weatherChip}><ActivityIndicator size="small" color={colors.primary} /></View>
            ) : isWeatherError ? (
              <Pressable onPress={() => void refetchWeather()} style={[styles.weatherChip, styles.errorChip]}>
                <Feather name="refresh-cw" size={13} color="#fecaca" />
                <Typography variant="caption" style={{ color: '#fecaca' }}>تعذر تحميل الطقس — أعد المحاولة</Typography>
              </Pressable>
            ) : weather ? (
              <>
                <View style={styles.weatherChip}>
                  <Feather name={weatherIcon(weather.conditionGroup)} size={14} color={colors.primary} />
                  <Typography variant="caption">{Math.round(weather.temperature)}°C</Typography>
                </View>
                <View style={styles.weatherChip}>
                  <Typography variant="caption" color="muted">{weather.condition}</Typography>
                </View>
              </>
            ) : null}
          </View>
          <Typography variant="label" weight="semibold" color="primary" style={styles.fieldLabel}>لغة الكتاب</Typography>
          <View style={styles.wrapRow}>
            {LANGUAGES.map((language) => (
              <Pill
                key={language.value}
                label={language.label}
                selected={bookLanguage === language.value}
                onPress={() => setBookLanguage(language.value)}
                colors={colors}
                compact
              />
            ))}
          </View>
          <Typography variant="caption" color="primary" style={styles.selectedLanguage}>
            {selectedLanguage.label}
          </Typography>
        </Card>

        <Card variant="bordered" style={styles.panel}>
          <View style={styles.sectionHeading}>
            <Typography variant="h3" weight="semibold" color="primary">فئتك العمرية</Typography>
            <Feather name="users" size={20} color={colors.primary} />
          </View>
          <View style={styles.wrapRow}>
            {[
              { label: 'أطفال (8-12)', value: 'children' },
              { label: 'مراهقون (13-17)', value: 'teen' },
              { label: 'بالغون (+18)', value: 'adult' },
            ].map((age) => (
              <Pill key={age.value} label={age.label} selected={ageGroup === age.value} onPress={() => setAgeGroup(age.value as RecommendationInputAgeGroup)} colors={colors} />
            ))}
          </View>
        </Card>

        <Card variant="bordered" style={styles.panel}>
          <View style={styles.sectionHeading}>
            <Typography variant="h3" weight="semibold" color="primary">كيف تشعر الآن؟</Typography>
            <Feather name="compass" size={20} color={colors.primary} />
          </View>
          <View style={styles.wrapRow}>
            {MOODS.map((option) => (
              <Pill key={option.value} label={option.label} selected={mood === option.value} onPress={() => setMood(option.value)} colors={colors} />
            ))}
          </View>
        </Card>

        <Card variant="bordered" style={styles.panel}>
          <View style={styles.sectionHeading}>
            <Typography variant="h3" weight="semibold" color="primary">ماذا تريد أن تقرأ؟</Typography>
            <Feather name="book-open" size={20} color={colors.primary} />
          </View>
          <Typography variant="label" weight="semibold" color="muted" style={styles.fieldLabel}>نوع الاكتشاف</Typography>
          <View style={styles.wrapRow}>
            {READING_STYLES.map((option) => (
              <Pill key={option.value} label={option.label} selected={readingStyle === option.value} onPress={() => setReadingStyle(readingStyle === option.value ? '' : option.value)} colors={colors} compact />
            ))}
          </View>
          <Typography variant="label" weight="semibold" color="muted" style={styles.fieldLabel}>التصنيف المفضل</Typography>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((option) => (
              <Pill key={option.value} label={option.label} selected={category === option.value} onPress={() => setCategory(option.value)} colors={colors} compact />
            ))}
          </View>
        </Card>

        <Card variant="bordered" style={styles.panel}>
          <View style={styles.sectionHeading}>
            <Typography variant="h3" weight="semibold" color="primary">كم عدد صفحات الكتاب؟</Typography>
            <Feather name="book" size={20} color={colors.primary} />
          </View>
          <View style={styles.lengthRow}>
            {BOOK_LENGTHS.map((option) => (
              <Pill key={option.label} label={option.label} selected={bookLength === option.value} onPress={() => setBookLength(option.value)} colors={colors} compact />
            ))}
          </View>
        </Card>

        <Card style={styles.generatePanel}>
          <Button
            title={createRec.isPending ? 'جاري اختيار كتابك...' : 'رشّح لي كتاباً الآن'}
            size="lg"
            isLoading={createRec.isPending}
            disabled={isWeatherLoading || isWeatherError || !weather || !mood || !category}
            onPress={handleGenerate}
            icon={!createRec.isPending ? <Feather name="star" size={18} color={colors.primaryForeground} /> : undefined}
          />
          {profile.isLoading ? (
            <Typography variant="caption" color="muted" align="center" style={{ marginTop: 10 }}>
              جاري استخدام تفضيلات Goodreads...
            </Typography>
          ) : null}
        </Card>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  transparentScroll: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  translucentText: { color: 'rgba(255, 255, 255, 0.78)' },
  header: { alignItems: 'center', marginBottom: 20 },
  badgeRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  glassBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  logo: { fontSize: 48, letterSpacing: -1 },
  subtitle: { marginTop: 4, color: 'rgba(255, 255, 255, 0.72)' },
  quoteCard: { padding: 18, marginBottom: 14, backgroundColor: 'rgba(0, 0, 0, 0.24)' },
  quote: { lineHeight: 25, marginTop: 10 },
  panel: { padding: 16, marginBottom: 14, backgroundColor: 'rgba(5, 12, 24, 0.58)', borderColor: 'rgba(255, 255, 255, 0.14)' },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  fieldLabel: { marginBottom: 8, marginTop: 2 },
  wrapRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  categoryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 40, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  compactPill: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11 },
  selectedLanguage: { marginTop: 8 },
  weatherChips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  weatherChip: {
    minHeight: 32,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  errorChip: { borderColor: 'rgba(248, 113, 113, 0.3)', backgroundColor: 'rgba(127, 29, 29, 0.18)' },
  lengthRow: { flexDirection: 'row-reverse', gap: 8 },
  generatePanel: { padding: 14, marginBottom: 16, backgroundColor: 'rgba(71, 33, 5, 0.46)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.24)' },
});