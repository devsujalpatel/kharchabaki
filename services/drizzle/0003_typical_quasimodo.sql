ALTER TABLE "given_loan" ALTER COLUMN "paid_amount" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "interest" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "taken_loan" ALTER COLUMN "paid_amount" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "taken_loan" ALTER COLUMN "interest" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "balance" SET DEFAULT '0.00';