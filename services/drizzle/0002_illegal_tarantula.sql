CREATE TYPE "public"."expense_category" AS ENUM('food', 'travel', 'shopping', 'bills', 'rent', 'phone', 'beauty', 'clothing', 'fuel', 'gifts', 'electronics', 'snacks', 'vegetables', 'fruits', 'repairs', 'health', 'education', 'entertainment', 'other');--> statement-breakpoint
CREATE TYPE "public"."income_source" AS ENUM('salary', 'pocket-money', 'gift', 'invesment', 'bonues', 'part-time', 'other');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'paid', 'overdue');--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text,
	"spent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "given_loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"paid_amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"borrower_name" text NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"due_date" timestamp NOT NULL,
	"interest" numeric(7, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "given_loan_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"source" "income_source" NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_payment" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taken_loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"borrowed_from" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"paid_amount" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"interest" numeric(7, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "balance" numeric(19, 4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "given_loan" ADD CONSTRAINT "given_loan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "given_loan_payment" ADD CONSTRAINT "given_loan_payment_loan_id_given_loan_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."given_loan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payment" ADD CONSTRAINT "loan_payment_loan_id_taken_loan_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."taken_loan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taken_loan" ADD CONSTRAINT "taken_loan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_user_id_idx" ON "expense" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expense_spent_at_idx" ON "expense" USING btree ("spent_at");--> statement-breakpoint
CREATE INDEX "given_loan_user_id_idx" ON "given_loan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "given_loan_due_date_idx" ON "given_loan" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "given_loan_payment_loan_id_idx" ON "given_loan_payment" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "income_user_id_idx" ON "income" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "income_received_at_idx" ON "income" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "loan_payment_loan_id_idx" ON "loan_payment" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "taken_loan_user_id_idx" ON "taken_loan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "taken_loan_due_date_idx" ON "taken_loan" USING btree ("due_date");