import { timestamp, uuid } from "drizzle-orm/pg-core";

/** UUIDv7 primary key. Values are generated in application code (packages/core's `generateId`),
 * never by the database — see docs/CONTEXT.md section 18, decision 6. */
export const id = () => uuid().primaryKey();

export const uuidRef = () => uuid();

/** Every user-generated row gets these three, per docs/CONTEXT.md section 6 and section 18
 * decision 12 (soft deletes + audit log). `updatedAt` is maintained by Drizzle's `$onUpdate`,
 * which only fires for writes issued through this package — see packages/db's own note in
 * CLAUDE.md-equivalent docs that apps/api and apps/worker are the only DB callers. */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp({ withTimezone: true }),
};

/** Global (non-user-owned) scholarly records don't soft-delete the same way — see
 * work_redirects in docs/CONTEXT.md section 6.1: "Never hard-delete a work that has notes." */
export const createdUpdatedAt = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
