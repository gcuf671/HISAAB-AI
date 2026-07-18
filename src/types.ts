export interface Resident {
  id: string;
  name: string;
  // Key: monthId (e.g. "2026-07"), Value: days lived in that month
  daysLived: Record<string, number>;
  // Key: monthId, Value: whether they were present in the apartment during that month
  isActiveInMonth: Record<string, boolean>;
  createdAt: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payerId: string; // ID of the resident who paid
  monthId: string; // e.g. "2026-07"
  createdAt: number;
  category?: "Groceries" | "Utilities" | "Supplies" | "Pantry" | "Other";
  splitType?: "proportional" | "equal"; // proportional splits by days lived, equal splits evenly
  receiptImage?: string; // Base64 / data URL representing captured photo of grocery receipt
}

export interface ResidentSummary {
  id: string;
  name: string;
  daysLived: number;
  amountPaid: number;
  share: number;
  balance: number; // positive = owed, negative = owes
}

export interface Settlement {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface MonthlyCalculation {
  monthId: string;
  totalExpenses: number;
  totalDays: number;
  costPerDay: number;
  summaries: ResidentSummary[];
  settlements: Settlement[];
}

export interface HouseNote {
  id: string;
  message: string;
  authorId: string;
  authorName: string;
  priority: "Low" | "Medium" | "Urgent";
  color: "yellow" | "blue" | "green" | "pink";
  createdAt: number;
}
