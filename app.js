const SUPABASE_URL = "https://nrfeghdhrigeqnyocrmo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XKJkRv2F81dvxnFWhA9qmQ_BCWalXFn";
const STORAGE_KEY = "financeDashboardDataV3";

const defaultData = {
    accounts: [
        { id: "kfh", name: "KFH", short: "K", balance: 1.050, updated: null }
    ],
    creditCards: [
        {
            id: "nbbCredit",
            bank: "NBB",
            name: "NBB Credit",
            used: 140.484,
            limit: 200.000,
            availableCredit: 59.516,
            statementBalance: null,
            minimumPayment: null,
            dueDate: "",
            dueDay: 27,
            cardLast4: null,
            updated: null
        },
        {
            id: "ilaCredit",
            bank: "ila",
            name: "ila Credit",
            used: 562.040,
            limit: 1000.000,
            availableCredit: 437.960,
            statementBalance: null,
            minimumPayment: null,
            dueDate: "",
            dueDay: 27,
            cardLast4: null,
            updated: null
        }
    ],
    loans: [
        {
            id: "kfhFinance",
            bank: "KFH",
            name: "KFH Personal Finance",
            type: "Islamic Financing",
            originalAmount: 14200.000,
            contractedTotal: 0,
            outstanding: 14200.000,
            monthlyInstallment: 201.000,
            profitRate: 0,
            totalInstallments: 84,
            paidInstallments: 0,
            nextPaymentDate: "",
            endDate: "",
            updated: null
        }
    ],
    savings: { current: 0.000, goal: 5000.000 }
};

let financeData = JSON.parse(JSON.stringify(defaultData));
let remoteTransactions = [];
let activeAccount = null;
let activeCreditCard = null;
let activeLoan = null;
let balancesHidden = false;
let supabaseClient = null;
let realtimeChannel = null;
let refreshTimer = null;

/* =========================================================
   SUPABASE IS THE SOURCE OF TRUTH
   ========================================================= */

function cloneDefaultData() {
    return JSON.parse(JSON.stringify(defaultData));
}

/* =========================================================
   FORMAT
   ========================================================= */

