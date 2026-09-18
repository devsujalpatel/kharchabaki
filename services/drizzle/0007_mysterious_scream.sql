ALTER TABLE "given_loan" ALTER COLUMN "interest" SET DATA TYPE numeric(7, 2);--> statement-breakpoint
ALTER TABLE "given_loan" ALTER COLUMN "interest" SET DEFAULT '0.00';