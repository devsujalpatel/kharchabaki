CREATE TABLE "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(19, 2) NOT NULL,
	"alert_threshold" numeric(5, 2) DEFAULT '80.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(19, 2) NOT NULL,
	"category" text,
	"description" text,
	"schedule" text NOT NULL,
	"interval" numeric(5, 0) DEFAULT '1' NOT NULL,
	"day_of_month" numeric(2, 0),
	"start_at" timestamp NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"end_at" timestamp,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "income" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "given_loan" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_label" ADD CONSTRAINT "finance_label_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction" ADD CONSTRAINT "recurring_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_user_month_category_idx" ON "budget" USING btree ("user_id","month","category");--> statement-breakpoint
CREATE INDEX "budget_user_month_idx" ON "budget" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_label_user_kind_key_idx" ON "finance_label" USING btree ("user_id","kind","key");--> statement-breakpoint
CREATE INDEX "finance_label_user_kind_idx" ON "finance_label" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "recurring_transaction_user_next_run_idx" ON "recurring_transaction" USING btree ("user_id","enabled","next_run_at");--> statement-breakpoint
DROP TYPE "public"."expense_category";--> statement-breakpoint
DROP TYPE "public"."income_source";