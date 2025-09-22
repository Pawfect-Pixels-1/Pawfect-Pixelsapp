import { pgTable, text, serial, timestamp, varchar, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

/** ───────────────────────────────────────────────────────────
 *  DB: users
 *  ─────────────────────────────────────────────────────────── */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** ───────────────────────────────────────────────────────────
 *  DB: transformations - User's transformation history
 *  ─────────────────────────────────────────────────────────── */
export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'image' or 'video'
  status: varchar("status", { length: 20 }).notNull(), // 'processing', 'completed', 'failed'
  originalFileName: text("original_file_name").notNull(),
  originalFileUrl: text("original_file_url").notNull(), // App Storage URL
  resultFileUrls: jsonb("result_file_urls"), // Array of URLs for transformed results
  transformationOptions: jsonb("transformation_options"), // Store the options used
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/** ───────────────────────────────────────────────────────────
 *  DB: user_files - Metadata for files stored in App Storage
 *  ─────────────────────────────────────────────────────────── */
export const userFiles = pgTable("user_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  originalFileName: text("original_file_name").notNull(),
  fileUrl: text("file_url").notNull(), // App Storage URL
  fileType: varchar("file_type", { length: 50 }).notNull(), // 'image/png', 'video/mp4', etc
  fileSize: integer("file_size"), // in bytes
  transformationId: integer("transformation_id").references(() => transformations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transformations: many(transformations),
  files: many(userFiles),
}));

export const transformationsRelations = relations(transformations, ({ one, many }) => ({
  user: one(users, { fields: [transformations.userId], references: [users.id] }),
  files: many(userFiles),
}));

export const userFilesRelations = relations(userFiles, ({ one }) => ({
  user: one(users, { fields: [userFiles.userId], references: [users.id] }),
  transformation: one(transformations, { fields: [userFiles.transformationId], references: [transformations.id] }),
}));

// Zod schemas
export const insertUserSchema = z.object({
  username: z.string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be 32 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less'),
  email: z.string()
    .email('Invalid email format')
    .optional()
    .nullable()
    .transform(val => val === '' ? null : val)
});

export const insertTransformationSchema = createInsertSchema(transformations);
export const insertUserFileSchema = createInsertSchema(userFiles);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Transformation = typeof transformations.$inferSelect;
export type InsertTransformation = z.infer<typeof insertTransformationSchema>;
export type UserFile = typeof userFiles.$inferSelect;
export type InsertUserFile = z.infer<typeof insertUserFileSchema>;

/** ───────────────────────────────────────────────────────────
 *  Replicate Model: face-to-many-kontext — shared enums/schemas
 *  Mirrors model input schema (style/persona/ratios/output_format).
 *  Source: Model API “Schema” page.
 *  ─────────────────────────────────────────────────────────── */
export const StyleEnum = z.enum([
  "Anime",
  "Cartoon",
  "Clay",
  "Gothic",
  "Graphic Novel",
  "Lego",
  "Memoji",
  "Minecraft",
  "Minimalist",
  "Pixel Art",
  "Random",
  "Simpsons",
  "Sketch",
  "South Park",
  "Toy",
  "Watercolor",
]);

export const PersonaEnum = z.enum([
  "Angel",
  "Astronaut",
  "Demon",
  "Mage",
  "Ninja",
  "Na'vi",
  "None",
  "Random",
  "Robot",
  "Samurai",
  "Vampire",
  "Werewolf",
  "Zombie",
]);

export const AspectRatioEnum = z.enum([
  "match_input_image",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
  "9:21",
  "2:1",
  "1:2",
]);

export const OutputFormatEnum = z.enum(["jpg", "png"]);

/** FLUX.1 Kontext Pro specific enums and schemas */
export const FluxAspectRatioEnum = z.enum([
  "match_input_image",
  "1:1", 
  "16:9",
  "4:3",
  "3:4", 
  "9:16"
]);

export const FluxOutputFormatEnum = z.enum(["jpg", "png", "webp"]);

export const FluxSafetyToleranceEnum = z.union([
  z.literal(0), z.literal(1), z.literal(2), 
  z.literal(3), z.literal(4), z.literal(5)
]);

/** FLUX.1 Kontext Pro options schema */
export const FluxKontextProOptionsSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  aspect_ratio: FluxAspectRatioEnum.optional(),
  output_format: FluxOutputFormatEnum.optional(),
  safety_tolerance: FluxSafetyToleranceEnum.optional(),
  seed: z.number().int().optional(),
  finetune_id: z.string().optional(),
});

