import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  decimal,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  balance: decimal('balance', { precision: 19, scale: 4 })
    .default('0.0000')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// ExpenseEnum
export const expenseCategoryEnum = pgEnum('expense_category', [
  'food',
  'travel',
  'shopping',
  'bills',
  'rent',
  'phone',
  'beauty',
  'clothing',
  'fuel',
  'gifts',
  'electronics',
  'snacks',
  'vegetables',
  'fruits',
  'repairs',
  'health',
  'education',
  'entertainment',
  'other',
]);

// IcomeSourceEnum
export const incomeSourceEnum = pgEnum('income_source', [
  'salary',
  'pocket-money',
  'gift',
  'invesment',
  'bonues',
  'part-time',
  'other',
]);

// LoanStatusEnum
export const loanStatusEnum = pgEnum('loan_status', [
  'active',
  'paid',
  'overdue',
]);

// Inome
export const income = pgTable(
  'income',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, {
        onDelete: 'cascade',
      }),
    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    source: incomeSourceEnum('source').notNull(),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('income_user_id_idx').on(table.userId),
    index('income_received_at_idx').on(table.receivedAt),
  ],
);

// Expense
export const expense = pgTable(
  'expense',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, {
        onDelete: 'cascade',
      }),
    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    category: expenseCategoryEnum('category').notNull(),
    description: text('description'),
    spentAt: timestamp('spent_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('expense_user_id_idx').on(table.userId),
    index('expense_spent_at_idx').on(table.spentAt),
  ],
);

// TakenLoan
export const takenLoan = pgTable(
  'taken_loan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),

    borrowedFrom: text('borrowed_from').notNull(),
    dueData: timestamp('due_date').notNull(),
    status: loanStatusEnum('status').default('active').notNull(),
    paidAmount: decimal('paid_amount', {
      precision: 19,
      scale: 4,
    })
      .default('0.0000')
      .notNull(),

    interest: decimal('interest', {
      precision: 7,
      scale: 4,
    })
      .default('0.0000')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('taken_loan_user_id_idx').on(table.userId),
    index('taken_loan_due_date_idx').on(table.dueData),
  ],
);

// LoanPayment
export const loanPayment = pgTable(
  'loan_payment',
  {
    id: uuid('id').defaultRandom().notNull(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => takenLoan.id, {
        onDelete: 'cascade',
      }),
    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    paidAt: timestamp('paid_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('loan_payment_loan_id_idx').on(table.loanId)],
);

// Given Loan
export const givenLoan = pgTable(
  'given_loan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    paidAmount: decimal('paid_amount', {
      precision: 19,
      scale: 4,
    })
      .default('0.0000')
      .notNull(),
    borrowerName: text('borrower_name').notNull(),
    status: loanStatusEnum('status').default('active').notNull(),
    dueDate: timestamp('due_date').notNull(),
    interest: decimal('interest', {
      precision: 7,
      scale: 4,
    })
      .default('0.0000')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('given_loan_user_id_idx').on(table.userId),
    index('given_loan_due_date_idx').on(table.dueDate),
  ],
);

export const givenLoanPayment = pgTable(
  'given_loan_payment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => givenLoan.id, { onDelete: 'cascade' }),
    amount: decimal('amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    paidAt: timestamp('paid_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('given_loan_payment_loan_id_idx').on(table.loanId)],
);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  incomes: many(income),
  expenses: many(expense),
  takenLoans: many(takenLoan),
  givenLoans: many(givenLoan),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const incomeRelations = relations(income, ({ one }) => ({
  user: one(user, {
    fields: [income.userId],
    references: [user.id],
  }),
}));

export const expenseRelations = relations(expense, ({ one }) => ({
  user: one(user, {
    fields: [expense.userId],
    references: [user.id],
  }),
}));

export const takenLoanRelations = relations(takenLoan, ({ one, many }) => ({
  user: one(user, {
    fields: [takenLoan.userId],
    references: [user.id],
  }),
  payments: many(loanPayment),
}));

export const loanPaymentRelations = relations(loanPayment, ({ one }) => ({
  loan: one(takenLoan, {
    fields: [loanPayment.loanId],
    references: [takenLoan.id],
  }),
}));

export const givenLoanRelations = relations(givenLoan, ({ one, many }) => ({
  user: one(user, {
    fields: [givenLoan.userId],
    references: [user.id],
  }),
  payments: many(givenLoanPayment),
}));

export const givenLoanPaymentRelations = relations(
  givenLoanPayment,
  ({ one }) => ({
    loan: one(givenLoan, {
      fields: [givenLoanPayment.loanId],
      references: [givenLoan.id],
    }),
  }),
);
