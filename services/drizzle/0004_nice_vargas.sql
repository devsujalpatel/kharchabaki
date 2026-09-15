ALTER TABLE "expense" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "paid_amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "paid_amount" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "interest" SET DATA TYPE numeric(7, 22);--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "interest" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "given_loan_payment" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "income" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "loan_payment" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "taken_loan" ALTER COLUMN "amount" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "taken_loan" ALTER COLUMN "interest" SET DATA TYPE numeric(7, 2);--> statement-breakpoint
ALTER TABLE "taken_loan" ALTER COLUMN "interest" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "balance" SET DATA TYPE numeric(19, 2);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "balance" SET DEFAULT '0.00';