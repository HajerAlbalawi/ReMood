import { index, pgTable, serial, text, real, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const recommendationsTable = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    city: text("city").notNull(),
    mood: text("mood").notNull(),
    category: text("category").notNull(),
    weatherCondition: text("weather_condition").notNull(),
    temperature: real("temperature").notNull(),
    books: jsonb("books").notNull(),
    moodQuote: text("mood_quote").notNull(),
    aiAnalysis: text("ai_analysis").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("recommendations_user_created_idx").on(table.userId, table.createdAt)],
);

export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({ id: true, createdAt: true });
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type RecommendationRow = typeof recommendationsTable.$inferSelect;
