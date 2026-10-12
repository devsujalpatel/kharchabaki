import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';

// Mock only the database transport; use the actual services and Drizzle SQL expressions.
const dialect = new PgDialect();
let selectResults = [];
let writeResults = [];
let calls = [];
let transactions = 0;
function query(operation, table, result) {
  const call = { operation, table, result };
  calls.push(call);
  const builder = {
    from(value) {
      call.table = value;
      return this;
    },
    where(value) {
      call.where = dialect.sqlToQuery(value);
      return this;
    },
    values(value) {
      call.values = value;
      return this;
    },
    set(value) {
      call.values = value;
      return this;
    },
    for(value) {
      call.lock = value;
      return this;
    },
    orderBy() {
      return this;
    },
    groupBy() {
      return this;
    },
    limit() {
      return this;
    },
    returning() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}
const fake = {
  select() {
    return query('select', null, selectResults.shift() ?? []);
  },
  insert(table) {
    return query('insert', table, writeResults.shift() ?? []);
  },
  update(table) {
    return query('update', table, writeResults.shift() ?? []);
  },
  delete(table) {
    return query('delete', table, writeResults.shift() ?? []);
  },
  transaction(callback) {
    transactions++;
    return callback(fake);
  },
};
mock.module(new URL('../dist/database/client.js', import.meta.url).href, {
  namedExports: { db: fake },
});
const { createIncome } =
  await import('../dist/modules/income/income.service.js');
const { createExpense } =
  await import('../dist/modules/expense/expense.service.js');
const { user, expense } = await import('../dist/database/schema.js');
const { updateTransaction, deleteTransaction, getTransactions } =
  await import('../dist/modules/transactions/transaction.service.js');
const { getDashboardSummary } =
  await import('../dist/modules/summary/summary.service.js');
const {
  incomeInputSchema,
  expenseInputSchema,
  transactionFiltersSchema,
  parseInput,
  monthRange,
} = await import('../dist/modules/transactions/transaction.schema.js');
const owner = 'account-a';
const id = '3bbf1152-c594-4981-824b-d45bce0e0a61';
afterEach(() => {
  selectResults = [];
  writeResults = [];
  calls = [];
  transactions = 0;
});
const balanceWrite = () =>
  calls.find((call) => call.operation === 'update' && call.table === user);

for (const type of ['income', 'expense']) {
  test(`${type} edit adjusts balance by the difference and scopes the record to its owner`, async () => {
    selectResults = [[{ balance: '100.00' }], [{ id, amount: '20.00' }]];
    writeResults = [[{ id, amount: '35.00' }], []];
    await updateTransaction(owner, id, type, {
      amount: 35,
      description: '  corrected  ',
      ...(type === 'income'
        ? { source: 'freelance' }
        : { category: 'groceries' }),
    });
    assert.equal(transactions, 1);
    assert.equal(calls[0].lock, 'update');
    assert.equal(calls[1].lock, 'update');
    assert.deepEqual(calls[1].where.params, [id, owner]);
    const recordWrite = calls.find(
      (call) => call.operation === 'update' && call.table !== user,
    );
    assert.deepEqual(recordWrite.where.params, [id, owner]);
    assert.equal(recordWrite.values.description, 'corrected');
    const change = dialect.sqlToQuery(balanceWrite().values.balance);
    assert.deepEqual(change.params, ['35.00', '20.00']);
    assert.match(
      change.sql,
      type === 'income'
        ? /\+ \$1::numeric - \$2::numeric/
        : /- \$1::numeric \+ \$2::numeric/,
    );
  });
  test(`${type} deletion reverses exactly its amount and checks ownership`, async () => {
    selectResults = [[{ id: owner }]];
    writeResults = [[{ id, amount: '20.35' }], []];
    assert.deepEqual(await deleteTransaction(owner, id, type), { id });
    assert.equal(transactions, 1);
    assert.equal(calls[0].lock, 'update');
    const deletion = calls.find((call) => call.operation === 'delete');
    assert.deepEqual(deletion.where.params, [id, owner]);
    const change = dialect.sqlToQuery(balanceWrite().values.balance);
    assert.deepEqual(change.params, ['20.35']);
    assert.match(
      change.sql,
      type === 'income' ? /- \$1::numeric/ : /\+ \$1::numeric/,
    );
  });
}
test('an expense increase beyond available balance fails before any writes', async () => {
  selectResults = [[{ balance: '10.00' }], [{ id, amount: '20.00' }]];
  await assert.rejects(
    updateTransaction(owner, id, 'expense', {
      amount: 30.01,
      category: 'groceries',
    }),
    (error) => error.statusCode === 400,
  );
  assert.ok(calls.every((call) => call.operation === 'select'));
});
test('lowering an expense still works when a corrected income leaves a negative balance', async () => {
  selectResults = [[{ balance: '-50.00' }], [{ id, amount: '20.00' }]];
  writeResults = [[{ id, amount: '15.00' }], []];
  await updateTransaction(owner, id, 'expense', {
    amount: 15,
    category: 'groceries',
  });
  assert.ok(balanceWrite());
});
test('missing or unowned transaction cannot update the balance', async () => {
  selectResults = [[{ balance: '100.00' }], []];
  await assert.rejects(
    updateTransaction(owner, id, 'income', { amount: 5, source: 'salary' }),
    (error) => error.statusCode === 404,
  );
  assert.equal(balanceWrite(), undefined);
  assert.deepEqual(calls[1].where.params, [id, owner]);
});
test('missing or unowned transaction cannot be deleted or change the balance', async () => {
  selectResults = [[{ id: owner }]];
  writeResults = [[]];
  await assert.rejects(
    deleteTransaction(owner, id, 'expense'),
    (error) => error.statusCode === 404,
  );
  assert.equal(balanceWrite(), undefined);
});
test('monthly history uses occurrence dates, exclusive month bounds, canonical sources, and filters', async () => {
  selectResults = [
    [
      {
        id,
        amount: '20.00',
        source: 'invesment',
        description: 'Dividend',
        occurredAt: new Date('2024-02-02T12:00:00Z'),
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'other',
        amount: '10.00',
        source: 'salary',
        description: 'Pay',
        occurredAt: new Date('2024-02-10T12:00:00Z'),
        createdAt: new Date('2026-01-01'),
      },
    ],
    [],
  ];
  const result = await getTransactions(
    owner,
    parseInput(transactionFiltersSchema, {
      month: '2024-02',
      category: 'investment',
      search: 'DIVIDEND',
    }),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'investment');
  assert.match(calls[0].where.sql, /received_at/);
  assert.deepEqual(calls[0].where.params, [
    owner,
    '2024-02-01T00:00:00.000Z',
    '2024-03-01T00:00:00.000Z',
  ]);
});
test('expense-only history omits the income query and sorts by occurrence date', async () => {
  selectResults = [
    [
      {
        id: 'earlier',
        amount: '1.00',
        category: 'food',
        occurredAt: new Date('2024-02-02'),
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'later',
        amount: '2.00',
        category: 'food',
        occurredAt: new Date('2024-02-03'),
        createdAt: new Date('2025-01-01'),
      },
    ],
  ];
  const result = await getTransactions(
    owner,
    parseInput(transactionFiltersSchema, { type: 'expense' }),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, expense);
  assert.equal(result[0].id, 'later');
});
test('summary fills leap-month days and six monthly buckets, using exact cents for totals', async () => {
  selectResults = [
    [{ balance: '123.45' }],
    [
      { day: '2024-02-01', total: '0.10' },
      { day: '2024-02-29', total: '0.20' },
    ],
    [{ day: '2024-02-15', total: '25.50' }],
    [{ month: '2024-02', total: '0.30' }],
    [{ month: '2024-01', total: '10.00' }],
  ];
  const result = await getDashboardSummary(owner, '2024-02');
  assert.equal(result.balance, '123.45');
  assert.equal(result.income, '0.30');
  assert.equal(result.expense, '25.50');
  assert.equal(result.daily.length, 29);
  assert.equal(result.daily[28].date, '2024-02-29');
  assert.deepEqual(result.daily[1], {
    date: '2024-02-02',
    income: '0.00',
    expense: '0.00',
  });
  assert.equal(result.monthly.length, 6);
  assert.equal(result.monthly[0].date, '2023-09');
  assert.equal(result.monthly[4].expense, '10.00');
  assert.equal(result.monthly[5].income, '0.30');
});
test('month ranges cross year boundaries and reject malformed month inputs', () => {
  const range = monthRange('2025-12');
  assert.equal(range.end.toISOString(), '2026-01-01T00:00:00.000Z');
  for (const month of ['2024-00', '2024-13', 'abc', '0000-01', ['2024-02']]) {
    assert.throws(
      () => parseInput(transactionFiltersSchema, { month }),
      (error) => error.statusCode === 400,
    );
  }
});
test('financial input validation rejects invalid amounts, categories, and dates', () => {
  for (const amount of [0, -1, NaN, Infinity, 1.234, '50']) {
    assert.throws(
      () => parseInput(incomeInputSchema, { amount, source: 'salary' }),
      (error) => error.statusCode === 400,
    );
  }
  assert.throws(() =>
    parseInput(expenseInputSchema, { amount: 1, category: 'made-up' }),
  );
  assert.throws(() =>
    parseInput(incomeInputSchema, {
      amount: 1,
      source: 'salary',
      occurredAt: '2024-02-30T00:00:00Z',
    }),
  );
  for (const source of [
    'investment',
    'bonus',
    'invesment',
    'bonues',
    'freelance',
    'dividends',
    'refund',
    'pension',
  ]) {
    assert.equal(
      parseInput(incomeInputSchema, { amount: 0.01, source }).source,
      source,
    );
  }
  for (const category of [
    'groceries',
    'drinks',
    'insurance',
    'pets',
    'taxes',
  ]) {
    assert.equal(
      parseInput(expenseInputSchema, { amount: 0.01, category }).category,
      category,
    );
  }
});

for (const [type, create] of [
  ['income', createIncome],
  ['expense', createExpense],
]) {
  test(`${type} retry with the same client UUID never changes balance twice`, async () => {
    const input = {
      id,
      amount: 10,
      occurredAt: '2026-10-13T00:00:00.000Z',
      ...(type === 'income' ? { source: 'salary' } : { category: 'food' }),
    };
    const existing = { id, userId: owner, amount: '10.00' };
    selectResults = [
      [{ id: owner, balance: '100.00' }],
      [],
      [{ id: owner, balance: '110.00' }],
      [existing],
    ];
    writeResults = [[existing], []];
    await create(owner, input);
    assert.deepEqual(await create(owner, input), existing);
    assert.equal(calls.filter((call) => call.operation === 'insert').length, 1);
    assert.equal(calls.filter((call) => call.operation === 'update').length, 1);
    assert.equal(
      calls.find((call) => call.operation === 'insert').values.id,
      id,
    );
  });
  test(`${type} cannot reuse a client UUID owned by another account`, async () => {
    selectResults = [
      [{ id: owner, balance: '100.00' }],
      [{ id, userId: 'account-b', amount: '10.00' }],
    ];
    await assert.rejects(
      create(owner, {
        id,
        amount: 10,
        ...(type === 'income' ? { source: 'salary' } : { category: 'food' }),
      }),
      (error) => error.statusCode === 409,
    );
    assert.equal(
      calls.some(
        (call) => call.operation === 'insert' || call.operation === 'update',
      ),
      false,
    );
  });
}