function money(value) {
    return new Intl.NumberFormat("en-BH", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(Number(value) || 0);
}

function displayMoney(value) {
    return balancesHidden ? "BHD •••••" : `BHD ${money(value)}`;
}

function getTodayFormatted() {
    return new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDate(dateString) {
    if (!dateString) return "Not set";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Not set";
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function ordinalDay(day) {
    const n = Number(day);
    if (!Number.isFinite(n) || n < 1 || n > 31) return "Not set";
    const mod100 = n % 100;
    const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `${n}${suffix} of each month`;
}

function formatRemoteTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("en-BH", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function safeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   SUPABASE + AUTH
   ========================================================= */

async function initSupabase() {
    setConnectionStatus("Connecting…", "loading");

    try {
        const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            // Do not call Supabase queries synchronously inside the auth callback.
            // Defer the refresh so auth state changes cannot block data loading.
            setTimeout(() => handleSession(session), 0);
        });

        await handleSession(data.session);
    } catch (error) {
        console.error("Supabase initialization failed:", error);
        setConnectionStatus("Connection Error", "error");
        showAuthError("Could not connect to Supabase. Check your Internet connection.");
    }
}

async function handleSession(session) {
    const overlay = document.getElementById("authOverlay");
    const logoutButton = document.getElementById("logoutButton");

    if (!session) {
        if (overlay) overlay.classList.add("show");
        if (logoutButton) logoutButton.hidden = true;
        setConnectionStatus("Sign in required", "loading");
        stopRealtime();
        return;
    }

    if (overlay) overlay.classList.remove("show");
    if (logoutButton) logoutButton.hidden = false;
    await loadRemoteData();
    startRealtime();
}

async function signIn() {
    if (!supabaseClient) return;

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const button = document.getElementById("loginButton");

    if (!email || !password) {
        showAuthError("Enter your email and password.");
        return;
    }

    button.disabled = true;
    button.textContent = "Signing in…";
    showAuthError("");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    button.disabled = false;
    button.textContent = "Sign In";

    if (error) {
        showAuthError(error.message);
    }
}

async function signOut() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    remoteTransactions = [];
    renderTransactions();
}

function showAuthError(message) {
    const element = document.getElementById("loginError");
    if (element) element.textContent = message || "";
}

function setConnectionStatus(text, state = "ok") {
    const element = document.getElementById("connectionStatus");
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
    if (element.parentElement) element.parentElement.dataset.state = state;
}

async function loadRemoteData() {
    if (!supabaseClient) return;

    try {
        setConnectionStatus("Syncing…", "loading");

        const [stateResult, transactionsResult] = await Promise.all([
            supabaseClient
                .from("finance_state")
                .select("*")
                .eq("id", 1)
                .single(),
            supabaseClient
                .from("transactions")
                .select("bank,merchant,amount,direction,card_last4,balance_after,transaction_date,transaction_time,category,instrument_type,transaction_type,status,reference,currency,created_at")
                .order("created_at", { ascending: false })
                .limit(100)
        ]);

        if (stateResult.error) throw stateResult.error;
        if (transactionsResult.error) throw transactionsResult.error;

        mergeRemoteState(stateResult.data);
        remoteTransactions = transactionsResult.data || [];
        render();
        setConnectionStatus("Supabase Connected", "ok");
    } catch (error) {
        console.error("Supabase sync failed:", error);
        setConnectionStatus("Sync Error", "error");
    }
}

function mergeRemoteState(row) {
    if (!row) return;

    const kfh = financeData.accounts[0];
    kfh.balance = Number(row.kfh_balance) || 0;
    kfh.updated = formatRemoteTimestamp(row.updated_at) || kfh.updated;

    const nbb = financeData.creditCards.find(card => card.bank === "NBB");
    if (nbb) {
        nbb.limit = Number(row.nbb_credit_limit) || 0;
        nbb.availableCredit = row.nbb_available_credit === null ? null : Number(row.nbb_available_credit);
        nbb.used = nbb.availableCredit === null ? 0 : Math.max(nbb.limit - nbb.availableCredit, 0);
        nbb.statementBalance = row.nbb_statement_balance === null ? null : Number(row.nbb_statement_balance);
        nbb.minimumPayment = row.nbb_minimum_payment === null ? null : Number(row.nbb_minimum_payment);
        nbb.dueDay = Number(row.nbb_due_day) || 27;
        nbb.dueDate = row.nbb_payment_due_date || "";
        nbb.cardLast4 = row.nbb_card_last4 || null;
        nbb.updated = formatRemoteTimestamp(row.updated_at);
    }

    const ila = financeData.creditCards.find(card => card.bank === "ila");
    if (ila) {
        ila.limit = Number(row.ila_credit_limit) || 0;
        ila.availableCredit = row.ila_available_credit === null ? null : Number(row.ila_available_credit);
        ila.used = ila.availableCredit === null ? 0 : Math.max(ila.limit - ila.availableCredit, 0);
        ila.statementBalance = row.ila_statement_balance === null ? null : Number(row.ila_statement_balance);
        ila.minimumPayment = row.ila_minimum_payment === null ? null : Number(row.ila_minimum_payment);
        ila.dueDay = Number(row.ila_due_day) || 27;
        ila.dueDate = row.ila_payment_due_date || "";
        ila.cardLast4 = row.ila_card_last4 || null;
        ila.updated = formatRemoteTimestamp(row.updated_at);
    }

    financeData.savings.current = Number(row.savings_current) || 0;
    financeData.savings.goal = Number(row.savings_goal) || 0;

    const loan = financeData.loans[0];
    loan.originalAmount = Number(row.loan_original_amount) || 0;
    loan.contractedTotal = Number(row.loan_contracted_total) || 0;
    loan.outstanding = Number(row.loan_outstanding) || 0;
    loan.monthlyInstallment = Number(row.loan_monthly_installment) || 0;
    loan.profitRate = Number(row.loan_profit_rate) || 0;
    loan.totalInstallments = Number(row.loan_total_installments) || 0;
    loan.paidInstallments = Number(row.loan_paid_installments) || 0;
    loan.nextPaymentDate = row.loan_next_payment_date || "";
    loan.endDate = row.loan_end_date || "";
    loan.updated = formatRemoteTimestamp(row.updated_at);
}

function startRealtime() {
    if (!supabaseClient || realtimeChannel) return;

    realtimeChannel = supabaseClient
        .channel("finance-dashboard-live-v2")
        .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => loadRemoteData())
        .on("postgres_changes", { event: "*", schema: "public", table: "finance_state" }, () => loadRemoteData())
        .subscribe();

    // Reliable fallback. Realtime should be immediate; polling guarantees both devices
    // converge even if a browser temporarily loses the websocket.
    if (!refreshTimer) {
        refreshTimer = setInterval(loadRemoteData, 5000);
    }
}

