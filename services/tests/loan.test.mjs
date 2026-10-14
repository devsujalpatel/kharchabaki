import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';

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
    set(value) {
      call.values = value;
      return this;
    },
    for(value) {
      call.lock = value;
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
const { givenLoan, givenLoanPayment, loanPayment, takenLoan, user } =
  await import('../dist/database/schema.js');
const { deleteGivenLoan, deleteTakenLoan, updateGivenLoan, updateTakenLoan } =
  await import('../dist/modules/loan/loan.service.js');
const owner = 'account-a';
const id = '3bbf1152-c594-4981-824b-d45bce0e0a61';
const dueDate = new Date('2099-01-01T00:00:00.000Z');
afterEach(() => {
  selectResults = [];
  writeResults = [];
  calls = [];
  transactions = 0;
});
const balanceWrite = () =>
  calls.find((call) => call.operation === 'update' && call.table === user);

for (const kind of ['taken', 'given']) {
  const table = kind === 'taken' ? takenLoan : givenLoan;
  const paymentTable = kind === 'taken' ? loanPayment : givenLoanPayment;
  const personField = kind === 'taken' ? 'borrowedFrom' : 'borrowerName';
  const update = kind === 'taken' ? updateTakenLoan : updateGivenLoan;
  const remove = kind === 'taken' ? deleteTakenLoan : deleteGivenLoan;

  test(`${kind} loan edit recalculates total and applies principal balance delta`, async () => {
    selectResults = [
      [{ balance: '100.00' }],
      [
        {
          id,
          userId: owner,
          amount: '40.00',
          paidAmount: '10.00',
          totalAmount: '50.00',
        },
      ],
    ];
    writeResults = [
      [{ id, amount: '60.00', totalAmount: '72.00', paidAmount: '10.00' }],
      [],
    ];
    const updated = await update(owner, id, {
      amount: '60.00',
      interest: '20.00',
      dueDate,
      [personField]: 'Updated name',
    });
    assert.equal(updated.totalAmount, '72.00');
    assert.equal(transactions, 1);
    assert.equal(calls[0].lock, 'update');
    assert.equal(calls[1].lock, 'update');
    assert.deepEqual(calls[1].where.params, [id, owner]);
    assert.equal(
      calls.find((call) => call.operation === 'update' && call.table === table)
        .values.status,
      'active',
    );
    assert.equal(balanceWrite(), calls[3]);
    assert.equal(
      Number(balanceWrite().values.balance),
      kind === 'taken' ? 120 : 80,
    );
  });

  test(`${kind} loan edit rejects totals below recorded payments without writes`, async () => {
    selectResults = [
      [{ balance: '100.00' }],
      [
        {
          id,
          userId: owner,
          amount: '40.00',
          paidAmount: '20.00',
          totalAmount: '50.00',
        },
      ],
    ];
    await assert.rejects(
      update(owner, id, {
        amount: '10.00',
        interest: '0.00',
        dueDate,
        [personField]: 'Updated name',
      }),
      (error) => error.statusCode === 400,
    );
    assert.ok(calls.every((call) => call.operation === 'select'));
  });

  test(`${kind} loan delete sums payments and reverses its entire net balance effect`, async () => {
    selectResults = [
      [{ balance: kind === 'taken' ? '60.00' : '40.00' }],
      [{ id, userId: owner, amount: '100.00' }],
      [{ total: '40.00' }],
    ];
    writeResults = [[], []];
    assert.deepEqual(await remove(owner, id), { id });
    assert.equal(transactions, 1);
    assert.equal(calls[0].lock, 'update');
    assert.equal(calls[1].lock, 'update');
    assert.equal(calls[2].table, paymentTable);
    assert.deepEqual(calls[2].where.params, [id]);
    const deletion = calls.find((call) => call.operation === 'delete');
    assert.equal(deletion.table, table);
    assert.deepEqual(deletion.where.params, [id, owner]);
    assert.equal(
      Number(balanceWrite().values.balance),
      kind === 'taken' ? 0 : 100,
    );
  });
}

test('taken loan deletion is blocked when balance cannot cover reversing recorded payments', async () => {
  selectResults = [
    [{ balance: '9.00' }],
    [{ id, userId: owner, amount: '20.00' }],
    [{ total: '10.00' }],
  ];
  await assert.rejects(
    deleteTakenLoan(owner, id),
    (error) => error.statusCode === 400,
  );
  assert.ok(calls.every((call) => call.operation === 'select'));
});

test('missing or unowned loans cannot update balance or be deleted', async () => {
  selectResults = [[{ balance: '100.00' }], []];
  await assert.rejects(
    updateTakenLoan(owner, id, {
      amount: '20.00',
      borrowedFrom: 'Bank',
      dueDate,
      interest: '0.00',
    }),
    (error) => error.statusCode === 404,
  );
  assert.equal(balanceWrite(), undefined);
  assert.deepEqual(calls[1].where.params, [id, owner]);
  calls = [];
  selectResults = [[{ balance: '100.00' }], []];
  await assert.rejects(
    deleteGivenLoan(owner, id),
    (error) => error.statusCode === 404,
  );
  assert.equal(balanceWrite(), undefined);
});
