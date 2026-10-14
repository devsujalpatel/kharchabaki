CREATE TABLE IF NOT EXISTS "finance_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'finance_label_user_id_user_id_fk'
			AND conrelid = 'public.finance_label'::regclass
	) THEN
		ALTER TABLE "finance_label"
			ADD CONSTRAINT "finance_label_user_id_user_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finance_label_user_kind_key_idx" ON "finance_label" USING btree ("user_id", "kind", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_label_user_kind_idx" ON "finance_label" USING btree ("user_id", "kind");
