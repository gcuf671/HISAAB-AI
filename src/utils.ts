import { Resident, Expense, MonthlyCalculation, ResidentSummary, Settlement } from "./types";

// Get number of days in a given month of a year
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Format month ID as YYYY-MM
export function formatMonthId(year: number, month: number): string {
  const monthStr = String(month + 1).padStart(2, "0");
  return `${year}-${monthStr}`;
}

// Parse YYYY-MM back to year and month
export function parseMonthId(monthId: string): { year: number; month: number } {
  const [yearStr, monthStr] = monthId.split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10) - 1,
  };
}

// Format currency as a clean string (e.g., $1,250.00)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Settlement algorithm: greedily matches debtors with creditors to minimize transactions
export function calculateSettlements(
  summaries: { id: string; name: string; balance: number }[]
): Settlement[] {
  const settlements: Settlement[] = [];

  // Clone participants and round balances to 2 decimal places
  const participants = summaries.map((s) => ({
    id: s.id,
    name: s.name,
    balance: Math.round(s.balance * 100) / 100,
  }));

  let safetyCounter = 0;
  const maxIterations = 200;

  while (safetyCounter < maxIterations) {
    let debtorIdx = -1;
    let creditorIdx = -1;
    let minBalance = -0.005; // tolerating fraction of a cent
    let maxBalance = 0.005;

    // Find the person who owes the most (minimum balance) and is owed the most (maximum balance)
    for (let i = 0; i < participants.length; i++) {
      const b = participants[i].balance;
      if (b < minBalance) {
        minBalance = b;
        debtorIdx = i;
      }
      if (b > maxBalance) {
        maxBalance = b;
        creditorIdx = i;
      }
    }

    // If we have no significant debtors or creditors, we are done
    if (debtorIdx === -1 || creditorIdx === -1) {
      break;
    }

    const debtor = participants[debtorIdx];
    const creditor = participants[creditorIdx];

    const amountToTransfer = Math.min(-debtor.balance, creditor.balance);
    const roundedAmount = Math.round(amountToTransfer * 100) / 100;

    if (roundedAmount > 0) {
      settlements.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: roundedAmount,
      });

      // Update their balances in the scratchpad
      debtor.balance += roundedAmount;
      creditor.balance -= roundedAmount;
    } else {
      break;
    }

    safetyCounter++;
  }

  return settlements;
}

// Compute the complete summary for a selected billing month
export function calculateMonthSummary(
  monthId: string,
  residents: Resident[],
  expenses: Expense[]
): MonthlyCalculation {
  const { year, month } = parseMonthId(monthId);
  const daysInMonth = getDaysInMonth(year, month);

  // Filter active residents for this month
  const activeResidents = residents.filter(
    (r) => r.isActiveInMonth[monthId] === true
  );

  // Filter expenses for this month
  const monthlyExpenses = expenses.filter((e) => e.monthId === monthId);

  // Compute total grocery expenses
  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Separate proportional and equal expenses
  const proportionalExpenses = monthlyExpenses.filter((e) => e.splitType !== "equal");
  const equalExpenses = monthlyExpenses.filter((e) => e.splitType === "equal");

  const totalProportional = proportionalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalEqual = equalExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Compute total days lived in the apartment by all active residents combined
  const totalDays = activeResidents.reduce((sum, r) => {
    const days = r.daysLived[monthId] ?? daysInMonth;
    return sum + days;
  }, 0);

  // Grocery / proportional cost rate per resident-day
  const costPerDay = totalDays > 0 ? totalProportional / totalDays : 0;

  // Equal share per active resident
  const equalSharePerPerson = activeResidents.length > 0 ? totalEqual / activeResidents.length : 0;

  // Compile individual summaries
  const summaries: ResidentSummary[] = activeResidents.map((r) => {
    const days = r.daysLived[monthId] ?? daysInMonth;
    const proportionalShare = days * costPerDay;
    const equalShare = equalSharePerPerson;
    const share = proportionalShare + equalShare;

    // Sum up how much this resident paid in this month's expenses list
    const amountPaid = monthlyExpenses
      .filter((e) => e.payerId === r.id)
      .reduce((sum, e) => sum + e.amount, 0);

    const balance = amountPaid - share;

    return {
      id: r.id,
      name: r.name,
      daysLived: days,
      amountPaid,
      share,
      balance,
    };
  });

  // Calculate settlement transactions
  const settlements = calculateSettlements(
    summaries.map((s) => ({
      id: s.id,
      name: s.name,
      balance: s.balance,
    }))
  );

  return {
    monthId,
    totalExpenses,
    totalDays,
    costPerDay,
    summaries,
    settlements,
  };
}

// Generates a mock/sample dataset to help users visualize the app instantly
export function getSampleData(currentMonthId: string): {
  residents: Resident[];
  expenses: Expense[];
} {
  const prevMonthId = (() => {
    const [y, m] = currentMonthId.split("-").map(Number);
    const date = new Date(y, m - 2, 1);
    const prevMStr = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${prevMStr}`;
  })();

  const r1Id = "res-1";
  const r2Id = "res-2";
  const r3Id = "res-3";

  const { year, month } = parseMonthId(currentMonthId);
  const daysInMonth = getDaysInMonth(year, month);

  const sampleResidents: Resident[] = [
    {
      id: r1Id,
      name: "Alex Johnson",
      daysLived: {
        [prevMonthId]: 30,
        [currentMonthId]: daysInMonth, // stays full month
      },
      isActiveInMonth: {
        [prevMonthId]: true,
        [currentMonthId]: true,
      },
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    },
    {
      id: r2Id,
      name: "Jordan Smith",
      daysLived: {
        [prevMonthId]: 30,
        [currentMonthId]: Math.max(1, daysInMonth - 10), // stays fewer days (e.g., went on holiday or moved late)
      },
      isActiveInMonth: {
        [prevMonthId]: true,
        [currentMonthId]: true,
      },
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    },
    {
      id: r3Id,
      name: "Taylor Wong",
      daysLived: {
        [prevMonthId]: 12,
        [currentMonthId]: 15, // moved out mid-month or visiting
      },
      isActiveInMonth: {
        [prevMonthId]: true,
        [currentMonthId]: true,
      },
      createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    },
  ];

  const sampleExpenses: Expense[] = [
    {
      id: "exp-1",
      description: "Weekly Grocery Haul (Whole Foods)",
      amount: 185.5,
      date: `${currentMonthId}-04`,
      payerId: r1Id,
      monthId: currentMonthId,
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      category: "Groceries",
      splitType: "proportional",
    },
    {
      id: "exp-2",
      description: "High-Speed Internet Bill",
      amount: 60.0,
      date: `${currentMonthId}-11`,
      payerId: r2Id,
      monthId: currentMonthId,
      createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      category: "Utilities",
      splitType: "equal",
    },
    {
      id: "exp-3",
      description: "Bulk Pantry Supplies & Cleaning Detergent",
      amount: 120.0,
      date: `${currentMonthId}-15`,
      payerId: r1Id,
      monthId: currentMonthId,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      category: "Supplies",
      splitType: "equal",
    },
    {
      id: "exp-4",
      description: "Organic Snacks & Fresh Coffee Beans",
      amount: 45.8,
      date: `${currentMonthId}-22`,
      payerId: r3Id,
      monthId: currentMonthId,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      category: "Pantry",
      splitType: "proportional",
    },
  ];

  return {
    residents: sampleResidents,
    expenses: sampleExpenses,
  };
}