/** Options object accepted by our backend (aligned to model) */
export const TransformationOptionsSchema = z.object({
  seed: z.number().int().optional().nullable(),
  style: StyleEnum.optional(),
  persona: PersonaEnum.optional(),
  num_images: z.number().int().min(1).max(10).optional(),
  input_image: z.string().url().optional(), // if present, overrides body.image
  aspect_ratio: AspectRatioEnum.optional(),
  output_format: OutputFormatEnum.optional(),
  preserve_outfit: z.boolean().optional(),
  safety_tolerance: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  preserve_background: z.boolean().optional(),
});

/** Model selector schema */
export const ModelEnum = z.enum(["face-to-many-kontext", "flux-kontext-pro"]);

/** Request from client to server */
export const TransformationRequestSchema = z.object({
  image: z.string(), // data: URI OR https URL (validated server-side)
  model: ModelEnum.optional(), // which transformation model to use
  style: z.string().optional(), // UI tag/telemetry; not required by model
  options: TransformationOptionsSchema.optional(),
});

/** FLUX.1 Kontext Pro specific request schema */
export const FluxKontextProRequestSchema = z.object({
  image: z.string(), // data: URI OR https URL (validated server-side)
  options: FluxKontextProOptionsSchema,
});

// Zod validation for Gen4-Aleph video generation options
export const Gen4AlephOptionsSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).default("16:9"),
  seed: z.number().int().optional(),
  referenceImage: z.string().url().optional(),
  clipSeconds: z.number().min(0.1).max(5).optional(),
});

export const Gen4AlephRequestSchema = z.object({
  video: z.string().min(1, "Video is required"), // data: URI OR https URL
  options: Gen4AlephOptionsSchema,
});

/** Server response (image transform) */
export const TransformationResponseSchema = z.object({
  success: z.boolean(),
  outputs: z.array(z.string().url()).optional(),      // new: array of URLs
  transformedImage: z.string().url().optional(),      // legacy first URL
  operationId: z.string().optional(),
  error: z.string().optional(),
  model: z.string().optional(),                       // which model was used
  meta: z.object({                                     // additional metadata
    predictTime: z.number().optional(),
    imageCount: z.number().optional(),
    version: z.string().optional(),
  }).optional(),
});

/** Server response (video) */
export const VideoGenerationResponseSchema = z.object({
  success: z.boolean(),
  videoUrl: z.string().url().optional(),
  operationId: z.string().optional(),
  error: z.string().optional(),
});

/** Operation status struct (supports array results) */
export const OperationStatusSchema = z.object({
  id: z.string(),
  type: z.union([z.literal("transform"), z.literal("video")]),
  status: z.union([z.literal("processing"), z.literal("completed"), z.literal("failed")]),
  result: z.union([z.array(z.string().url()), z.string().url()]).optional(), // images[] or single video URL
  error: z.string().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
});

export const StatusResponseSchema = z.object({
  success: z.boolean(),
  operation: OperationStatusSchema.optional(),
  error: z.string().optional(),
});

/** TS types */
export type StyleEnumT = z.infer<typeof StyleEnum>;
export type PersonaEnumT = z.infer<typeof PersonaEnum>;
export type AspectRatioEnumT = z.infer<typeof AspectRatioEnum>;
export type OutputFormatEnumT = z.infer<typeof OutputFormatEnum>;
export type ModelEnumT = z.infer<typeof ModelEnum>;
export type FluxAspectRatioEnumT = z.infer<typeof FluxAspectRatioEnum>;
export type FluxOutputFormatEnumT = z.infer<typeof FluxOutputFormatEnum>;
export type FluxSafetyToleranceEnumT = z.infer<typeof FluxSafetyToleranceEnum>;
export type FluxKontextProOptions = z.infer<typeof FluxKontextProOptionsSchema>;
export type FluxKontextProRequest = z.infer<typeof FluxKontextProRequestSchema>;
export type TransformationOptions = z.infer<typeof TransformationOptionsSchema>;
export type TransformationRequest = z.infer<typeof TransformationRequestSchema>;
export type TransformationResponse = z.infer<typeof TransformationResponseSchema>;
export type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>;
export type OperationStatus = z.infer<typeof OperationStatusSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// Gen4-Aleph exports
export type Gen4AlephOptions = z.infer<typeof Gen4AlephOptionsSchema>;
export type Gen4AlephRequest = z.infer<typeof Gen4AlephRequestSchema>;
