import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Mirrors plan.md §5 field-for-field. account_id/category_id/etc are plain
// TEXT foreign keys (not declared as SQLite FKs) to keep cross-table
// integrity checks explicit in repository code rather than relying on
// SQLite's optional, easy-to-forget-to-enable foreign_keys pragma.

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  igUserId: text("ig_user_id").notNull(),
  fbPageId: text("fb_page_id").notNull(),
  threadsUserId: text("threads_user_id"),
  categoryFocus: text("category_focus").notNull(), // JSON array of category ids
  timezone: text("timezone").notNull(),
  postingHoursLocal: text("posting_hours_local").notNull(), // JSON array of ints 0-23
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    author: text("author"),
    categoryId: text("category_id").notNull(),
    source: text("source").notNull().default("curated"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("idx_quotes_text_author").on(t.text, t.author)],
);

export const backgrounds = sqliteTable(
  "backgrounds",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id"),
    sourceUrl: text("source_url").notNull(),
    description: text("description"),
    attribution: text("attribution"),
    categoryId: text("category_id"),
    darkness: text("darkness", { enum: ["dark", "light"] }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("idx_backgrounds_external").on(t.source, t.externalId)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    quoteId: text("quote_id"),
    backgroundId: text("background_id"),
    audioId: text("audio_id"),
    templateId: text("template_id").notNull(),
    captionTemplateId: text("caption_template_id").notNull(),
    mode: text("mode", { enum: ["dark", "light"] }).notNull(),
    composedImagePath: text("composed_image_path"),
    igMediaId: text("ig_media_id"),
    igPermalink: text("ig_permalink"),
    threadsPostId: text("threads_post_id"),
    storiesMediaId: text("stories_media_id"),
    status: text("status", { enum: ["pending", "published", "failed"] }).notNull(),
    errorMessage: text("error_message"),
    views: integer("views").default(0),
    scheduledFor: text("scheduled_for").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_posts_account_status").on(t.accountId, t.status),
    index("idx_posts_account_published_at").on(t.accountId, t.publishedAt),
  ],
);

export const quoteUsage = sqliteTable(
  "quote_usage",
  {
    accountId: text("account_id").notNull(),
    quoteId: text("quote_id").notNull(),
    postId: text("post_id").notNull(),
    usedAt: text("used_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.quoteId, t.postId] })],
);

export const backgroundUsage = sqliteTable(
  "background_usage",
  {
    accountId: text("account_id").notNull(),
    backgroundId: text("background_id").notNull(),
    postId: text("post_id").notNull(),
    usedAt: text("used_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.backgroundId, t.postId] })],
);

export const audioUsage = sqliteTable(
  "audio_usage",
  {
    accountId: text("account_id").notNull(),
    audioId: text("audio_id").notNull(),
    postId: text("post_id").notNull(),
    usedAt: text("used_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.audioId, t.postId] })],
);

export const settings = sqliteTable(
  "settings",
  {
    accountId: text("account_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(), // JSON-encoded
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.key] })],
);

export const igToken = sqliteTable("ig_token", {
  accountId: text("account_id").primaryKey(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  expiresAt: text("expires_at").notNull(),
  threadsAccessTokenEncrypted: text("threads_access_token_encrypted"),
  threadsExpiresAt: text("threads_expires_at"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const embeddingCache = sqliteTable("embedding_cache", {
  textHash: text("text_hash").primaryKey(),
  inputText: text("input_text").notNull(),
  vector: text("vector").notNull(), // JSON array of floats
  provider: text("provider").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
