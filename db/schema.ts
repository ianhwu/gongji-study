import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const studyProgress = sqliteTable("study_progress", {
  userId: text("user_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});
