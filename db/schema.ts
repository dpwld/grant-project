import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("grant_profiles", {
  owner: text("owner").primaryKey(), data: text("data").notNull(),
});
export const programs = sqliteTable("grant_programs", {
  owner: text("owner").notNull(), id: text("id").notNull(), data: text("data").notNull(),
}, table => [primaryKey({ columns: [table.owner, table.id] })]);
export const syncRuns = sqliteTable("grant_sync_runs", {
  owner: text("owner").notNull(), id: text("id").notNull(), data: text("data").notNull(),
}, table => [primaryKey({ columns: [table.owner, table.id] })]);
