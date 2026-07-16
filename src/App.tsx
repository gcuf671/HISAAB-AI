import { useState, useEffect, useMemo, FormEvent, useRef, ChangeEvent } from "react";
import {
  Plus,
  Trash2,
  FileText,
  DollarSign,
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Coins,
  Info,
  Search,
  Percent,
  Copy,
  PieChart,
  Clock,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Camera,
  Eye,
  X,
  Image,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Resident, Expense } from "./types";
import {
  formatMonthId,
  parseMonthId,
  getDaysInMonth,
  formatCurrency,
  calculateMonthSummary,
  getSampleData,
} from "./utils";
import { generateMonthlyPDF } from "./pdfGenerator";

const LOCAL_STORAGE_KEY_RESIDENTS = "apartment_splitter_residents";
const LOCAL_STORAGE_KEY_EXPENSES = "apartment_splitter_expenses";

export default function App() {
  // --- 1. State Initialization ---
  const [currentMonthId, setCurrentMonthId] = useState<string>(() => {
    const now = new Date();
    return formatMonthId(now.getFullYear(), now.getMonth());
  });

  const [residents, setResidents] = useState<Resident[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  // Form states
  const [newResidentName, setNewResidentName] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePayerId, setExpensePayerId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<"Groceries" | "Utilities" | "Supplies" | "Pantry" | "Other">("Groceries");
  const [expenseSplitType, setExpenseSplitType] = useState<"proportional" | "equal">("proportional");
  const [expenseReceiptImage, setExpenseReceiptImage] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Ledger Search and Filter state
  const [expenseSearch, setExpenseSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterSplitType, setFilterSplitType] = useState<string>("All");

  // Quick Split Calculator state
  const [isQuickCalcOpen, setIsQuickCalcOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDescription, setQuickDescription] = useState("Pizza Split");
  const [quickPayerId, setQuickPayerId] = useState("");
  const [quickSelectedResidents, setQuickSelectedResidents] = useState<Record<string, boolean>>({});
  const [copiedQuickCalcId, setCopiedQuickCalcId] = useState(false);

  // Settlement copied state helper
  const [copiedSettlementIndex, setCopiedSettlementIndex] = useState<number | null>(null);

  // Hidden file input reference for JSON backup import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load state from LocalStorage or populate with Sample Data
  useEffect(() => {
    const savedResidents = localStorage.getItem(LOCAL_STORAGE_KEY_RESIDENTS);
    const savedExpenses = localStorage.getItem(LOCAL_STORAGE_KEY_EXPENSES);

    if (savedResidents && savedExpenses) {
      try {
        setResidents(JSON.parse(savedResidents));
        setExpenses(JSON.parse(savedExpenses));
      } catch (err) {
        console.error("Error parsing local storage", err);
        loadSampleData();
      }
    } else {
      loadSampleData();
    }
    setIsInitialLoaded(true);
  }, []);

  // Sync state back to LocalStorage on changes
  useEffect(() => {
    if (isInitialLoaded) {
      localStorage.setItem(LOCAL_STORAGE_KEY_RESIDENTS, JSON.stringify(residents));
    }
  }, [residents, isInitialLoaded]);

  useEffect(() => {
    if (isInitialLoaded) {
      localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
    }
  }, [expenses, isInitialLoaded]);

  // Set default expense date based on the current selected month
  useEffect(() => {
    const today = new Date();
    const todayMonthId = formatMonthId(today.getFullYear(), today.getMonth());
    if (currentMonthId === todayMonthId) {
      const dayStr = String(today.getDate()).padStart(2, "0");
      setExpenseDate(`${currentMonthId}-${dayStr}`);
    } else {
      setExpenseDate(`${currentMonthId}-01`);
    }
  }, [currentMonthId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError("");
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      let errorMsg = "Could not access camera. Please make sure camera permissions are granted.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No camera device found on this system.";
      }
      setCameraError(errorMsg);
      showErrNotification(errorMsg);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setExpenseReceiptImage(dataUrl);
          stopCamera();
          showNotification("Receipt photo captured successfully!");
        } catch (e) {
          console.error("Canvas toDataURL error:", e);
          showErrNotification("Failed to process captured photo.");
        }
      }
    }
  };

  const handleReceiptFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showErrNotification("Please select an image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setExpenseReceiptImage(event.target.result as string);
          showNotification("Receipt image loaded successfully!");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 2. Action Handlers ---
  const loadSampleData = () => {
    const sample = getSampleData(currentMonthId);
    setResidents(sample.residents);
    setExpenses(sample.expenses);
    showNotification("Loaded demo apartment with sample flatmates!");
  };

  const clearAllData = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all flatmates and expense logs? This cannot be undone."
      )
    ) {
      setResidents([]);
      setExpenses([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY_RESIDENTS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_EXPENSES);
      showNotification("All data cleared successfully.");
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const showErrNotification = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4000);
  };

  // Month navigation
  const handlePrevMonth = () => {
    const { year, month } = parseMonthId(currentMonthId);
    const prevDate = new Date(year, month - 1, 1);
    setCurrentMonthId(formatMonthId(prevDate.getFullYear(), prevDate.getMonth()));
  };

  const handleNextMonth = () => {
    const { year, month } = parseMonthId(currentMonthId);
    const nextDate = new Date(year, month + 1, 1);
    setCurrentMonthId(formatMonthId(nextDate.getFullYear(), nextDate.getMonth()));
  };

  // Resident management
  const handleAddResident = (e: FormEvent) => {
    e.preventDefault();
    const name = newResidentName.trim();
    if (!name) {
      showErrNotification("Please enter a valid flatmate name.");
      return;
    }

    const { year, month } = parseMonthId(currentMonthId);
    const daysInMonth = getDaysInMonth(year, month);

    const newRes: Resident = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name,
      daysLived: {
        [currentMonthId]: daysInMonth,
      },
      isActiveInMonth: {
        [currentMonthId]: true,
      },
      createdAt: Date.now(),
    };

    setResidents((prev) => [...prev, newRes]);
    setNewResidentName("");
    showNotification(`Added ${name} to the apartment roster!`);
  };

  const handleDeleteResident = (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove ${name}? This will also delete any grocery expenses paid by them.`
      )
    ) {
      setResidents((prev) => prev.filter((r) => r.id !== id));
      setExpenses((prev) => prev.filter((e) => e.payerId !== id));
      if (expensePayerId === id) {
        setExpensePayerId("");
      }
      showNotification(`Removed ${name} from the apartment roster.`);
    }
  };

  const toggleResidentActiveInMonth = (id: string) => {
    setResidents((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const currentActive = r.isActiveInMonth[currentMonthId] ?? true;
        const updatedActive = !currentActive;

        const { year, month } = parseMonthId(currentMonthId);
        const daysInMonth = getDaysInMonth(year, month);

        return {
          ...r,
          isActiveInMonth: {
            ...r.isActiveInMonth,
            [currentMonthId]: updatedActive,
          },
          daysLived: {
            ...r.daysLived,
            [currentMonthId]: updatedActive
              ? r.daysLived[currentMonthId] ?? daysInMonth
              : 0,
          },
        };
      })
    );
  };

  const handleUpdateDaysLived = (id: string, days: number) => {
    setResidents((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          daysLived: {
            ...r.daysLived,
            [currentMonthId]: days,
          },
        };
      })
    );
  };

  // Expense management
  const handleAddExpense = (e: FormEvent) => {
    e.preventDefault();
    const desc = expenseDescription.trim();
    const amt = parseFloat(expenseAmount);
    const payer = expensePayerId;

    if (!desc) {
      showErrNotification("Please enter a description for the expense.");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showErrNotification("Please enter a valid amount greater than $0.");
      return;
    }
    if (!payer) {
      showErrNotification("Please select who paid for these groceries.");
      return;
    }

    const newExp: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      description: desc,
      amount: Math.round(amt * 100) / 100,
      date: expenseDate || `${currentMonthId}-01`,
      payerId: payer,
      monthId: currentMonthId,
      createdAt: Date.now(),
      category: expenseCategory,
      splitType: expenseSplitType,
      receiptImage: expenseReceiptImage || undefined,
    };

    setExpenses((prev) => [...prev, newExp]);
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseCategory("Groceries");
    setExpenseSplitType("proportional");
    setExpenseReceiptImage("");
    showNotification(`Logged expense: "${desc}" (${formatCurrency(amt)})`);
  };

  const handleDeleteExpense = (id: string, desc: string) => {
    if (window.confirm(`Delete expense "${desc}"?`)) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      showNotification(`Deleted expense "${desc}".`);
    }
  };

  // --- 3. Computed Calculations ---
  const { year, month } = useMemo(() => parseMonthId(currentMonthId), [currentMonthId]);
  const monthName = useMemo(
    () => new Date(year, month, 1).toLocaleString("en-US", { month: "long" }),
    [year, month]
  );
  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);

  // Normalize active & days status for residents in the selected month
  const normalizedResidents = useMemo(() => {
    return residents.map((r) => {
      const isActive = r.isActiveInMonth[currentMonthId] ?? true;
      const days = r.daysLived[currentMonthId] ?? daysInMonth;
      return {
        ...r,
        currentActive: isActive,
        currentDaysLived: isActive ? days : 0,
      };
    });
  }, [residents, currentMonthId, daysInMonth]);

  // Compute final monthly bill splits
  const calculation = useMemo(() => {
    // Inject normalized defaults for active and days lived to the utility calculator
    const tempResidents = residents.map((r) => {
      const isActive = r.isActiveInMonth[currentMonthId] ?? true;
      const days = r.daysLived[currentMonthId] ?? daysInMonth;
      return {
        ...r,
        isActiveInMonth: {
          ...r.isActiveInMonth,
          [currentMonthId]: isActive,
        },
        daysLived: {
          ...r.daysLived,
          [currentMonthId]: days,
        },
      };
    });

    return calculateMonthSummary(currentMonthId, tempResidents, expenses);
  }, [residents, expenses, currentMonthId, daysInMonth]);

  // Auto-set first active resident as the payer in the select box if not set
  const activeResidents = useMemo(() => {
    return normalizedResidents.filter((r) => r.currentActive);
  }, [normalizedResidents]);

  useEffect(() => {
    if (activeResidents.length > 0 && (!expensePayerId || !activeResidents.some(r => r.id === expensePayerId))) {
      setExpensePayerId(activeResidents[0].id);
    }
  }, [activeResidents, expensePayerId]);

  // Default Quick Split selections when flatmates change
  useEffect(() => {
    if (residents.length > 0) {
      const defaults: Record<string, boolean> = {};
      residents.forEach(r => {
        defaults[r.id] = r.isActiveInMonth[currentMonthId] ?? true;
      });
      setQuickSelectedResidents(defaults);
      if (!quickPayerId && residents.length > 0) {
        setQuickPayerId(residents[0].id);
      }
    }
  }, [residents, currentMonthId]);

  // Filtered Expense list for search & filters
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.monthId === currentMonthId)
      .filter((e) => {
        const matchesSearch = e.description.toLowerCase().includes(expenseSearch.toLowerCase());
        const matchesCategory = filterCategory === "All" || (e.category || "Groceries") === filterCategory;
        const matchesSplitType =
          filterSplitType === "All" ||
          (filterSplitType === "proportional" && e.splitType !== "equal") ||
          (filterSplitType === "equal" && e.splitType === "equal");
        return matchesSearch && matchesCategory && matchesSplitType;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, currentMonthId, expenseSearch, filterCategory, filterSplitType]);

  // Category statistics
  const categoryStats = useMemo(() => {
    const monthlyExp = expenses.filter((e) => e.monthId === currentMonthId);
    const totals = {
      Groceries: 0,
      Utilities: 0,
      Supplies: 0,
      Pantry: 0,
      Other: 0,
    };
    monthlyExp.forEach((e) => {
      const cat = e.category || "Groceries";
      if (totals[cat] !== undefined) {
        totals[cat] += e.amount;
      } else {
        totals.Other += e.amount;
      }
    });
    return totals;
  }, [expenses, currentMonthId]);

  // Proportional vs Equal totals
  const proportionalTotal = useMemo(() => {
    return expenses
      .filter((e) => e.monthId === currentMonthId && e.splitType !== "equal")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, currentMonthId]);

  const equalTotal = useMemo(() => {
    return expenses
      .filter((e) => e.monthId === currentMonthId && e.splitType === "equal")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, currentMonthId]);

  // Top Spender this month
  const topSpender = useMemo(() => {
    if (calculation.summaries.length === 0) return null;
    const sorted = [...calculation.summaries].sort((a, b) => b.amountPaid - a.amountPaid);
    return sorted[0].amountPaid > 0 ? sorted[0] : null;
  }, [calculation.summaries]);

  // Most Active Resident (most days lived)
  const topOccupant = useMemo(() => {
    if (calculation.summaries.length === 0) return null;
    const sorted = [...calculation.summaries].sort((a, b) => b.daysLived - a.daysLived);
    return sorted[0].daysLived > 0 ? sorted[0] : null;
  }, [calculation.summaries]);

  // Category percentage calculation for visual stacked progress bar
  const categoryPercentages = useMemo(() => {
    const total = calculation.totalExpenses;
    if (total === 0) return [];
    return (Object.entries(categoryStats) as [string, number][])
      .map(([cat, val]) => ({
        category: cat as "Groceries" | "Utilities" | "Supplies" | "Pantry" | "Other",
        value: val,
        percentage: (val / total) * 100,
      }))
      .filter((c) => c.value > 0);
  }, [categoryStats, calculation.totalExpenses]);

  // Ad-hoc Quick Split calculation
  const quickSplitResults = useMemo(() => {
    const amt = parseFloat(quickAmount);
    if (isNaN(amt) || amt <= 0) return null;

    const selectedIds = Object.keys(quickSelectedResidents).filter((id) => quickSelectedResidents[id]);
    if (selectedIds.length === 0) return null;

    const perPerson = amt / selectedIds.length;

    return selectedIds.map((id) => {
      const resName = residents.find((r) => r.id === id)?.name || "Unknown";
      const isPayer = id === quickPayerId;
      return {
        id,
        name: resName,
        share: perPerson,
        isPayer,
        balance: isPayer ? amt - perPerson : -perPerson,
      };
    });
  }, [quickAmount, quickSelectedResidents, quickPayerId, residents]);

  // CSV Report Export
  const handleExportCSV = () => {
    try {
      if (calculation.summaries.length === 0) {
        showErrNotification("No active flatmates this month to export.");
        return;
      }

      let csv = "data:text/csv;charset=utf-8,";
      csv += `Apartment Expense Ledger Report for ${monthName} ${year}\r\n\r\n`;
      csv += "FLATMATE COST DISTRIBUTION & BALANCES\r\n";
      csv += "Name,Days Lived,Amount Paid,Fair Share,Balance\r\n";

      calculation.summaries.forEach((s) => {
        csv += `"${s.name}",${s.daysLived},${s.amountPaid.toFixed(2)},${s.share.toFixed(2)},${s.balance.toFixed(2)}\r\n`;
      });

      csv += "\r\nSETTLEMENT TRANSACTIONS\r\n";
      csv += "From,To,Amount\r\n";
      if (calculation.settlements.length === 0) {
        csv += "All settled up! No transactions needed.\r\n";
      } else {
        calculation.settlements.forEach((t) => {
          csv += `"${t.fromName}","${t.toName}",${t.amount.toFixed(2)}\r\n`;
        });
      }

      csv += "\r\nITEMIZED HOUSE EXPENSE LOG\r\n";
      csv += "Date,Description,Category,Split Type,Paid By,Amount\r\n";
      const monthlyExp = expenses.filter((e) => e.monthId === currentMonthId);
      monthlyExp.forEach((e) => {
        const payer = residents.find((r) => r.id === e.payerId);
        csv += `"${e.date}","${e.description.replace(/"/g, '""')}","${e.category || "Groceries"}","${e.splitType || "proportional"}","${payer ? payer.name : "Unknown"}",${e.amount.toFixed(2)}\r\n`;
      });

      const encodedUri = encodeURI(csv);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `apartment-split-report-${currentMonthId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("CSV report downloaded successfully!");
    } catch (err) {
      console.error(err);
      showErrNotification("Failed to export CSV.");
    }
  };

  // JSON Backup Export
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
        JSON.stringify({
          residents,
          expenses,
          version: "1.1",
          exportedAt: new Date().toISOString()
        }, null, 2)
      );
      const link = document.createElement("a");
      link.setAttribute("href", dataStr);
      link.setAttribute("download", `apartment-splitter-backup-${currentMonthId}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("JSON data backup downloaded successfully!");
    } catch (err) {
      showErrNotification("Failed to export JSON backup.");
    }
  };

  // JSON Backup Import
  const handleImportJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed.residents) && Array.isArray(parsed.expenses)) {
            setResidents(parsed.residents);
            setExpenses(parsed.expenses);
            showNotification("Backup restored successfully from JSON!");
          } else {
            showErrNotification("Invalid backup file structure.");
          }
        } catch (err) {
          showErrNotification("Failed to parse JSON backup file.");
        }
      };
    }
  };

  // Copy Settlement Text
  const handleCopySettlementText = (fromName: string, toName: string, amount: number, index: number) => {
    const text = `Hey ${fromName}, could you please split-settle ${formatCurrency(amount)} to ${toName} for our apartment grocery ledger? Thanks!`;
    navigator.clipboard.writeText(text);
    setCopiedSettlementIndex(index);
    setTimeout(() => setCopiedSettlementIndex(null), 3000);
    showNotification("Settlement text copied to clipboard!");
  };

  // Copy Quick Split Text
  const handleCopyQuickSplit = () => {
    if (!quickSplitResults) return;
    const payerName = residents.find(r => r.id === quickPayerId)?.name || "Unknown";
    let text = `⚡ ${quickDescription} Split Summary ($${parseFloat(quickAmount).toFixed(2)})\n`;
    text += `Total: ${formatCurrency(parseFloat(quickAmount))} (Paid by ${payerName})\n\n`;
    text += `Split Details:\n`;
    quickSplitResults.forEach(r => {
      if (r.balance > 0) {
        text += `- ${r.name}: paid ${formatCurrency(parseFloat(quickAmount))} (is owed ${formatCurrency(r.balance)})\n`;
      } else {
        text += `- ${r.name}: owes ${formatCurrency(Math.abs(r.balance))}\n`;
      }
    });
    navigator.clipboard.writeText(text);
    setCopiedQuickCalcId(true);
    setTimeout(() => setCopiedQuickCalcId(false), 3000);
    showNotification("Group split summary copied to clipboard!");
  };

  // Export PDF Action
  const handleExportPDF = () => {
    try {
      generateMonthlyPDF(currentMonthId, calculation, expenses, residents);
      showNotification("PDF report generated and downloaded successfully!");
    } catch (err) {
      console.error(err);
      showErrNotification("Failed to generate PDF. Try adding some residents first.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col selection:bg-indigo-200">
      {/* Top Banner / Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 bg-slate-900 text-white font-mono text-[11px] uppercase tracking-wider px-6 py-3.5 rounded-full shadow-lg flex items-center gap-3 border border-slate-800"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 bg-rose-600 text-white font-mono text-[11px] uppercase tracking-wider px-6 py-3.5 rounded-full shadow-lg flex items-center gap-3 border border-rose-500"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Navbar */}
      <header className="border-b border-slate-200/60 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <Coins className="w-5 h-5" id="logo-icon" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-slate-900 flex items-center gap-2">
                RoomSplit <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">v1.2</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                Proportional Flatmate-Day Attendance & Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Database backup portal controls */}
            <div className="hidden md:flex items-center gap-2 border-r border-slate-200 pr-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Restore backup from a JSON file"
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Import JSON</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportJSON}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={handleExportJSON}
                title="Download JSON data backup"
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Backup</span>
              </button>
            </div>

            <button
              onClick={loadSampleData}
              title="Reset state to prefilled sample apartment"
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 hover:text-indigo-800 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Load Demo Data</span>
            </button>
            <button
              onClick={clearAllData}
              title="Clear all local flatmate and expense logs"
              className="p-2 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200/80 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero section with Month navigation */}
      <section className="px-4 sm:px-6 lg:px-8 py-6 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-1 font-mono">
              ACTIVE LEDGER PERIOD
            </span>
            <div className="flex items-center gap-4">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-serif">
                {monthName}
              </h2>
              
              {/* Month Mini-Selector Navigation */}
              <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/40">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 text-slate-600 hover:bg-white hover:text-slate-950 rounded-lg transition duration-150 cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="relative px-3 font-mono text-xs font-bold text-slate-700 flex items-center hover:text-indigo-600 cursor-pointer">
                  <span>{year}</span>
                  <input
                    type="month"
                    value={currentMonthId}
                    onChange={(e) => {
                      if (e.target.value) setCurrentMonthId(e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 text-slate-600 hover:bg-white hover:text-slate-950 rounded-lg transition duration-150 cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 bg-indigo-50/50 border border-indigo-100/60 p-4 rounded-2xl shrink-0">
            <div>
              <div className="text-3xl font-black font-mono tracking-tight text-slate-900">
                {formatCurrency(calculation.totalExpenses)}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mt-0.5 font-mono">
                Total Expenses logged in {monthName}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <button
              onClick={() => setIsQuickCalcOpen(!isQuickCalcOpen)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Quick Split</span>
            </button>
          </div>
        </div>
      </section>

      {/* AD-HOC QUICK SPLIT SLIDE DOWN DRAWER */}
      <AnimatePresence>
        {isQuickCalcOpen && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-indigo-900 text-white border-b border-indigo-950"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 justify-between">
              <div className="flex-1 max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-5 h-5 text-indigo-300" />
                  <h3 className="font-bold text-lg font-mono uppercase tracking-wider text-indigo-200">
                    Quick Ad-Hoc Split Tool
                  </h3>
                </div>
                <p className="text-xs text-indigo-200/80 mb-6 leading-relaxed">
                  Ordered dinner or took an Uber together tonight? Use this calculator to split costs instantly. This does <strong>not</strong> save to the monthly roster ledger, making it perfect for one-off split announcements!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase text-indigo-300 tracking-wider">
                      Item Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pizza Night"
                      value={quickDescription}
                      onChange={(e) => setQuickDescription(e.target.value)}
                      className="px-3 py-2 bg-indigo-800 border border-indigo-700 rounded-xl text-white text-xs placeholder-indigo-400 focus:outline-hidden focus:border-indigo-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase text-indigo-300 tracking-wider">
                      Total Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300 font-mono text-xs">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-indigo-800 border border-indigo-700 rounded-xl text-white font-mono text-xs placeholder-indigo-400 focus:outline-hidden focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase text-indigo-300 tracking-wider">
                      Who Paid?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {residents.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setQuickPayerId(r.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            quickPayerId === r.id
                              ? "bg-white text-indigo-900 font-bold"
                              : "bg-indigo-800/60 hover:bg-indigo-800 text-indigo-200"
                          }`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <label className="text-[10px] font-mono uppercase text-indigo-300 tracking-wider">
                    Select Who to Split With:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {residents.map((r) => {
                      const isChecked = !!quickSelectedResidents[r.id];
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setQuickSelectedResidents(prev => ({ ...prev, [r.id]: !isChecked }))}
                          className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                            isChecked
                              ? "bg-indigo-500/30 border-indigo-400 text-white"
                              : "bg-indigo-950/40 border-indigo-800/80 text-indigo-300"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isChecked ? "bg-indigo-400 border-indigo-400 text-white" : "border-indigo-700 text-transparent"}`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className="truncate">{r.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="w-full lg:max-w-md bg-indigo-950 p-6 rounded-2xl border border-indigo-800/60 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs uppercase font-mono tracking-widest text-indigo-400 mb-3 border-b border-indigo-800 pb-2">
                    Split Breakdown
                  </h4>
                  {quickSplitResults ? (
                    <div className="flex flex-col gap-3 font-mono">
                      {quickSplitResults.map((r) => (
                        <div key={r.id} className="flex justify-between items-center text-xs">
                          <span className="font-sans text-indigo-200">{r.name}</span>
                          {r.balance > 0 ? (
                            <span className="text-emerald-400 font-bold">is owed {formatCurrency(r.balance)}</span>
                          ) : (
                            <span className="text-rose-400">owes {formatCurrency(Math.abs(r.balance))}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-indigo-400 text-xs italic">
                      Enter an amount and select flatmates to calculate split.
                    </div>
                  )}
                </div>

                {quickSplitResults && (
                  <button
                    onClick={handleCopyQuickSplit}
                    className="mt-6 w-full py-2.5 bg-white text-indigo-900 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedQuickCalcId ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Copied split message!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-indigo-900" />
                        <span>Copy Shareable Summary</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Main content grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* LEFT COLUMN: Controls & Ledger Logs (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* BENTO STATS & LEGEND CATEGORY BREAKDOWN */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-700">
                  {monthName} Category Spending Distribution
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {formatCurrency(calculation.totalExpenses)} total
              </span>
            </div>

            {calculation.totalExpenses === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No items logged to display the category allocation chart.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Visual Custom Stacked bar */}
                <div className="w-full h-3.5 rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
                  {categoryPercentages.map((c) => {
                    const colorMap = {
                      Groceries: "bg-emerald-500",
                      Utilities: "bg-sky-500",
                      Supplies: "bg-amber-500",
                      Pantry: "bg-indigo-500",
                      Other: "bg-slate-400"
                    };
                    const color = colorMap[c.category] || "bg-slate-400";
                    return (
                      <div
                        key={c.category}
                        style={{ width: `${c.percentage}%` }}
                        className={`${color} h-full transition-all duration-500 hover:brightness-110`}
                        title={`${c.category}: ${formatCurrency(c.value)} (${c.percentage.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Legends */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                  {(Object.keys(categoryStats) as Array<keyof typeof categoryStats>).map((cat) => {
                    const value = categoryStats[cat];
                    const percent = calculation.totalExpenses > 0 ? (value / calculation.totalExpenses) * 100 : 0;
                    const colorMap = {
                      Groceries: "bg-emerald-500",
                      Utilities: "bg-sky-500",
                      Supplies: "bg-amber-500",
                      Pantry: "bg-indigo-500",
                      Other: "bg-slate-400"
                    };
                    const dotColor = colorMap[cat] || "bg-slate-400";
                    return (
                      <div key={cat} className="flex flex-col p-2 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{cat}</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-slate-800">{formatCurrency(value)}</span>
                        <span className="text-[9px] font-mono text-slate-400">{percent.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Bento Metrics Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  {topSpender && (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/50">
                      <div className="p-2 bg-emerald-500 text-white rounded-lg">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-emerald-700/80 uppercase tracking-wider font-mono">Top Contributor</div>
                        <div className="text-xs font-bold text-slate-800">{topSpender.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Paid {formatCurrency(topSpender.amountPaid)}</div>
                      </div>
                    </div>
                  )}

                  {topOccupant && (
                    <div className="flex items-center gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
                      <div className="p-2 bg-indigo-500 text-white rounded-lg">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-indigo-700/80 uppercase tracking-wider font-mono">Max Occupancy</div>
                        <div className="text-xs font-bold text-slate-800">{topOccupant.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-mono">Resident for {topOccupant.daysLived} days</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 1: Flatmate Attendance (Roster, sliders, checks) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-slate-800" />
                <h3 className="font-serif font-bold text-xl text-slate-900">
                  1. Roster & Attendance
                </h3>
              </div>
              <span className="font-mono text-[10px] uppercase bg-slate-900 text-white px-2.5 py-1 rounded-full tracking-wider font-semibold">
                Roster: {normalizedResidents.length} Flatmates
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Check flatmates present in {monthName}. Set how many days they lived here; shared costs are split proportionally to days lived.
            </p>

            {/* Flatmates List */}
            <div className="flex flex-col gap-3">
              {normalizedResidents.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-6">
                  <p className="text-xs font-bold text-slate-400">No flatmates registered yet.</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mt-1">
                    Add residents below to populate the ledger.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {normalizedResidents.map((res) => {
                    const days = res.currentDaysLived;
                    const isChecked = res.currentActive;

                    return (
                      <motion.div
                        key={res.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-xl border transition-all ${
                          isChecked
                            ? "bg-amber-50/15 border-amber-200/60 shadow-xs"
                            : "bg-slate-50/50 border-slate-200/40 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleResidentActiveInMonth(res.id)}
                              className="rounded-lg border-slate-300 text-indigo-600 focus:ring-0 w-5 h-5 cursor-pointer accent-indigo-600"
                            />
                            <span
                              className={`text-sm font-semibold transition ${
                                isChecked ? "text-slate-800" : "text-slate-400 line-through"
                              }`}
                            >
                              {res.name}
                            </span>
                          </label>

                          <div className="flex items-center gap-2">
                            {isChecked && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDaysLived(res.id, daysInMonth)}
                                  className="text-[9px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md cursor-pointer uppercase font-bold"
                                  title="Set to full term"
                                >
                                  Full Term
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDaysLived(res.id, 1)}
                                  className="text-[9px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md cursor-pointer uppercase font-bold"
                                  title="Set to 1 day"
                                >
                                  1 Day
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => handleDeleteResident(res.id, res.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent transition cursor-pointer"
                              title="Delete flatmate registry completely from app"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Slider Control */}
                        {isChecked && (
                          <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row items-center gap-4 shadow-2xs">
                            <div className="flex-1 w-full flex flex-col gap-1.5">
                              <input
                                type="range"
                                min="1"
                                max={daysInMonth}
                                value={days}
                                onChange={(e) =>
                                  handleUpdateDaysLived(res.id, parseInt(e.target.value, 10))
                                }
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                                <span>1 Day</span>
                                <span>{daysInMonth} Days (Full Term)</span>
                              </div>
                            </div>

                            <div className="text-right flex items-baseline gap-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg font-mono text-xs font-bold uppercase shrink-0 shadow-3xs">
                              <span>{days}</span>
                              <span className="text-[9px] opacity-70">Days</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddResident} className="flex gap-2 border-t border-slate-100 pt-4">
              <input
                type="text"
                placeholder="Enter new flatmate name (e.g. Jordan)"
                value={newResidentName}
                onChange={(e) => setNewResidentName(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-sans"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Flatmate</span>
              </button>
            </form>
          </div>

          {/* STEP 2: Grocery Ledger (Logging and filter list) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-slate-800" />
                <h3 className="font-serif font-bold text-xl text-slate-900">
                  2. Grocery Expenses Ledger
                </h3>
              </div>
              <span className="font-mono text-[10px] uppercase bg-slate-900 text-white px-2.5 py-1 rounded-full tracking-wider font-semibold">
                Ledger: {expenses.filter((e) => e.monthId === currentMonthId).length} Items
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Log expenditures made by anyone for the apartment. You can choose whether they are split proportionally to days-lived, or split equally!
            </p>

            {/* Add Expense Form */}
            <form
              onSubmit={handleAddExpense}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-xl shadow-inner"
            >
              <div className="md:col-span-6 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Description / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Costco bulk groceries"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs text-slate-800"
                />
              </div>

              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Paid By
                </label>
                {activeResidents.length === 0 ? (
                  <select
                    disabled
                    className="w-full px-2 py-2 border border-slate-200 bg-slate-100 rounded-lg text-xs text-slate-400 cursor-not-allowed"
                  >
                    <option>No active roster</option>
                  </select>
                ) : (
                  <select
                    value={expensePayerId}
                    onChange={(e) => setExpensePayerId(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-sans text-slate-700 cursor-pointer"
                  >
                    {activeResidents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Advanced fields: Category and Split Type */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Expense Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs text-slate-700 cursor-pointer"
                >
                  <option value="Groceries">🍎 Groceries</option>
                  <option value="Utilities">⚡ Utilities</option>
                  <option value="Supplies">🧼 Supplies</option>
                  <option value="Pantry">☕ Pantry</option>
                  <option value="Other">📦 Other</option>
                </select>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Split Protocol
                </label>
                <select
                  value={expenseSplitType}
                  onChange={(e) => setExpenseSplitType(e.target.value as any)}
                  className="w-full px-2 py-2 border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs text-slate-700 cursor-pointer"
                >
                  <option value="proportional">📈 Days-Lived Split</option>
                  <option value="equal">⚖️ Equal Even Split</option>
                </select>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-mono text-slate-700 cursor-pointer"
                />
              </div>

              {/* Receipt Image Capture Section */}
              <div className="md:col-span-12 flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Receipt Attachment (Optional)</span>
                </label>
                
                {/* No image & no camera active */}
                {!isCameraActive && !expenseReceiptImage && (
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-white text-center flex flex-col items-center justify-center gap-3 shadow-3xs hover:bg-slate-100/30 transition-all">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                      <Image className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Attach a photo of the grocery receipt</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">Use camera scanner or upload an image file</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-1">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Scan Receipt (Camera)</span>
                      </button>
                      <label className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg shadow-3xs cursor-pointer transition flex items-center gap-1.5">
                        <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                        <span>Upload Image File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Camera live feed */}
                {isCameraActive && (
                  <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-900 relative shadow-inner">
                    {/* Viewport simulation */}
                    <div className="relative aspect-video max-h-[300px] w-full flex items-center justify-center overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Scanning visual effect lines */}
                      <div className="absolute inset-0 border-2 border-indigo-500/40 pointer-events-none rounded-xl m-4 flex flex-col justify-between">
                        <div className="flex justify-between p-2">
                          <div className="w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                          <div className="w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                        </div>
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-md animate-bounce opacity-80" />
                        <div className="flex justify-between p-2">
                          <div className="w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                          <div className="w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                        </div>
                      </div>
                    </div>
                    {/* Camera error state */}
                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-4 text-white z-10 gap-2">
                        <AlertCircle className="w-8 h-8 text-rose-500" />
                        <p className="text-xs font-bold">{cameraError}</p>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {/* Camera controls */}
                    <div className="p-3 bg-slate-950 flex justify-between items-center gap-2">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-medium cursor-pointer transition"
                      >
                        Cancel Camera
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer font-mono uppercase tracking-wider"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Capture Receipt</span>
                      </button>
                      <div className="w-20 hidden sm:block" /> {/* spacer for visual balancing */}
                    </div>
                  </div>
                )}

                {/* Captured receipt thumbnail with options */}
                {expenseReceiptImage && (
                  <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-4 shadow-3xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 group">
                        <img
                          src={expenseReceiptImage}
                          alt="Receipt Thumbnail"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">Receipt Photo Attached</p>
                        <button
                          type="button"
                          onClick={() => setPreviewModalImage(expenseReceiptImage)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Full Size</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Retake receipt capture"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseReceiptImage("")}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent cursor-pointer"
                        title="Delete receipt attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-12 flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Expense Entry</span>
                </button>
              </div>
            </form>

            {/* EXPENSES LOG TABLE WITH SEARCH AND FILTERS */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-200/55">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:border-slate-300 text-slate-800"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer focus:outline-hidden"
                  >
                    <option value="All">All Categories</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={filterSplitType}
                    onChange={(e) => setFilterSplitType(e.target.value)}
                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer focus:outline-hidden"
                  >
                    <option value="All">All Splits</option>
                    <option value="proportional">Days-Lived</option>
                    <option value="equal">Equal Even</option>
                  </select>
                </div>
              </div>

              {/* Expenses Log List Display */}
              <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 bg-slate-50/50 rounded-xl">
                    <p className="text-xs text-slate-400 italic">No expenses match your filters.</p>
                  </div>
                ) : (
                  filteredExpenses.map((exp) => {
                    const payer = residents.find((r) => r.id === exp.payerId);
                    
                    // Category colors mapping
                    const colorMap = {
                      Groceries: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      Utilities: "bg-sky-50 text-sky-700 border-sky-200",
                      Supplies: "bg-amber-50 text-amber-700 border-amber-200",
                      Pantry: "bg-indigo-50 text-indigo-700 border-indigo-200",
                      Other: "bg-slate-50 text-slate-600 border-slate-200"
                    };
                    const badgeClass = colorMap[exp.category || "Groceries"] || colorMap.Other;

                    const splitLabel = exp.splitType === "equal" ? "⚖️ Even" : "📈 Days";

                    return (
                      <div
                        key={exp.id}
                        className="p-3 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl hover:bg-slate-50/30 transition-all flex items-center justify-between gap-3 shadow-3xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-mono text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {exp.date.split("-").slice(2).join("") || exp.date}
                            </span>
                            <span className="font-semibold text-xs text-slate-800 truncate">
                              {exp.description}
                            </span>
                            {exp.receiptImage && (
                              <button
                                type="button"
                                onClick={() => setPreviewModalImage(exp.receiptImage!)}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/80 px-1.5 py-0.5 rounded-md cursor-pointer transition active:scale-95"
                                title="View attached grocery receipt photo proof"
                              >
                                <Camera className="w-2.5 h-2.5" />
                                <span>Receipt Proof</span>
                              </button>
                            )}
                          </div>
                          
                          <div className="text-[10px] text-slate-400 mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.2 text-[9px] font-bold uppercase rounded-full border ${badgeClass}`}>
                              {exp.category || "Groceries"}
                            </span>
                            <span className="px-2 py-0.2 text-[9px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">
                              {splitLabel}
                            </span>
                            <span>•</span>
                            <span>Paid by:</span>
                            <span className="font-bold text-slate-700">
                              {payer ? payer.name : "Unknown"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg">
                            {formatCurrency(exp.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.description)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent transition cursor-pointer"
                            title="Delete this purchase entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Settlement & Balances Dashboard (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-8 sticky lg:top-24">
          
          {/* STEP 3: Settlement Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-slate-800" />
                <h3 className="font-serif font-bold text-xl text-slate-900">
                  3. Distribution Settlement
                </h3>
              </div>
              <span className="text-[9px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 uppercase rounded-full font-bold">
                {monthName} SUMMARY
              </span>
            </div>

            {activeResidents.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-6">
                <Info className="w-8 h-8 text-slate-400 mx-auto mb-3 animate-bounce" />
                <p className="text-xs font-bold text-slate-500">
                  Roster inactive for {monthName}.
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-mono uppercase">
                  Mark flatmates active in Step 1 to sync calculation sheets.
                </p>
              </div>
            ) : (
              <>
                {/* Metric Summary Card Box */}
                <div className="bg-slate-50/70 border border-slate-200/50 rounded-xl p-4 flex flex-col gap-3 font-mono text-xs text-slate-600 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total Monthly Spend</span>
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(calculation.totalExpenses)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Proportional Spend (Days-Lived)</span>
                    <span className="font-bold text-slate-700">{formatCurrency(proportionalTotal)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Equal Share Spend (Fixed Bills)</span>
                    <span className="font-bold text-slate-700">{formatCurrency(equalTotal)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Daily rate (Proportional)</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                      {formatCurrency(calculation.costPerDay)} / day
                    </span>
                  </div>
                </div>

                {/* Split Details Table */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Flatmate Ledger Share Table
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Flatmate</th>
                          <th className="py-2.5 px-3 text-right">Lived</th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-3 text-right">Roster Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-[11px] font-mono">
                        {calculation.summaries.map((summary) => (
                          <tr key={summary.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                              {summary.name}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {summary.daysLived}d
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {formatCurrency(summary.amountPaid)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">
                              {formatCurrency(summary.share)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Balances Display */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Outstanding Balance Sheets
                  </h4>
                  <div className="flex flex-col gap-2">
                    {calculation.summaries.map((summary) => {
                      const isCreditor = summary.balance > 0.005;
                      const isDebtor = summary.balance < -0.005;

                      return (
                        <div
                          key={summary.id}
                          className="flex justify-between items-center p-3 border border-slate-200/80 rounded-xl bg-slate-50/30"
                        >
                          <span className="text-xs font-semibold text-slate-700">
                            {summary.name}
                          </span>

                          <div className="text-right font-mono text-[11px]">
                            {isCreditor ? (
                              <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                                gets back {formatCurrency(summary.balance)}
                              </span>
                            ) : isDebtor ? (
                              <span className="font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md">
                                owes {formatCurrency(Math.abs(summary.balance))}
                              </span>
                            ) : (
                              <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                Settled ($0.00)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Minimised Settlement Instructions */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Required Transfer Instructions
                  </h4>

                  <div className="flex flex-col gap-2">
                    {calculation.settlements.length === 0 ? (
                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4.5 h-4.5 text-emerald-600" />
                        <span>All expenditures are balanced perfectly! No payments needed.</span>
                      </div>
                    ) : (
                      calculation.settlements.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="font-sans font-bold text-slate-800">{s.fromName}</span>
                            <span className="text-slate-500"> pays </span>
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                              {formatCurrency(s.amount)}
                            </span>
                            <span className="text-slate-500"> to </span>
                            <span className="font-sans font-bold text-slate-800">{s.toName}</span>
                          </div>

                          <button
                            onClick={() => handleCopySettlementText(s.fromName, s.toName, s.amount, idx)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition cursor-pointer shrink-0"
                            title="Copy split-settle text message"
                          >
                            {copiedSettlementIndex === idx ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reports Export Dashboard */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="group w-full p-4 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer duration-200 flex items-center justify-between shadow-md hover:shadow-lg"
                  >
                    <div className="text-left">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-indigo-300 font-bold block mb-0.5">
                        DOWNLOAD EXPORT
                      </span>
                      <span className="text-lg font-serif italic font-bold">
                        Monthly PDF Invoice Roster
                      </span>
                    </div>
                    <Download className="w-5 h-5 text-indigo-300 group-hover:scale-110 transition-transform duration-200" />
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="w-full p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Download CSV Ledger Spread</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Details */}
      <footer className="mt-auto py-6 bg-white border-t border-slate-200/60 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-[10px] uppercase tracking-widest font-mono text-slate-400 gap-4">
          <span className="font-semibold">RoomSplit System Offline-First Workspace</span>
          <div className="flex gap-4">
            <span>R-Unit 402</span>
            <span>•</span>
            <span>Sync Ready</span>
          </div>
        </div>
      </footer>

      {/* RECEIPT FULL PREVIEW MODAL */}
      <AnimatePresence>
        {previewModalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewModalImage(null)}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] cursor-default"
            >
              {/* Modal header */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 font-mono">
                    Receipt Image Verification
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal content */}
              <div className="p-4 bg-slate-50 flex-1 flex items-center justify-center overflow-y-auto max-h-[60vh]">
                <img
                  src={previewModalImage}
                  alt="Receipt Scan"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-lg border border-slate-200 shadow-xs"
                />
              </div>

              {/* Modal footer */}
              <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-[10px] text-slate-400 font-mono">
                  RoomSplit Receipt Scanner v1.2
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = previewModalImage;
                    link.download = "receipt-verification.jpg";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Image</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