function stopRealtime() {
    if (realtimeChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

/* =========================================================
   TOTALS
   ========================================================= */

function getTotals() {
    const totalCash = financeData.accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
    const totalCreditUsed = financeData.creditCards.reduce((sum, card) => sum + (Number(card.used) || 0), 0);
    const totalCreditLimit = financeData.creditCards.reduce((sum, card) => sum + (Number(card.limit) || 0), 0);
    const totalLoanOutstanding = financeData.loans.reduce((sum, loan) => sum + (Number(loan.outstanding) || 0), 0);
    const totalMonthlyFinance = financeData.loans.reduce((sum, loan) => sum + (Number(loan.monthlyInstallment) || 0), 0);
    const totalSavings = Number(financeData.savings.current) || 0;
    const totalCreditAvailable = Math.max(totalCreditLimit - totalCreditUsed, 0);

    // True net worth is still retained for Analytics.
    const netWorth = totalCash + totalSavings - totalCreditUsed - totalLoanOutstanding;

    // Dashboard headline intentionally excludes long-term KFH financing.
    const currentPosition = totalCash + totalSavings - totalCreditUsed;

    const utilization = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;

    return {
        totalCash,
        totalCreditUsed,
        totalCreditLimit,
        totalCreditAvailable,
        totalLoanOutstanding,
        totalMonthlyFinance,
        totalSavings,
        netWorth,
        currentPosition,
        utilization
    };
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const pageTitles = {
    dashboard: "Dashboard",
    accounts: "Accounts",
    credit: "Credit Cards",
    loans: "Islamic Financing",
    savings: "Savings",
    analytics: "Analytics"
};

function showPage(pageName, clickedButton) {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active-page"));
    const page = document.getElementById(`page-${pageName}`);
    if (page) page.classList.add("active-page");

    document.querySelectorAll(".nav-item").forEach(button => button.classList.remove("active"));
    if (clickedButton) clickedButton.classList.add("active");

    document.getElementById("pageTitle").textContent = pageTitles[pageName] || "My Finance";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToPage(pageName) {
    const button = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    showPage(pageName, button);
}

/* =========================================================
   ACCOUNTS
   ========================================================= */

function createAccountCard(account) {
    const card = document.createElement("div");
    card.className = "account-card";
    const updatedText = account.updated ? `Synced ${safeText(account.updated)}` : "Synced through Supabase";

    card.innerHTML = `
        <div class="bank-header">
            <div class="bank-icon">${safeText(account.short)}</div>
            <span class="bank-name">${safeText(account.name)}</span>
        </div>
        <div class="account-balance money">${displayMoney(account.balance)}</div>
        <div class="updated">${updatedText}</div>
        <button class="update-button" onclick="openBalanceModal('${account.id}')">Update balance →</button>
    `;
    return card;
}

function renderAccounts() {
    const mainGrid = document.getElementById("accountsGrid");
    const dashboardGrid = document.getElementById("dashboardAccountsGrid");
    if (!mainGrid || !dashboardGrid) return;

    mainGrid.innerHTML = "";
    dashboardGrid.innerHTML = "";
    financeData.accounts.forEach(account => {
        mainGrid.appendChild(createAccountCard(account));
        dashboardGrid.appendChild(createAccountCard(account));
    });
}

/* =========================================================
   CREDIT CARDS
   ========================================================= */

function createCreditCard(card) {
    const percentage = card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0;
    const available = card.availableCredit !== null
        ? card.availableCredit
        : Math.max(card.limit - card.used, 0);

    const element = document.createElement("div");
    element.className = "credit-card";

    const cardSuffix = card.cardLast4 ? ` •••• ${safeText(card.cardLast4)}` : "";
    const syncText = card.updated ? `Synced ${safeText(card.updated)}` : "Waiting for card SMS data";
    const statementText = card.statementBalance !== null
        ? `<span>Statement: ${displayMoney(card.statementBalance)}</span>`
        : "";
    const minimumText = card.minimumPayment !== null
        ? `<span>Minimum: ${displayMoney(card.minimumPayment)}</span>`
        : "";

    element.innerHTML = `
        <div class="credit-top">
            <span class="credit-name">${safeText(card.name)}${cardSuffix}</span>
            <span class="credit-limit money">Limit: ${displayMoney(card.limit)}</span>
        </div>
        <div class="credit-values">
            <span>Used</span>
            <strong class="money">${displayMoney(card.used)}</strong>
        </div>
        <div class="progress-track"><div class="progress" style="width:${percentage}%"></div></div>
        <div class="credit-extra">
            <span>${percentage.toFixed(1)}% utilization</span>
            <span class="money">Available: ${displayMoney(available)}</span>
        </div>
        <div class="credit-extra">
            <span>Due: ${card.dueDate ? formatDate(card.dueDate) : ordinalDay(card.dueDay)}</span>
            <button class="update-button" onclick="openCreditModal('${card.id}')">Settings →</button>
        </div>
        ${(statementText || minimumText) ? `<div class="credit-extra">${statementText}${minimumText}</div>` : ""}
        <div class="updated credit-sync-text">${syncText}</div>
    `;

    return element;
}

function renderCreditCards() {
    const mainGrid = document.getElementById("creditCardsGrid");
    const dashboardGrid = document.getElementById("dashboardCreditGrid");
    if (!mainGrid || !dashboardGrid) return;

    mainGrid.innerHTML = "";
    dashboardGrid.innerHTML = "";
    financeData.creditCards.forEach(card => {
        mainGrid.appendChild(createCreditCard(card));
        dashboardGrid.appendChild(createCreditCard(card));
    });
}

/* =========================================================
   TRANSACTIONS
   ========================================================= */

function renderTransactions() {
    const container = document.getElementById("dashboardTransactions");
    const count = document.getElementById("transactionCount");
    if (!container) return;

    if (count) count.textContent = `${remoteTransactions.length} synced`;

    const recent = remoteTransactions.slice(0, 12);
    if (!recent.length) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>No synced transactions yet</strong>
                <span>Your ila, NBB and KFH SMS transactions will appear here automatically.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(transaction => {
        const isCredit = transaction.direction === "credit";
        const sign = isCredit ? "+" : "−";
        const merchant = transaction.merchant || transaction.transaction_type || "Transaction";
        const date = transaction.transaction_date || "";
        const time = transaction.transaction_time || "";
        const meta = [transaction.bank, transaction.category, date, time].filter(Boolean).join(" • ");

        return `
            <div class="transaction-row">
                <div class="transaction-icon">${safeText(String(transaction.bank || "?").charAt(0).toUpperCase())}</div>
                <div class="transaction-main">
                    <strong>${safeText(merchant)}</strong>
                    <span>${safeText(meta)}</span>
                </div>
                <div class="transaction-amount ${isCredit ? "credit-in" : "debit-out"}">
                    ${balancesHidden ? "BHD •••••" : `${sign} BHD ${money(transaction.amount)}`}
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   LOANS / ISLAMIC FINANCING
   ========================================================= */

function getLoanProgress(loan) {
    if (loan.totalInstallments > 0) {
        return Math.min((loan.paidInstallments / loan.totalInstallments) * 100, 100);
    }
    if (loan.contractedTotal > 0) {
        return Math.min(Math.max(((loan.contractedTotal - loan.outstanding) / loan.contractedTotal) * 100, 0), 100);
    }
    return 0;
}

function createLoanCard(loan) {
    const progress = getLoanProgress(loan);
    const remainingInstallments = Math.max(loan.totalInstallments - loan.paidInstallments, 0);
    const element = document.createElement("div");
    element.className = "loan-card";

    element.innerHTML = `
        <div class="loan-top">
            <div class="loan-bank">
                <div class="bank-icon">K</div>
                <div>
                    <div class="loan-title">${safeText(loan.name)}</div>
                    <div class="loan-type">${safeText(loan.type)}</div>
                </div>
            </div>
            <span class="loan-badge">Sharia-compliant</span>
        </div>
        <div class="loan-outstanding">
            <span>Current Outstanding</span>
            <strong class="money">${displayMoney(loan.outstanding)}</strong>
        </div>
        <div class="progress-track large-progress"><div class="progress" style="width:${progress}%"></div></div>
        <div class="credit-extra">
            <span>${progress.toFixed(1)}% completed</span>
            <span>${remainingInstallments} installments remaining</span>
        </div>
        <div class="loan-stats">
            <div class="loan-stat"><span>Finance Amount</span><strong class="money">${displayMoney(loan.originalAmount)}</strong></div>
            <div class="loan-stat"><span>Contract Total</span><strong class="money">${displayMoney(loan.contractedTotal)}</strong></div>
            <div class="loan-stat"><span>Monthly</span><strong class="money">${displayMoney(loan.monthlyInstallment)}</strong></div>
            <div class="loan-stat"><span>Profit Rate</span><strong>${Number(loan.profitRate).toFixed(2)}%</strong></div>
            <div class="loan-stat"><span>Paid</span><strong>${loan.paidInstallments} / ${loan.totalInstallments}</strong></div>
            <div class="loan-stat"><span>Next Payment</span><strong>${formatDate(loan.nextPaymentDate)}</strong></div>
        </div>
        <div class="loan-dates">
            <span>End: ${formatDate(loan.endDate)}</span>
            <span>${loan.updated ? `Updated ${safeText(loan.updated)}` : "Not updated yet"}</span>
        </div>
        <button class="update-button" onclick="openLoanModal('${loan.id}')">Update financing →</button>
    `;

    return element;
}

function renderLoans() {
    const mainGrid = document.getElementById("loansGrid");
    const dashboardGrid = document.getElementById("dashboardLoansGrid");
    if (!mainGrid || !dashboardGrid) return;

    mainGrid.innerHTML = "";
    dashboardGrid.innerHTML = "";
    financeData.loans.forEach(loan => {
        mainGrid.appendChild(createLoanCard(loan));
        dashboardGrid.appendChild(createLoanCard(loan));
    });
}

/* =========================================================
   TOTALS / SAVINGS
   ========================================================= */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderTotals() {
    const totals = getTotals();

    setText("netWorth", displayMoney(totals.currentPosition));
    setText("totalCash", displayMoney(totals.totalCash));
    setText("creditUsed", displayMoney(totals.totalCreditUsed));
    setText("availableCredit", displayMoney(totals.totalCreditAvailable));
    setText("totalSavings", displayMoney(totals.totalSavings));

    setText("accountsTotalCash", displayMoney(totals.totalCash));
    setText("accountCount", String(financeData.accounts.length));
    const updatedCount = financeData.accounts.filter(account => account.updated).length;
    setText("recentlyUpdated", `${updatedCount} / ${financeData.accounts.length}`);

    setText("creditPageUsed", displayMoney(totals.totalCreditUsed));
    setText("creditPageLimit", displayMoney(totals.totalCreditLimit));
    setText("creditPageUtilization", `${totals.utilization.toFixed(1)}%`);

    setText("loanPageOutstanding", displayMoney(totals.totalLoanOutstanding));
    setText("loanPageMonthly", displayMoney(totals.totalMonthlyFinance));
    const loanProgress = financeData.loans.length ? getLoanProgress(financeData.loans[0]) : 0;
    setText("loanPageProgress", `${loanProgress.toFixed(1)}%`);
}

function renderSavings() {
    const current = Number(financeData.savings.current) || 0;
    const goal = Number(financeData.savings.goal) || 0;
    const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    const remaining = Math.max(goal - current, 0);

    setText("dashboardSavingsAmount", displayMoney(current));
    setText("dashboardSavingsGoal", displayMoney(goal));
    setText("dashboardSavingsPercent", `${percentage.toFixed(1)}% completed`);
    setText("dashboardSavingsRemaining", `${displayMoney(remaining)} remaining`);

    const dashboardProgress = document.getElementById("dashboardSavingsProgress");
    if (dashboardProgress) dashboardProgress.style.width = `${percentage}%`;

    setText("savingsAmount", displayMoney(current));
    setText("savingsCurrentDetail", displayMoney(current));
    setText("savingsGoal", displayMoney(goal));
    setText("savingsPercent", `${percentage.toFixed(1)}% completed`);
    setText("savingsRemaining", `${displayMoney(remaining)} remaining`);

    const progress = document.getElementById("savingsProgress");
    if (progress) progress.style.width = `${percentage}%`;
}

/* =========================================================
   ANALYTICS
   ========================================================= */

function renderAnalytics() {
    const totals = getTotals();
    setText("analyticsCash", displayMoney(totals.totalCash));
    setText("analyticsCredit", displayMoney(totals.totalCreditUsed));
    setText("analyticsLoans", displayMoney(totals.totalLoanOutstanding));
    setText("analyticsNetWorth", displayMoney(totals.netWorth));
    setText("analyticsSavings", displayMoney(financeData.savings.current));

    renderBankDistribution();
    renderCreditAnalytics();
    renderLiabilityAnalytics();
}

function renderBankDistribution() {
    const container = document.getElementById("bankDistribution");
    if (!container) return;

    const total = financeData.accounts.reduce((sum, account) => sum + Math.max(Number(account.balance) || 0, 0), 0);
    container.innerHTML = financeData.accounts.map(account => {
        const value = Math.max(Number(account.balance) || 0, 0);
        const percentage = total > 0 ? (value / total) * 100 : 0;
        return `
            <div class="analytics-row">
                <div class="analytics-row-top"><span>${safeText(account.name)}</span><strong>${displayMoney(value)}</strong></div>
                <div class="progress-track"><div class="progress" style="width:${percentage}%"></div></div>
                <small>${percentage.toFixed(1)}% of cash</small>
            </div>
        `;
    }).join("");
}

function renderCreditAnalytics() {
    const container = document.getElementById("creditAnalytics");
    if (!container) return;

    container.innerHTML = financeData.creditCards.map(card => {
        const percentage = card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0;
        return `
            <div class="analytics-row">
                <div class="analytics-row-top"><span>${safeText(card.name)}</span><strong>${percentage.toFixed(1)}%</strong></div>
                <div class="progress-track"><div class="progress" style="width:${percentage}%"></div></div>
                <small>${displayMoney(card.used)} used of ${displayMoney(card.limit)}</small>
            </div>
        `;
    }).join("");
}

function renderLiabilityAnalytics() {
    const container = document.getElementById("liabilityAnalytics");
    if (!container) return;

    const credit = getTotals().totalCreditUsed;
    const finance = getTotals().totalLoanOutstanding;
    const total = credit + finance;
    const creditPercent = total > 0 ? (credit / total) * 100 : 0;
    const financePercent = total > 0 ? (finance / total) * 100 : 0;

    container.innerHTML = `
        <div class="analytics-row">
            <div class="analytics-row-top"><span>Credit Cards</span><strong>${displayMoney(credit)}</strong></div>
            <div class="progress-track"><div class="progress" style="width:${creditPercent}%"></div></div>
            <small>${creditPercent.toFixed(1)}% of liabilities</small>
        </div>
        <div class="analytics-row">
            <div class="analytics-row-top"><span>KFH Financing</span><strong>${displayMoney(finance)}</strong></div>
            <div class="progress-track"><div class="progress" style="width:${financePercent}%"></div></div>
            <small>${financePercent.toFixed(1)}% of liabilities</small>
        </div>
    `;
}

/* =========================================================
   MODALS
   ========================================================= */

function openBalanceModal(id) {
    activeAccount = financeData.accounts.find(account => account.id === id);
    if (!activeAccount) return;
    document.getElementById("modalBankName").textContent = activeAccount.name;
    document.getElementById("balanceInput").value = activeAccount.balance;
    document.getElementById("balanceModal").classList.add("show");
}

function closeBalanceModal() {
    document.getElementById("balanceModal").classList.remove("show");
}

async function saveBalance() {
    if (!activeAccount || !supabaseClient) return;
    const balance = parseFloat(document.getElementById("balanceInput").value);
    if (Number.isNaN(balance)) {
        alert("Please enter a valid balance.");
        return;
    }

    const previous = financeData.accounts[0].balance;
    financeData.accounts[0].balance = balance;
    financeData.accounts[0].updated = "Just now";
    render();
    closeBalanceModal();

    const { error } = await supabaseClient
        .from("finance_state")
        .update({ kfh_balance: balance, updated_at: new Date().toISOString() })
        .eq("id", 1);

    if (error) {
        financeData.accounts[0].balance = previous;
        render();
        console.error(error);
        alert(`Could not save the KFH balance: ${error.message}`);
        return;
    }

    await loadRemoteData();
}

function openCreditModal(id) {
    activeCreditCard = financeData.creditCards.find(card => card.id === id);
    if (!activeCreditCard) return;
    document.getElementById("creditModalName").textContent = activeCreditCard.name;
    document.getElementById("creditUsedInput").value = activeCreditCard.used;
    document.getElementById("creditLimitInput").value = activeCreditCard.limit;
    document.getElementById("creditDueDateInput").value = activeCreditCard.dueDay || 27;
    document.getElementById("creditModal").classList.add("show");
}

function closeCreditModal() {
    document.getElementById("creditModal").classList.remove("show");
}

async function saveCredit() {
    if (!activeCreditCard || !supabaseClient) return;

    const used = parseFloat(document.getElementById("creditUsedInput").value);
    const limit = parseFloat(document.getElementById("creditLimitInput").value);
    const dueDay = parseInt(document.getElementById("creditDueDateInput").value, 10);

    if (Number.isNaN(used) || Number.isNaN(limit) || used < 0 || limit < 0 || used > limit) {
        alert("Enter valid credit values. Used amount cannot be greater than the limit.");
        return;
    }
    if (Number.isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        alert("Payment due day must be between 1 and 31.");
        return;
    }

    const availableCredit = Math.max(limit - used, 0);
    const prefix = activeCreditCard.bank === "NBB" ? "nbb" : "ila";
    const patch = {
        [`${prefix}_credit_limit`]: limit,
        [`${prefix}_available_credit`]: availableCredit,
        [`${prefix}_due_day`]: dueDay,
        updated_at: new Date().toISOString()
    };

    activeCreditCard.limit = limit;
    activeCreditCard.availableCredit = availableCredit;
    activeCreditCard.used = used;
    activeCreditCard.dueDay = dueDay;
    activeCreditCard.updated = "Just now";
    render();
    closeCreditModal();

    const { error } = await supabaseClient
        .from("finance_state")
        .update(patch)
        .eq("id", 1);

    if (error) {
        console.error(error);
        alert(`Could not save ${activeCreditCard.name}: ${error.message}`);
        await loadRemoteData();
        return;
    }

    await loadRemoteData();
}

function openLoanModal(id) {
    activeLoan = financeData.loans.find(loan => loan.id === id);
    if (!activeLoan) return;

    document.getElementById("loanModalName").textContent = activeLoan.name;
    document.getElementById("loanOriginalInput").value = activeLoan.originalAmount;
    document.getElementById("loanContractTotalInput").value = activeLoan.contractedTotal;
    document.getElementById("loanOutstandingInput").value = activeLoan.outstanding;
    document.getElementById("loanMonthlyInput").value = activeLoan.monthlyInstallment;
    document.getElementById("loanProfitRateInput").value = activeLoan.profitRate;
    document.getElementById("loanTotalInstallmentsInput").value = activeLoan.totalInstallments;
    document.getElementById("loanPaidInstallmentsInput").value = activeLoan.paidInstallments;
    document.getElementById("loanNextPaymentInput").value = activeLoan.nextPaymentDate;
    document.getElementById("loanEndDateInput").value = activeLoan.endDate;
    document.getElementById("loanModal").classList.add("show");
}

function closeLoanModal() {
    document.getElementById("loanModal").classList.remove("show");
}

async function saveLoan() {
    if (!activeLoan || !supabaseClient) return;

    const originalAmount = parseFloat(document.getElementById("loanOriginalInput").value) || 0;
    const contractedTotal = parseFloat(document.getElementById("loanContractTotalInput").value) || 0;
    const outstanding = parseFloat(document.getElementById("loanOutstandingInput").value) || 0;
    const monthlyInstallment = parseFloat(document.getElementById("loanMonthlyInput").value) || 0;
    const profitRate = parseFloat(document.getElementById("loanProfitRateInput").value) || 0;
    const totalInstallments = parseInt(document.getElementById("loanTotalInstallmentsInput").value, 10) || 0;
    const paidInstallments = parseInt(document.getElementById("loanPaidInstallmentsInput").value, 10) || 0;
    const nextPaymentDate = document.getElementById("loanNextPaymentInput").value || null;
    const endDate = document.getElementById("loanEndDateInput").value || null;

    if (paidInstallments > totalInstallments && totalInstallments > 0) {
        alert("Paid installments cannot exceed total installments.");
        return;
    }

    Object.assign(activeLoan, {
        originalAmount, contractedTotal, outstanding, monthlyInstallment, profitRate,
        totalInstallments, paidInstallments, nextPaymentDate: nextPaymentDate || "",
        endDate: endDate || "", updated: "Just now"
    });
    render();
    closeLoanModal();

    const { error } = await supabaseClient
        .from("finance_state")
        .update({
            loan_original_amount: originalAmount,
            loan_contracted_total: contractedTotal,
            loan_outstanding: outstanding,
            loan_monthly_installment: monthlyInstallment,
            loan_profit_rate: profitRate,
            loan_total_installments: totalInstallments,
            loan_paid_installments: paidInstallments,
            loan_next_payment_date: nextPaymentDate,
            loan_end_date: endDate,
            updated_at: new Date().toISOString()
        })
        .eq("id", 1);

    if (error) {
        console.error(error);
        alert(`Could not save financing details: ${error.message}`);
        await loadRemoteData();
        return;
    }

    await loadRemoteData();
}

function openSavingsModal() {
    document.getElementById("savingsInput").value = financeData.savings.current;
    document.getElementById("goalInput").value = financeData.savings.goal;
    document.getElementById("savingsModal").classList.add("show");
}

function closeSavingsModal() {
    document.getElementById("savingsModal").classList.remove("show");
}

async function saveSavings() {
    if (!supabaseClient) return;
    const savings = parseFloat(document.getElementById("savingsInput").value);
    const goal = parseFloat(document.getElementById("goalInput").value);

    if (Number.isNaN(savings) || Number.isNaN(goal) || savings < 0 || goal < 0) {
        alert("Please enter valid savings values.");
        return;
    }

    financeData.savings.current = savings;
    financeData.savings.goal = goal;
    render();
    closeSavingsModal();

    const { error } = await supabaseClient
        .from("finance_state")
        .update({
            savings_current: savings,
            savings_goal: goal,
            updated_at: new Date().toISOString()
        })
        .eq("id", 1);

    if (error) {
        console.error(error);
        alert(`Could not save savings: ${error.message}`);
        await loadRemoteData();
        return;
    }

    await loadRemoteData();
}

/* =========================================================
   PRIVACY + EVENTS
   ========================================================= */

function toggleBalances() {
    balancesHidden = !balancesHidden;
    document.getElementById("hideBalances").textContent = balancesHidden ? "👁 Show Balances" : "👁 Hide Balances";
    document.getElementById("mobileHideBalances").textContent = balancesHidden ? "🙈" : "👁";
    render();
}

function render() {
    renderAccounts();
    renderCreditCards();
    renderLoans();
    renderTotals();
    renderSavings();
    renderAnalytics();
    renderTransactions();
}

document.getElementById("hideBalances").addEventListener("click", toggleBalances);
document.getElementById("mobileHideBalances").addEventListener("click", toggleBalances);
document.getElementById("loginButton").addEventListener("click", signIn);
document.getElementById("logoutButton").addEventListener("click", signOut);
document.getElementById("loginPassword").addEventListener("keydown", event => {
    if (event.key === "Enter") signIn();
});

window.addEventListener("click", event => {
    ["balanceModal", "creditModal", "loanModal", "savingsModal"].forEach(id => {
        const modal = document.getElementById(id);
        if (event.target === modal) modal.classList.remove("show");
    });
});

window.addEventListener("focus", () => {
    if (supabaseClient) loadRemoteData();
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && supabaseClient) loadRemoteData();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeBalanceModal();
        closeCreditModal();
        closeLoanModal();
        closeSavingsModal();
    }
});

render();
initSupabase();
