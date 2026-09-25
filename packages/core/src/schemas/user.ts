import { affiliations, users } from "@repo/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const userSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const affiliationSchema = createSelectSchema(affiliations);
export const affiliationInsertSchema = createInsertSchema(affiliations).omit({
  id: true,
  userId: true,
  verificationMethod: true,
  verifiedEmailDomain: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});
