import { useState } from 'react';
import { useLocalStorage } from './utils/useLocalStorage';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard,
  Calendar,
  PieChart,
  Clock,
  Trash2,
  Utensils,
  History
} from 'lucide-react';

interface Transaction {
  id: string;
  type: 'ingreso' | 'gasto';
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMethod: 'efectivo' | 'online' | 'junaeb';
}

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'mensual' | 'anual';
  nextPayment: string;
  dayOfMonth?: number; // Día del mes que cobra (1-31)
}

interface WorkEntry {
  id: string;
  hours: number;
  rate: number;
  date: string;
  total: number;
}

export default function App() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>('subscriptions', []);
  const [workEntries, setWorkEntries] = useLocalStorage<WorkEntry[]>('workEntries', []);
  const [hourlyRate, setHourlyRate] = useLocalStorage<number>('hourlyRate', 2950);
  const [initialCash, setInitialCash] = useLocalStorage<number>('initialCash', 0);
  const [initialOnline, setInitialOnline] = useLocalStorage<number>('initialOnline', 0);
  const [junaebBalance, setJunaebBalance] = useLocalStorage<number>('junaebBalance', 0);
  
  // Modal states
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false);
  const [showJunaebModal, setShowJunaebModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  // Form states
  const [hours, setHours] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('comida');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'online' | 'junaeb'>('efectivo');
  
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subFrequency, setSubFrequency] = useState<'mensual' | 'anual'>('mensual');
  const [subDayOfMonth, setSubDayOfMonth] = useState<number>(1);

  // Calculations
  const totalIncome = workEntries.reduce((sum, entry) => sum + entry.total, 0);
  const totalExpenses = transactions
    .filter(t => t.type === 'gasto')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const cashBalance = transactions.reduce((sum, t) => {
    if (t.paymentMethod !== 'efectivo') return sum;
    return t.type === 'ingreso' ? sum + t.amount : sum - t.amount;
  }, initialCash);

  const onlineBalance = transactions.reduce((sum, t) => {
    if (t.paymentMethod !== 'online') return sum;
    return t.type === 'ingreso' ? sum + t.amount : sum - t.amount;
  }, initialOnline);

  const currentJunaebBalance = transactions.reduce((sum, t) => {
    if (t.paymentMethod !== 'junaeb') return sum;
    return t.type === 'ingreso' ? sum + t.amount : sum - t.amount;
  }, junaebBalance);

  // Total balance is the sum of all your money
  const totalBalance = cashBalance + onlineBalance + currentJunaebBalance;
  
  const monthlySubscriptionCost = subscriptions
    .filter(s => s.frequency === 'mensual')
    .reduce((sum, s) => sum + s.amount, 0);

  // Add income from work
  const addWorkEntry = () => {
    if (!hours || !hourlyRate) return;
    
    const hoursNum = parseFloat(hours);
    const total = hoursNum * hourlyRate;
    
    const entry: WorkEntry = {
      id: Date.now().toString(),
      hours: hoursNum,
      rate: hourlyRate,
      date: new Date().toISOString(),
      total
    };
    
    setWorkEntries([entry, ...workEntries]);
    
    const transaction: Transaction = {
      id: Date.now().toString(),
      type: 'ingreso',
      amount: total,
      category: 'trabajo',
      description: `${hoursNum}h trabajadas`,
      date: new Date().toISOString(),
      paymentMethod: 'online'
    };
    
    setTransactions([transaction, ...transactions]);
    setHours('');
    setShowIncomeModal(false);
  };

  // Add expense
  const addExpense = () => {
    if (!expenseAmount) return;
    
    // Validate JUNAEB can only be used for food
    if (paymentMethod === 'junaeb' && expenseCategory !== 'comida') {
      alert('JUNAEB solo se puede usar para gastos de comida');
      return;
    }

    // Validate JUNAEB has enough balance
    if (paymentMethod === 'junaeb' && parseFloat(expenseAmount) > currentJunaebBalance) {
      alert(`No tienes suficiente saldo JUNAEB. Disponible: ${formatCurrency(currentJunaebBalance)}`);
      return;
    }
    
    const transaction: Transaction = {
      id: Date.now().toString(),
      type: 'gasto',
      amount: parseFloat(expenseAmount),
      category: expenseCategory,
      description: expenseDescription,
      date: new Date().toISOString(),
      paymentMethod
    };
    
    setTransactions([transaction, ...transactions]);
    setExpenseAmount('');
    setExpenseDescription('');
    setPaymentMethod('efectivo');
    setShowExpenseModal(false);
  };

  // Add subscription
  const addSubscription = () => {
    if (!subName || !subAmount) return;
    
    // Calculate next payment date
    const today = new Date();
    const nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), subDayOfMonth);
    
    // If the day has already passed this month, set it for next month
    if (nextPaymentDate <= today) {
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    }
    
    const subscription: Subscription = {
      id: Date.now().toString(),
      name: subName,
      amount: parseFloat(subAmount),
      frequency: subFrequency,
      nextPayment: nextPaymentDate.toISOString(),
      dayOfMonth: subFrequency === 'mensual' ? subDayOfMonth : undefined
    };
    
    setSubscriptions([subscription, ...subscriptions]);
    setSubName('');
    setSubAmount('');
    setSubDayOfMonth(1);
    setShowSubscriptionModal(false);
  };

  const deleteTransaction = (id: string) => {
    // Also delete work entry if it's an income from work
    const transaction = transactions.find(t => t.id === id);
    if (transaction?.category === 'trabajo') {
      const workEntry = workEntries.find(w => w.date === transaction.date);
      if (workEntry) {
        setWorkEntries(workEntries.filter(w => w.id !== workEntry.id));
      }
    }
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const deleteSubscription = (id: string) => {
    setSubscriptions(subscriptions.filter(s => s.id !== id));
  };

  const deleteWorkEntry = (id: string) => {
    const entry = workEntries.find(w => w.id === id);
    if (entry) {
      // Also delete the corresponding transaction
      const transaction = transactions.find(t => 
        t.category === 'trabajo' && t.date === entry.date
      );
      if (transaction) {
        setTransactions(transactions.filter(t => t.id !== transaction.id));
      }
    }
    setWorkEntries(workEntries.filter(w => w.id !== id));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatNextPayment = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Vencido';
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 7) return `En ${diffDays} días`;
    
    return formatDate(dateString);
  };

  const expenseCategories = [
    { value: 'comida', label: '🍔 Comida', color: 'bg-orange-500' },
    { value: 'transporte', label: '🚌 Transporte', color: 'bg-blue-500' },
    { value: 'estudios', label: '📚 Estudios', color: 'bg-purple-500' },
    { value: 'entretenimiento', label: '🎮 Entretenimiento', color: 'bg-pink-500' },
    { value: 'salud', label: '💊 Salud', color: 'bg-green-500' },
    { value: 'ropa', label: '👕 Ropa', color: 'bg-indigo-500' },
    { value: 'otros', label: '📦 Otros', color: 'bg-gray-500' }
  ];

  const getCategoryInfo = (category: string) => {
    return expenseCategories.find(c => c.value === category) || expenseCategories[expenseCategories.length - 1];
  };

  const expensesByCategory = expenseCategories.map(cat => ({
    ...cat,
    total: transactions
      .filter(t => t.type === 'gasto' && t.category === cat.value)
      .reduce((sum, t) => sum + t.amount, 0)
  })).filter(cat => cat.total > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-gray-100">
            {/* Header */}
      <div className="border-b border-gray-800 bg-black/40 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 shadow-lg shadow-emerald-500/20">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Mi Dinero
                </h1>
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  Datos guardados automáticamente
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Balance Total</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Balance Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Cash Balance */}
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <span className="text-xs font-medium text-gray-500">EFECTIVO</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(cashBalance)}</p>
          </div>

          {/* Online Balance */}
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="text-xs font-medium text-gray-500">ONLINE</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(onlineBalance)}</p>
          </div>

          {/* JUNAEB Balance */}
          <div 
            onClick={() => setShowJunaebModal(true)}
            className="cursor-pointer rounded-2xl border border-orange-800 bg-gradient-to-br from-orange-900/40 to-orange-800/20 p-6 shadow-xl transition hover:from-orange-900/50 hover:to-orange-800/30"
          >
            <div className="flex items-center justify-between mb-2">
              <Utensils className="h-5 w-5 text-orange-400" />
              <span className="text-xs font-medium text-orange-500">JUNAEB</span>
            </div>
            <p className="text-2xl font-bold text-orange-300">{formatCurrency(currentJunaebBalance)}</p>
            <p className="mt-1 text-xs text-orange-500">Solo comida • Día 1</p>
          </div>

          {/* Total Income */}
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-xs font-medium text-gray-500">INGRESOS</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(totalIncome)}</p>
          </div>

          {/* Total Expenses */}
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
              <span className="text-xs font-medium text-gray-500">GASTOS</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-5">
          <button
            onClick={() => setShowInitialBalanceModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-800 bg-gradient-to-br from-blue-900/50 to-blue-800/30 px-6 py-4 font-semibold text-blue-300 shadow-lg transition hover:from-blue-800/60 hover:to-blue-700/40 hover:shadow-blue-500/20"
          >
            <Wallet className="h-5 w-5" />
            Balance Inicial
          </button>

          <button
            onClick={() => setShowCalendarModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-yellow-800 bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 px-6 py-4 font-semibold text-yellow-300 shadow-lg transition hover:from-yellow-800/60 hover:to-yellow-700/40 hover:shadow-yellow-500/20"
          >
            <History className="h-5 w-5" />
            Historial
          </button>

          <button
            onClick={() => setShowIncomeModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-800 bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 px-6 py-4 font-semibold text-emerald-300 shadow-lg transition hover:from-emerald-800/60 hover:to-emerald-700/40 hover:shadow-emerald-500/20"
          >
            <Clock className="h-5 w-5" />
            Registrar Horas
          </button>
          
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-800 bg-gradient-to-br from-red-900/50 to-red-800/30 px-6 py-4 font-semibold text-red-300 shadow-lg transition hover:from-red-800/60 hover:to-red-700/40 hover:shadow-red-500/20"
          >
            <TrendingDown className="h-5 w-5" />
            Agregar Gasto
          </button>

          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-purple-800 bg-gradient-to-br from-purple-900/50 to-purple-800/30 px-6 py-4 font-semibold text-purple-300 shadow-lg transition hover:from-purple-800/60 hover:to-purple-700/40 hover:shadow-purple-500/20"
          >
            <Calendar className="h-5 w-5" />
            Nueva Suscripción
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Transactions & Subscriptions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Transactions */}
            <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Transacciones Recientes
              </h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No hay transacciones aún</p>
                ) : (
                  transactions.slice(0, 10).map(transaction => {
                    const categoryInfo = getCategoryInfo(transaction.category);
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 transition hover:bg-gray-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg ${categoryInfo.color} flex items-center justify-center text-white font-bold`}>
                            {transaction.type === 'ingreso' ? '+' : '-'}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {transaction.description || categoryInfo.label}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{formatDate(transaction.date)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                {transaction.paymentMethod === 'efectivo' ? (
                                  <Wallet className="h-3 w-3" />
                                ) : transaction.paymentMethod === 'online' ? (
                                  <CreditCard className="h-3 w-3" />
                                ) : (
                                  <Utensils className="h-3 w-3" />
                                )}
                                {transaction.paymentMethod === 'junaeb' ? 'JUNAEB' : transaction.paymentMethod}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`text-lg font-bold ${
                            transaction.type === 'ingreso' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {transaction.type === 'ingreso' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Subscriptions */}
            <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Suscripciones y Gastos Fijos
                </h2>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Mensual</p>
                  <p className="text-lg font-bold text-purple-400">{formatCurrency(monthlySubscriptionCost)}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {subscriptions.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No hay suscripciones registradas</p>
                ) : (
                  subscriptions.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/30 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">{sub.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{sub.frequency}</span>
                          {sub.dayOfMonth && (
                            <>
                              <span>•</span>
                              <span>Día {sub.dayOfMonth} de cada mes</span>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-yellow-400">
                          Próximo cobro: {formatNextPayment(sub.nextPayment)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-purple-400">{formatCurrency(sub.amount)}</p>
                        <button
                          onClick={() => deleteSubscription(sub.id)}
                          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-500/20 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Analysis */}
          <div className="space-y-6">
            {/* Work Summary */}
            <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <Clock className="h-5 w-5 text-blue-400" />
                Trabajo
              </h2>
              
              <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Tarifa por Hora
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={hourlyRate || ''}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-gray-400">$/h</span>
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {workEntries.length === 0 ? (
                  <p className="text-center py-4 text-xs text-gray-500">No hay registros</p>
                ) : (
                  workEntries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg bg-gray-900/50 p-2 text-xs">
                      <div>
                        <span className="text-white font-medium">{entry.hours}h</span>
                        <span className="text-gray-500 ml-2">{formatDate(entry.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{formatCurrency(entry.total)}</span>
                        <button
                          onClick={() => deleteWorkEntry(entry.id)}
                          className="rounded p-1 text-gray-500 transition hover:bg-red-500/20 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border-t border-gray-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Horas</span>
                  <span className="font-bold text-white">
                    {workEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Ganado</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(totalIncome)}</span>
                </div>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <PieChart className="h-5 w-5 text-yellow-400" />
                Gastos por Categoría
              </h2>
              
              <div className="space-y-3">
                {expensesByCategory.length === 0 ? (
                  <p className="text-center py-4 text-gray-500 text-sm">No hay gastos aún</p>
                ) : (
                  expensesByCategory.map(cat => {
                    const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                    return (
                      <div key={cat.value}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">{cat.label}</span>
                          <span className="text-sm font-bold text-white">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-700">
                          <div
                            className={`h-2 rounded-full ${cat.color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 text-right">{percentage.toFixed(1)}%</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-bold text-white">Resumen</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Gasto Promedio</span>
                  <span className="font-medium text-white">
                    {formatCurrency(transactions.filter(t => t.type === 'gasto').length > 0 
                      ? totalExpenses / transactions.filter(t => t.type === 'gasto').length 
                      : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Transacciones</span>
                  <span className="font-medium text-white">{transactions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Tasa de Ahorro</span>
                  <span className={`font-medium ${
                    totalIncome > 0 && ((totalIncome - totalExpenses) / totalIncome) > 0 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {totalIncome > 0 
                      ? `${(((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-white">Registrar Horas Trabajadas</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Horas Trabajadas
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="8.0"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {hours && hourlyRate > 0 && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
                  <p className="text-sm text-gray-400">Total a recibir:</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(parseFloat(hours) * hourlyRate)}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowIncomeModal(false)}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={addWorkEntry}
                  disabled={!hours || !hourlyRate}
                  className="flex-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-white">Agregar Gasto</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoría
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Ej: Almuerzo, Bus, etc."
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Método de Pago
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ${
                      paymentMethod === 'efectivo'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    Efectivo
                  </button>
                  <button
                    onClick={() => setPaymentMethod('online')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ${
                      paymentMethod === 'online'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Online
                  </button>
                  {expenseCategory === 'comida' && (
                    <button
                      onClick={() => setPaymentMethod('junaeb')}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ${
                        paymentMethod === 'junaeb'
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                      disabled={currentJunaebBalance <= 0}
                    >
                      <Utensils className="h-4 w-4" />
                      JUNAEB
                    </button>
                  )}
                </div>
                {paymentMethod === 'junaeb' && (
                  <p className="mt-2 text-xs text-orange-400">
                    Disponible: {formatCurrency(currentJunaebBalance)}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={addExpense}
                  disabled={!expenseAmount}
                  className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 px-4 py-3 font-semibold text-white shadow-lg shadow-red-500/30 transition hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Initial Balance Modal */}
      {showInitialBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-white">Balance Inicial</h3>
            <p className="mb-6 text-sm text-gray-400">
              Ingresa cuánto dinero tienes ahora mismo. Esto se sumará a tus ingresos y gastos futuros.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  Dinero en Efectivo
                </label>
                <input
                  type="number"
                  step="1"
                  value={initialCash || ''}
                  onChange={(e) => setInitialCash(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {initialCash > 0 && (
                  <p className="mt-1 text-xs text-emerald-400">
                    {formatCurrency(initialCash)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                  <CreditCard className="h-4 w-4 text-blue-400" />
                  Dinero Online (Banco/Tarjetas)
                </label>
                <input
                  type="number"
                  step="1"
                  value={initialOnline || ''}
                  onChange={(e) => setInitialOnline(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {initialOnline > 0 && (
                  <p className="mt-1 text-xs text-blue-400">
                    {formatCurrency(initialOnline)}
                  </p>
                )}
              </div>

              {(initialCash > 0 || initialOnline > 0) && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
                  <p className="text-sm text-gray-400">Total Inicial:</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(initialCash + initialOnline)}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowInitialBalanceModal(false)}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-white">Nueva Suscripción</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Ej: Netflix, Spotify, Gym"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={subAmount}
                  onChange={(e) => setSubAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frecuencia
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSubFrequency('mensual')}
                    className={`rounded-lg border px-4 py-3 font-medium transition ${
                      subFrequency === 'mensual'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => setSubFrequency('anual')}
                    className={`rounded-lg border px-4 py-3 font-medium transition ${
                      subFrequency === 'anual'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              {subFrequency === 'mensual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ¿Qué día del mes te cobran?
                  </label>
                  <select
                    value={subDayOfMonth}
                    onChange={(e) => setSubDayOfMonth(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        Día {day}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-400">
                    Próximo cobro: {formatNextPayment(
                      (() => {
                        const today = new Date();
                        const nextDate = new Date(today.getFullYear(), today.getMonth(), subDayOfMonth);
                        if (nextDate <= today) {
                          nextDate.setMonth(nextDate.getMonth() + 1);
                        }
                        return nextDate.toISOString();
                      })()
                    )}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={addSubscription}
                  disabled={!subName || !subAmount}
                  className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JUNAEB Modal */}
      {showJunaebModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-orange-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <Utensils className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">JUNAEB</h3>
                <p className="text-xs text-orange-400">Tarjeta Nacional Estudiantil</p>
              </div>
            </div>
            
            <div className="mb-6 rounded-lg border border-orange-700 bg-orange-900/20 p-4">
              <p className="text-sm text-gray-300 mb-2">
                💰 Monto mensual: <span className="font-bold text-orange-300">{formatCurrency(48000)}</span>
              </p>
              <p className="text-sm text-gray-300 mb-2">
                📅 Se recarga: <span className="font-bold text-orange-300">Día 1 de cada mes</span>
              </p>
              <p className="text-sm text-gray-300">
                🍔 Solo para: <span className="font-bold text-orange-300">Comida</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  ¿Cuánto te queda ahora en JUNAEB?
                </label>
                <input
                  type="number"
                  step="1"
                  value={junaebBalance || ''}
                  onChange={(e) => setJunaebBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-orange-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {junaebBalance > 0 && (
                  <p className="mt-2 text-sm text-orange-400">
                    Saldo actual: {formatCurrency(currentJunaebBalance)}
                  </p>
                )}
              </div>

              {junaebBalance > 48000 && (
                <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-3">
                  <p className="text-xs text-yellow-300">
                    ⚠️ El saldo parece mayor a lo normal. Verifica el monto.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-blue-700 bg-blue-900/20 p-3">
                <p className="text-xs text-blue-300">
                  💡 <strong>Tip:</strong> Cuando gastes en comida, selecciona "JUNAEB" como método de pago y se descontará automáticamente de este saldo.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowJunaebModal(false)}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar/History Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl my-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-500/20 p-2">
                  <History className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Historial Completo</h3>
                  <p className="text-sm text-gray-400">Todas tus transacciones por fecha</p>
                </div>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Statistics Summary */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <p className="text-xs text-gray-400 mb-1">Total Transacciones</p>
                <p className="text-2xl font-bold text-white">{transactions.length}</p>
              </div>
              <div className="rounded-lg border border-green-700 bg-green-900/20 p-4">
                <p className="text-xs text-gray-400 mb-1">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-400">
                  {transactions.filter(t => t.type === 'ingreso').length}
                </p>
              </div>
              <div className="rounded-lg border border-red-700 bg-red-900/20 p-4">
                <p className="text-xs text-gray-400 mb-1">Total Gastos</p>
                <p className="text-2xl font-bold text-red-400">
                  {transactions.filter(t => t.type === 'gasto').length}
                </p>
              </div>
            </div>

            {/* Transactions grouped by date */}
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-500">No hay transacciones aún</p>
                </div>
              ) : (
                // Group transactions by date
                Object.entries(
                  transactions.reduce((groups, transaction) => {
                    const date = new Date(transaction.date).toLocaleDateString('es-CL', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    if (!groups[date]) {
                      groups[date] = [];
                    }
                    groups[date].push(transaction);
                    return groups;
                  }, {} as Record<string, Transaction[]>)
                ).map(([date, dateTransactions]) => {
                  const dayTotal = dateTransactions.reduce((sum, t) => 
                    t.type === 'ingreso' ? sum + t.amount : sum - t.amount, 0
                  );
                  
                  return (
                    <div key={date} className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
                      <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
                        <h4 className="font-semibold text-white capitalize">{date}</h4>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Balance del día</p>
                          <p className={`font-bold ${dayTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {dateTransactions.map(transaction => {
                          const categoryInfo = getCategoryInfo(transaction.category);
                          return (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between rounded-lg bg-gray-900/50 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg ${categoryInfo.color} flex items-center justify-center text-white text-sm font-bold`}>
                                  {transaction.type === 'ingreso' ? '+' : '-'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {transaction.description || categoryInfo.label}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                      {transaction.paymentMethod === 'efectivo' ? (
                                        <Wallet className="h-3 w-3" />
                                      ) : transaction.paymentMethod === 'online' ? (
                                        <CreditCard className="h-3 w-3" />
                                      ) : (
                                        <Utensils className="h-3 w-3" />
                                      )}
                                      {transaction.paymentMethod === 'junaeb' ? 'JUNAEB' : transaction.paymentMethod}
                                    </span>
                                    <span>•</span>
                                    <span>{new Date(transaction.date).toLocaleTimeString('es-CL', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}</span>
                                  </div>
                                </div>
                              </div>
                              <p className={`text-lg font-bold ${
                                transaction.type === 'ingreso' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {transaction.type === 'ingreso' ? '+' : '-'}
                                {formatCurrency(transaction.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
