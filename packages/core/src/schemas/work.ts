import { workIdentifiers, works, workVersions } from "@repo/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const workSchema = createSelectSchema(works);
export const workInsertSchema = createInsertSchema(works).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  searchVector: true,
});

export const workIdentifierSchema = createSelectSchema(workIdentifiers);
export const workIdentifierInsertSchema = createInsertSchema(workIdentifiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const workVersionSchema = createSelectSchema(workVersions);
export const workVersionInsertSchema = createInsertSchema(workVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
