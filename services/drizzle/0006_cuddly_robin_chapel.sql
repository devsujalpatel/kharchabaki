ALTER TABLE "loan_payment" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "given_loan" ADD COLUMN "total_amount" numeric(19, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "taken_loan" ADD COLUMN "total_amount" numeric(19, 2) NOT NULL;