ALTER TYPE "public"."expense_category" ADD VALUE 'drinks' BEFORE 'vegetables';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'groceries' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'transport' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'insurance' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'subscriptions' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'fitness' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'pets' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'childcare' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'donations' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'taxes' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'investment' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'bonus' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'freelance' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'business' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'rental' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'interest' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'dividends' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'refund' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'pension' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'sale' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "theme" text DEFAULT 'dark' NOT NULL;