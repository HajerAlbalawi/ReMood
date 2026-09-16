import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Recommendation, BookSuggestion } from '@workspace/api-client-react';
import { Typography, Card } from './ui';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

interface RecommendationViewProps {
  data: Recommendation;
}

export function RecommendationView({ data }: RecommendationViewProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="book-open" size={24} color={colors.primary} />
        </View>
        <Typography variant="h3" weight="bold" color="primary" style={styles.title}>
          مرشد الكتب
        </Typography>
        <Typography variant="bodySm" color="muted" style={styles.subtitle}>
          {data.weatherCondition} • {data.temperature}°C • {data.city}
        </Typography>
      </View>

      <Card style={[styles.quoteCard, { backgroundColor: colors.muted }]}>
        <Feather name="message-square" size={20} color={colors.primary} style={styles.quoteIcon} />
        <Typography variant="body" weight="medium" style={styles.quoteText}>
          "{data.moodQuote}"
        </Typography>
      </Card>

      {data.aiAnalysis && (
        <View style={styles.analysisContainer}>
          <Typography variant="label" weight="bold" color="muted" style={styles.sectionTitle}>
            تحليل الأجواء
          </Typography>
          <Typography variant="body" style={styles.analysisText}>
            {data.aiAnalysis}
          </Typography>
        </View>
      )}

      <View style={styles.booksContainer}>
        <Typography variant="label" weight="bold" color="muted" style={styles.sectionTitle}>
          الترشيحات
        </Typography>
        
        {data.books.map((book: BookSuggestion, idx: number) => (
          <Card key={idx} variant="elevated" style={styles.bookCard}>
            <View style={styles.bookHeader}>
              <View style={styles.bookTitleInfo}>
                <Typography variant="h3" weight="bold" style={styles.bookTitle}>
                  {book.title}
                </Typography>
                <Typography variant="body" color="muted">
                  {book.author}
                </Typography>
              </View>
              <View style={[styles.ratingBadge, { backgroundColor: colors.muted }]}>
                <Feather name="star" size={12} color={colors.primary} />
                <Typography variant="caption" weight="bold" color="primary" style={{ marginLeft: 4 }}>
                  {book.rating}
                </Typography>
              </View>
            </View>
            
            <View style={styles.tagsContainer}>
              <View style={[styles.tag, { borderColor: colors.border }]}>
                <Typography variant="caption" color="muted">{book.category}</Typography>
              </View>
              {book.subcategory && (
                <View style={[styles.tag, { borderColor: colors.border }]}>
                  <Typography variant="caption" color="muted">{book.subcategory}</Typography>
                </View>
              )}
            </View>
            
            <Typography variant="bodySm" style={styles.reasonText}>
              <Typography variant="bodySm" weight="bold">سبب الترشيح: </Typography>
              {book.reason}
            </Typography>

            <View style={[styles.quoteBox, { backgroundColor: colors.muted }]}>
              <Typography variant="caption" style={styles.bookQuote}>
                "{book.quote}"
              </Typography>
            </View>

            {book.contentWarnings && book.contentWarnings.length > 0 && (
              <View style={[styles.warningsBox, { backgroundColor: 'rgba(127,29,29,0.1)' }]}>
                <Feather name="alert-triangle" size={14} color={colors.destructive} />
                <Typography variant="caption" color="destructive" style={{ marginRight: 6 }}>
                  تنبيه محتوى: {book.contentWarnings.join('، ')}
                </Typography>
              </View>
            )}
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(251,191,36,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    writingDirection: 'rtl',
  },
  quoteCard: {
    padding: 16,
    marginBottom: 24,
  },
  quoteIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  quoteText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    marginRight: 4,
  },
  analysisContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  analysisText: {
    lineHeight: 24,
  },
  booksContainer: {
    gap: 16,
  },
  bookCard: {
    padding: 16,
    marginBottom: 16,
  },
  bookHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookTitleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  reasonText: {
    lineHeight: 22,
    marginBottom: 12,
  },
  quoteBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bookQuote: {
    fontStyle: 'italic',
    lineHeight: 20,
  },
  warningsBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
  },
});