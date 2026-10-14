CREATE TABLE "recurring_occurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recurring_transaction_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"transaction_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_occurrence" ADD CONSTRAINT "recurring_occurrence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrence" ADD CONSTRAINT "recurring_occurrence_recurring_transaction_id_recurring_transaction_id_fk" FOREIGN KEY ("recurring_transaction_id") REFERENCES "public"."recurring_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_occurrence_schedule_idx" ON "recurring_occurrence" USING btree ("recurring_transaction_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_occurrence_transaction_idx" ON "recurring_occurrence" USING btree ("transaction_id");