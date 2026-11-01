import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api, csv, d, fmt, getErrorMessage, today } from './api';

interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  categoryId: number;
}

interface Category {
  id: number;
  name: string;
  userId?: number | null;
}

interface Budget {
  id: number;
  amount: number;
  categoryId: number;
  startDate: string;
  endDate: string;
}

interface ExpenseForm {
  id?: number;
  amount: string;
  description: string;
  date: string;
  categoryId: string;
}

interface BudgetForm {
  id?: number;
  amount: string;
  categoryId: string;
  startDate: string;
  endDate: string;
}

interface AppData {
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
  loading: boolean;
  error: string;
}

function useAll() {
  const [data, setData] = useState<AppData>({
    expenses: [],
    categories: [],
    budgets: [],
    loading: true,
    error: '',
  });

  const load = useCallback(async () => {
    try {
      const [expenses, categories, budgets] = await Promise.all([
        api<Expense[]>('/expenses'),
        api<Category[]>('/categories'),
        api<Budget[]>('/budgets'),
      ]);
      setData({
        expenses: expenses ?? [],
        categories: categories ?? [],
        budgets: budgets ?? [],
        loading: false,
        error: '',
      });
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: getErrorMessage(error) }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryName = (id: number): string =>
    data.categories.find((category) => category.id === id)?.name ?? 'Other';

  return { ...data, load, categoryName };
}

interface BarProps {
  value: number;
  max: number;
  over?: boolean;
}

function Bar({ value, max, over = false }: BarProps) {
  const width = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="bar">
      <div style={{ width: `${width}%`, background: over ? '#D2502F' : '#2A63D6' }} />
    </div>
  );
}

function spent(expenses: Expense[], budget: Budget): number {
  return expenses
    .filter((expense) =>
      expense.categoryId === budget.categoryId
      && d(expense.date) >= d(budget.startDate)
      && d(expense.date) <= d(budget.endDate))
    .reduce((total, expense) => total + expense.amount, 0);
}

interface WrapProps {
  data: AppData;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

function Wrap({ data, title, children, action }: WrapProps) {
  return (
    <main>
      <div className="head"><h1>{title}</h1>{action}</div>
      {data.error && <p className="err" role="alert">{data.error}</p>}
      {data.loading ? <p className="muted">Loading…</p> : children}
    </main>
  );
}

export function Overview() {
  const data = useAll();
  const month = today().slice(0, 7);
  const monthExpenses = data.expenses.filter((expense) => d(expense.date).startsWith(month));
  const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const activeBudgets = data.budgets.filter(
    (budget) => d(budget.startDate) <= today() && d(budget.endDate) >= today(),
  );
  const planned = activeBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  const overBudget = activeBudgets.filter((budget) => spent(data.expenses, budget) > budget.amount);
  const days = [...Array(7)].map((_, index) => {
    const date = new Date(Date.now() - (6 - index) * 864e5);
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString('en', { weekday: 'narrow' }),
      value: data.expenses
        .filter((expense) => d(expense.date) === key)
        .reduce((sum, expense) => sum + expense.amount, 0),
    };
  });
  const maxDay = Math.max(1, ...days.map((day) => day.value));

  return (
    <Wrap data={data} title="Overview">
      {overBudget.length > 0 && (
        <p className="alert">
          Over budget: {overBudget.map((budget) => data.categoryName(budget.categoryId)).join(', ')}
        </p>
      )}
      <div className="grid">
        <section className="card hero">
          <span className="muted">This month · total spent</span>
          <div className="big">{fmt(total)}</div>
          {planned > 0 && (
            <>
              <Bar value={total} max={planned} over={total > planned} />
              <span className="muted">{Math.round((total / planned) * 100)}% of {fmt(planned)} planned</span>
            </>
          )}
        </section>
        <section className="card">
          <span className="muted">Last 7 days</span>
          <div className="chart">
            {days.map((day, index) => (
              <div key={index} title={fmt(day.value)}>
                <i style={{ height: day.value / maxDay * 120 + 4 }} />
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid">
        <section className="card">
          <h2>Budgets</h2>
          {activeBudgets.length ? activeBudgets.map((budget) => {
            const amountSpent = spent(data.expenses, budget);
            return (
              <div key={budget.id} className="bi">
                <div>
                  <b>{data.categoryName(budget.categoryId)}</b>
                  <span className={amountSpent > budget.amount ? 'bad' : 'muted'}>
                    {fmt(amountSpent)} / {fmt(budget.amount)}
                  </span>
                </div>
                <Bar value={amountSpent} max={budget.amount} over={amountSpent > budget.amount} />
              </div>
            );
          }) : <p className="muted">No active budgets.</p>}
        </section>
        <section className="card">
          <h2>Recent</h2>
          {[...data.expenses]
            .sort((left, right) => d(right.date).localeCompare(d(left.date)))
            .slice(0, 6)
            .map((expense) => (
              <div className="row" key={expense.id}>
                <span className="muted">{d(expense.date).slice(5)}</span>
                <b>{expense.description}</b>
                <span className="tag">{data.categoryName(expense.categoryId)}</span>
                <b>{fmt(expense.amount)}</b>
              </div>
            ))}
        </section>
      </div>
    </Wrap>
  );
}

export function Expenses() {
  const data = useAll();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [error, setError] = useState('');

  const rows = useMemo(
    () => data.expenses
      .filter((expense) =>
        (!month || d(expense.date).startsWith(month))
        && (!category || String(expense.categoryId) === category)
        && expense.description.toLowerCase().includes(query.toLowerCase()))
      .sort((left, right) => d(right.date).localeCompare(d(left.date))),
    [data.expenses, query, category, month],
  );

  const blankForm = (): ExpenseForm => ({
    amount: '',
    description: '',
    date: today(),
    categoryId: String(data.categories[0]?.id ?? ''),
  });

  const setField = (key: keyof ExpenseForm) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((current) => current ? { ...current, [key]: event.target.value } : current);
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setError('');
    const body = {
      amount: Number(form.amount),
      description: form.description,
      date: form.date,
      categoryId: Number(form.categoryId),
    };
    try {
      if (form.id) {
        await api(`/expenses/${form.id}`, { method: 'PUT', body });
      } else {
        await api('/expenses', { method: 'POST', body });
      }
      setForm(null);
      await data.load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  async function remove(expense: Expense) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      await data.load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Wrap
      data={data}
      title="Expenses"
      action={<button className="btn" onClick={() => setForm(blankForm())}>Add expense</button>}
    >
      {error && <p className="err">{error}</p>}
      {form && (
        <form className="card form" onSubmit={save}>
          <label>Amount<input type="number" min="1" step="any" required value={form.amount} onChange={setField('amount')} /></label>
          <label>Description<input required value={form.description} onChange={setField('description')} /></label>
          <label>Date<input type="date" required value={d(form.date)} onChange={setField('date')} /></label>
          <label>
            Category
            <select value={form.categoryId} onChange={setField('categoryId')}>
              {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="acts">
            <button className="btn">{form.id ? 'Update' : 'Save'}</button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="filters">
        <input placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button
          className="btn ghost"
          onClick={() => csv('expenses.csv', [
            ['Date', 'Description', 'Category', 'Amount'],
            ...rows.map((expense) => [
              d(expense.date),
              expense.description,
              data.categoryName(expense.categoryId),
              expense.amount,
            ]),
          ])}
        >
          Export CSV
        </button>
      </div>
      <section className="card list">
        {rows.length ? rows.map((expense) => (
          <div className="row" key={expense.id}>
            <span className="muted">{d(expense.date)}</span>
            <b>{expense.description}</b>
            <span className="tag">{data.categoryName(expense.categoryId)}</span>
            <b>{fmt(expense.amount)}</b>
            <span className="acts">
              <button
                className="link"
                onClick={() => setForm({
                  ...expense,
                  amount: String(expense.amount),
                  date: d(expense.date),
                  categoryId: String(expense.categoryId),
                })}
              >
                Edit
              </button>
              <button className="link bad" onClick={() => void remove(expense)}>Delete</button>
            </span>
          </div>
        )) : <p className="muted pad">Nothing here yet.</p>}
        <div className="foot">Total {fmt(rows.reduce((sum, expense) => sum + expense.amount, 0))}</div>
      </section>
    </Wrap>
  );
}

export function Budgets() {
  const data = useAll();
  const [form, setForm] = useState<BudgetForm | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await data.load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  const setField = (key: keyof BudgetForm) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((current) => current ? { ...current, [key]: event.target.value } : current);
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const body = {
      amount: Number(form.amount),
      categoryId: Number(form.categoryId),
      startDate: form.startDate,
      endDate: form.endDate,
    };
    await run(async () => {
      if (form.id) {
        await api(`/budgets/${form.id}`, { method: 'PUT', body });
      } else {
        await api('/budgets', { method: 'POST', body });
      }
      setForm(null);
    });
  }

  const month = today().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const monthEnd = new Date(year, monthNumber, 0).getDate();
  const newBudget = (): BudgetForm => ({
    amount: '',
    categoryId: String(data.categories[0]?.id ?? ''),
    startDate: `${month}-01`,
    endDate: `${month}-${String(monthEnd).padStart(2, '0')}`,
  });

  return (
    <Wrap
      data={data}
      title="Budgets"
      action={<button className="btn" onClick={() => setForm(newBudget())}>New budget</button>}
    >
      {error && <p className="err">{error}</p>}
      {form && (
        <form className="card form" onSubmit={save}>
          <label>Limit<input type="number" min="1" required value={form.amount} onChange={setField('amount')} /></label>
          <label>
            Category
            <select value={form.categoryId} onChange={setField('categoryId')}>
              {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>From<input type="date" required value={d(form.startDate)} onChange={setField('startDate')} /></label>
          <label>To<input type="date" required value={d(form.endDate)} onChange={setField('endDate')} /></label>
          <div className="acts">
            <button className="btn">Save</button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="grid">
        {data.budgets.map((budget) => {
          const amountSpent = spent(data.expenses, budget);
          return (
            <section className="card" key={budget.id}>
              <div className="bi">
                <div>
                  <b>{data.categoryName(budget.categoryId)}</b>
                  <span className={amountSpent > budget.amount ? 'bad' : 'muted'}>
                    {amountSpent > budget.amount
                      ? `${fmt(amountSpent - budget.amount)} over`
                      : `${fmt(budget.amount - amountSpent)} left`}
                  </span>
                </div>
                <Bar value={amountSpent} max={budget.amount} over={amountSpent > budget.amount} />
                <small className="muted">
                  {d(budget.startDate)} → {d(budget.endDate)} · {fmt(amountSpent)} of {fmt(budget.amount)}
                </small>
              </div>
              <div className="acts">
                <button
                  className="link"
                  onClick={() => setForm({
                    ...budget,
                    amount: String(budget.amount),
                    categoryId: String(budget.categoryId),
                    startDate: d(budget.startDate),
                    endDate: d(budget.endDate),
                  })}
                >
                  Edit
                </button>
                <button
                  className="link bad"
                  onClick={() => {
                    if (confirm('Delete budget?')) {
                      void run(() => api(`/budgets/${budget.id}`, { method: 'DELETE' }));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <section className="card">
        <h2>Categories</h2>
        <div className="chips">
          {data.categories.map((item) => (
            <span className="tag" key={item.id}>
              {item.name}
              {item.userId != null && (
                <button
                  className="link bad"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => void run(() => api(`/categories/${item.id}`, { method: 'DELETE' }))}
                >
                  {' '}×
                </button>
              )}
            </span>
          ))}
        </div>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            if (newCategory.trim()) {
              void run(async () => {
                await api('/categories', { method: 'POST', body: { name: newCategory.trim() } });
                setNewCategory('');
              });
            }
          }}
        >
          <input placeholder="New category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          <button className="btn ghost">Add</button>
        </form>
      </section>
    </Wrap>
  );
}

export function Reports() {
  const data = useAll();
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`);
  const [to, setTo] = useState(today());
  const rows = data.expenses.filter((expense) => d(expense.date) >= from && d(expense.date) <= to);
  const total = rows.reduce((sum, expense) => sum + expense.amount, 0);
  const grouped = rows.reduce<Record<string, number>>((totals, expense) => {
    const categoryName = data.categoryName(expense.categoryId);
    totals[categoryName] = (totals[categoryName] ?? 0) + expense.amount;
    return totals;
  }, {});
  const byCategory = Object.entries(grouped).sort((left, right) => right[1] - left[1]);
  const dayCount = Math.max(
    1,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1,
  );

  return (
    <Wrap
      data={data}
      title="Reports"
      action={(
        <button
          className="btn ghost"
          onClick={() => csv('report.csv', [['Category', 'Total'], ...byCategory])}
        >
          Export CSV
        </button>
      )}
    >
      <div className="filters">
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <div className="grid">
        <section className="card"><span className="muted">Total</span><div className="big">{fmt(total)}</div></section>
        <section className="card"><span className="muted">Daily average</span><div className="big">{fmt(total / dayCount)}</div></section>
        <section className="card"><span className="muted">Transactions</span><div className="big">{rows.length}</div></section>
      </div>
      <section className="card">
        <h2>By category</h2>
        {byCategory.map(([name, amount]) => (
          <div className="bi" key={name}>
            <div>
              <b>{name}</b>
              <span className="muted">
                {fmt(amount)} · {Math.round((amount / total) * 100)}%
              </span>
            </div>
            <Bar value={amount} max={byCategory[0]?.[1] ?? 0} />
          </div>
        ))}
        {!byCategory.length && <p className="muted">No data in this range.</p>}
      </section>
    </Wrap>
  );
}
