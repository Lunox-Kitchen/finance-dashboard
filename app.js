const STORAGE_KEY = "financeDashboardDataV2";


const defaultData = {

    accounts: [

        {
            id: "kfh",
            name: "KFH",
            short: "K",
            balance: 0,
            updated: null
        },

        {
            id: "nbb",
            name: "NBB",
            short: "N",
            balance: 0,
            updated: null
        },

        {
            id: "alsalam",
            name: "Al Salam",
            short: "A",
            balance: 0,
            updated: null
        },

        {
            id: "ila",
            name: "ila",
            short: "i",
            balance: 0,
            updated: null
        },

        {
            id: "khaleeji",
            name: "Khaleeji",
            short: "K",
            balance: 0,
            updated: null
        }

    ],


    creditCards: [

        {
            id: "nbbCredit",
            name: "NBB Credit",
            used: 0,
            limit: 1000,
            dueDate: ""
        },

        {
            id: "ilaCredit",
            name: "ila Credit",
            used: 0,
            limit: 1000,
            dueDate: ""
        }

    ],


    savings: {
        current: 0,
        goal: 5000
    }

};


let financeData = loadData();

let activeAccount = null;

let activeCreditCard = null;

let balancesHidden = false;



/* ================================= */
/* DATA */
/* ================================= */


function cloneDefaultData() {

    return JSON.parse(
        JSON.stringify(defaultData)
    );

}


function loadData() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!saved) {

            const oldSaved =
                localStorage.getItem(
                    "financeDashboardData"
                );


            if (oldSaved) {

                const oldData =
                    JSON.parse(oldSaved);


                const migrated =
                    cloneDefaultData();


                if (
                    Array.isArray(
                        oldData.accounts
                    )
                ) {

                    migrated.accounts.forEach(
                        account => {

                            const oldAccount =
                                oldData.accounts.find(
                                    item =>
                                        item.id ===
                                        account.id
                                );


                            if (oldAccount) {

                                account.balance =
                                    Number(
                                        oldAccount.balance
                                    ) || 0;


                                account.updated =
                                    oldAccount.updated ||
                                    null;

                            }

                        }
                    );

                }


                if (
                    Array.isArray(
                        oldData.creditCards
                    )
                ) {

                    migrated.creditCards.forEach(
                        card => {

                            const oldCard =
                                oldData.creditCards.find(
                                    item =>
                                        item.id ===
                                        card.id
                                );


                            if (oldCard) {

                                card.used =
                                    Number(
                                        oldCard.used
                                    ) || 0;


                                card.limit =
                                    Number(
                                        oldCard.limit
                                    ) ||
                                    card.limit;

                            }

                        }
                    );

                }


                if (oldData.savings) {

                    migrated.savings.current =
                        Number(
                            oldData.savings.current
                        ) || 0;


                    migrated.savings.goal =
                        Number(
                            oldData.savings.goal
                        ) || 5000;

                }


                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(
                        migrated
                    )
                );


                return migrated;

            }


            return cloneDefaultData();

        }


        const parsed =
            JSON.parse(saved);


        return normalizeData(parsed);

    }

    catch (error) {

        console.error(
            "Unable to load dashboard data:",
            error
        );


        return cloneDefaultData();

    }

}


function normalizeData(data) {

    const normalized =
        cloneDefaultData();


    if (
        data &&
        Array.isArray(
            data.accounts
        )
    ) {

        normalized.accounts.forEach(
            account => {

                const existing =
                    data.accounts.find(
                        item =>
                            item.id ===
                            account.id
                    );


                if (existing) {

                    account.balance =
                        Number(
                            existing.balance
                        ) || 0;


                    account.updated =
                        existing.updated ||
                        null;

                }

            }
        );

    }


    if (
        data &&
        Array.isArray(
            data.creditCards
        )
    ) {

        normalized.creditCards.forEach(
            card => {

                const existing =
                    data.creditCards.find(
                        item =>
                            item.id ===
                            card.id
                    );


                if (existing) {

                    card.used =
                        Number(
                            existing.used
                        ) || 0;


                    card.limit =
                        Number(
                            existing.limit
                        ) || 0;


                    card.dueDate =
                        existing.dueDate ||
                        "";

                }

            }
        );

    }


    if (
        data &&
        data.savings
    ) {

        normalized.savings.current =
            Number(
                data.savings.current
            ) || 0;


        normalized.savings.goal =
            Number(
                data.savings.goal
            ) || 0;

    }


    return normalized;

}


function saveData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(financeData)
    );

}



/* ================================= */
/* FORMATTING */
/* ================================= */


function money(value) {

    return new Intl.NumberFormat(
        "en-BH",
        {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }
    ).format(
        Number(value) || 0
    );

}


function displayMoney(value) {

    if (balancesHidden) {

        return "BHD •••••";

    }


    return `BHD ${money(value)}`;

}


function getTodayFormatted() {

    return new Date()
        .toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}


function formatDueDate(dateString) {

    if (!dateString) {

        return "Not set";

    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Not set";

    }


    return date
        .toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}



/* ================================= */
/* TOTALS */
/* ================================= */


function getTotals() {

    const totalCash =
        financeData.accounts.reduce(
            (sum, account) =>
                sum +
                (
                    Number(
                        account.balance
                    ) || 0
                ),
            0
        );


    const totalCreditUsed =
        financeData.creditCards.reduce(
            (sum, card) =>
                sum +
                (
                    Number(
                        card.used
                    ) || 0
                ),
            0
        );


    const totalCreditLimit =
        financeData.creditCards.reduce(
            (sum, card) =>
                sum +
                (
                    Number(
                        card.limit
                    ) || 0
                ),
            0
        );


    const netWorth =
        totalCash -
        totalCreditUsed;


    const utilization =
        totalCreditLimit > 0
            ?
            (
                totalCreditUsed /
                totalCreditLimit
            ) * 100
            :
            0;


    return {

        totalCash,
        totalCreditUsed,
        totalCreditLimit,
        netWorth,
        utilization

    };

}



/* ================================= */
/* NAVIGATION */
/* ================================= */


const pageTitles = {

    dashboard:
        "Dashboard",

    accounts:
        "Accounts",

    credit:
        "Credit Cards",

    savings:
        "Savings",

    analytics:
        "Analytics"

};


function showPage(
    pageName,
    clickedButton
) {

    document
        .querySelectorAll(".page")
        .forEach(
            page =>
                page.classList.remove(
                    "active-page"
                )
        );


    const page =
        document.getElementById(
            `page-${pageName}`
        );


    if (page) {

        page.classList.add(
            "active-page"
        );

    }


    document
        .querySelectorAll(".nav-item")
        .forEach(
            button =>
                button.classList.remove(
                    "active"
                )
        );


    if (clickedButton) {

        clickedButton.classList.add(
            "active"
        );

    }


    document.getElementById(
        "pageTitle"
    ).textContent =
        pageTitles[pageName] ||
        "My Finance";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


function goToPage(pageName) {

    const button =
        document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );


    showPage(
        pageName,
        button
    );

}



/* ================================= */
/* ACCOUNT CARDS */
/* ================================= */


function createAccountCard(
    account
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "account-card";


    const updatedText =
        account.updated
            ?
            `Updated ${account.updated}`
            :
            "Not updated yet";


    card.innerHTML = `

        <div class="bank-header">

            <div class="bank-icon">
                ${account.short}
            </div>

            <span class="bank-name">
                ${account.name}
            </span>

        </div>


        <div class="account-balance money">

            ${displayMoney(
                account.balance
            )}

        </div>


        <div class="updated">

            ${updatedText}

        </div>


        <button
            class="update-button"
            onclick="
                openBalanceModal(
                    '${account.id}'
                )
            "
        >

            Update balance →

        </button>

    `;


    return card;

}


function renderAccounts() {

    const mainGrid =
        document.getElementById(
            "accountsGrid"
        );


    const dashboardGrid =
        document.getElementById(
            "dashboardAccountsGrid"
        );


    mainGrid.innerHTML = "";

    dashboardGrid.innerHTML = "";


    financeData.accounts.forEach(
        account => {

            mainGrid.appendChild(
                createAccountCard(
                    account
                )
            );


            dashboardGrid.appendChild(
                createAccountCard(
                    account
                )
            );

        }
    );

}



/* ================================= */
/* CREDIT CARDS */
/* ================================= */


function createCreditCard(
    card
) {

    const percentage =
        card.limit > 0
            ?
            Math.min(
                (
                    card.used /
                    card.limit
                ) * 100,
                100
            )
            :
            0;


    const available =
        Math.max(
            card.limit -
            card.used,
            0
        );


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "credit-card";


    element.innerHTML = `

        <div class="credit-top">

            <span class="credit-name">
                ${card.name}
            </span>

            <span class="credit-limit money">

                Limit:
                ${displayMoney(
                    card.limit
                )}

            </span>

        </div>


        <div class="credit-values">

            <span>
                Used
            </span>

            <strong class="money">

                ${displayMoney(
                    card.used
                )}

            </strong>

        </div>


        <div class="progress-track">

            <div
                class="progress"
                style="
                    width:
                    ${percentage}%
                "
            ></div>

        </div>


        <div class="credit-extra">

            <span>

                ${percentage.toFixed(1)}%
                utilization

            </span>

            <span class="money">

                Available:
                ${displayMoney(
                    available
                )}

            </span>

        </div>


        <div class="credit-extra">

            <span>
                Due:
                ${formatDueDate(
                    card.dueDate
                )}
            </span>

            <button
                class="update-button"
                onclick="
                    openCreditModal(
                        '${card.id}'
                    )
                "
            >

                Update →

            </button>

        </div>

    `;


    return element;

}


function renderCreditCards() {

    const mainGrid =
        document.getElementById(
            "creditCardsGrid"
        );


    const dashboardGrid =
        document.getElementById(
            "dashboardCreditGrid"
        );


    mainGrid.innerHTML = "";

    dashboardGrid.innerHTML = "";


    financeData.creditCards.forEach(
        card => {

            mainGrid.appendChild(
                createCreditCard(
                    card
                )
            );


            dashboardGrid.appendChild(
                createCreditCard(
                    card
                )
            );

        }
    );

}



/* ================================= */
/* SAVINGS */
/* ================================= */


function renderSavings() {

    const current =
        Number(
            financeData.savings.current
        ) || 0;


    const goal =
        Number(
            financeData.savings.goal
        ) || 0;


    const percent =
        goal > 0
            ?
            Math.min(
                (
                    current /
                    goal
                ) * 100,
                100
            )
            :
            0;


    const remaining =
        Math.max(
            goal -
            current,
            0
        );


    const currentDisplay =
        displayMoney(current);


    const goalDisplay =
        displayMoney(goal);


    const remainingDisplay =
        balancesHidden
            ?
            "BHD ••••• remaining"
            :
            `BHD ${money(
                remaining
            )} remaining`;


    document.getElementById(
        "savingsAmount"
    ).textContent =
        currentDisplay;


    document.getElementById(
        "savingsCurrentDetail"
    ).textContent =
        currentDisplay;


    document.getElementById(
        "savingsGoal"
    ).textContent =
        goalDisplay;


    document.getElementById(
        "savingsProgress"
    ).style.width =
        `${percent}%`;


    document.getElementById(
        "savingsPercent"
    ).textContent =
        `${percent.toFixed(1)}% completed`;


    document.getElementById(
        "savingsRemaining"
    ).textContent =
        remainingDisplay;


    document.getElementById(
        "dashboardSavingsAmount"
    ).textContent =
        currentDisplay;


    document.getElementById(
        "dashboardSavingsGoal"
    ).textContent =
        goalDisplay;


    document.getElementById(
        "dashboardSavingsProgress"
    ).style.width =
        `${percent}%`;


    document.getElementById(
        "dashboardSavingsPercent"
    ).textContent =
        `${percent.toFixed(1)}% completed`;


    document.getElementById(
        "dashboardSavingsRemaining"
    ).textContent =
        remainingDisplay;


    document.getElementById(
        "savingSummaryCurrent"
    ).textContent =
        currentDisplay;


    document.getElementById(
        "savingSummaryRemaining"
    ).textContent =
        balancesHidden
            ?
            "BHD •••••"
            :
            `BHD ${money(
                remaining
            )}`;


    document.getElementById(
        "savingSummaryPercent"
    ).textContent =
        `${percent.toFixed(1)}%`;

}



/* ================================= */
/* DASHBOARD TOTALS */
/* ================================= */


function renderTotals() {

    const totals =
        getTotals();


    document.getElementById(
        "totalCash"
    ).textContent =
        displayMoney(
            totals.totalCash
        );


    document.getElementById(
        "creditUsed"
    ).textContent =
        displayMoney(
            totals.totalCreditUsed
        );


    document.getElementById(
        "netWorth"
    ).textContent =
        displayMoney(
            totals.netWorth
        );


    document.getElementById(
        "totalSavings"
    ).textContent =
        displayMoney(
            financeData.savings.current
        );


    document.getElementById(
        "accountsTotalCash"
    ).textContent =
        displayMoney(
            totals.totalCash
        );


    document.getElementById(
        "accountCount"
    ).textContent =
        financeData.accounts.length;


    const updatedCount =
        financeData.accounts.filter(
            account =>
                Boolean(
                    account.updated
                )
        ).length;


    document.getElementById(
        "recentlyUpdated"
    ).textContent =
        `${updatedCount} / ${financeData.accounts.length}`;


    document.getElementById(
        "creditPageUsed"
    ).textContent =
        displayMoney(
            totals.totalCreditUsed
        );


    document.getElementById(
        "creditPageLimit"
    ).textContent =
        displayMoney(
            totals.totalCreditLimit
        );


    document.getElementById(
        "creditPageUtilization"
    ).textContent =
        `${totals.utilization.toFixed(1)}%`;

}



/* ================================= */
/* ANALYTICS */
/* ================================= */


function renderAnalytics() {

    const totals =
        getTotals();


    document.getElementById(
        "analyticsCash"
    ).textContent =
        displayMoney(
            totals.totalCash
        );


    document.getElementById(
        "analyticsCredit"
    ).textContent =
        displayMoney(
            totals.totalCreditUsed
        );


    document.getElementById(
        "analyticsNetWorth"
    ).textContent =
        displayMoney(
            totals.netWorth
        );


    document.getElementById(
        "analyticsSavings"
    ).textContent =
        displayMoney(
            financeData.savings.current
        );


    renderBankDistribution(
        totals.totalCash
    );


    renderCreditAnalytics();

}


function renderBankDistribution(
    totalCash
) {

    const container =
        document.getElementById(
            "bankDistribution"
        );


    container.innerHTML = "";


    financeData.accounts.forEach(
        account => {

            const percentage =
                totalCash > 0
                    ?
                    (
                        account.balance /
                        totalCash
                    ) * 100
                    :
                    0;


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "distribution-item";


            row.innerHTML = `

                <div class="distribution-top">

                    <span class="distribution-name">

                        ${account.name}

                    </span>

                    <span class="distribution-value money">

                        ${displayMoney(
                            account.balance
                        )}

                        ·

                        ${percentage.toFixed(1)}%

                    </span>

                </div>


                <div class="distribution-bar">

                    <div
                        class="distribution-fill"
                        style="
                            width:
                            ${percentage}%
                        "
                    ></div>

                </div>

            `;


            container.appendChild(
                row
            );

        }
    );

}


function renderCreditAnalytics() {

    const container =
        document.getElementById(
            "creditAnalytics"
        );


    container.innerHTML = "";


    financeData.creditCards.forEach(
        card => {

            const percentage =
                card.limit > 0
                    ?
                    Math.min(
                        (
                            card.used /
                            card.limit
                        ) * 100,
                        100
                    )
                    :
                    0;


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "distribution-item";


            row.innerHTML = `

                <div class="distribution-top">

                    <span class="distribution-name">

                        ${card.name}

                    </span>

                    <span class="distribution-value">

                        ${percentage.toFixed(1)}%

                    </span>

                </div>


                <div class="distribution-bar">

                    <div
                        class="distribution-fill"
                        style="
                            width:
                            ${percentage}%
                        "
                    ></div>

                </div>

            `;


            container.appendChild(
                row
            );

        }
    );

}



/* ================================= */
/* ACCOUNT MODAL */
/* ================================= */


function openBalanceModal(id) {

    activeAccount =
        financeData.accounts.find(
            account =>
                account.id === id
        );


    if (!activeAccount) {

        return;

    }


    document.getElementById(
        "modalBankName"
    ).textContent =
        activeAccount.name;


    document.getElementById(
        "balanceInput"
    ).value =
        activeAccount.balance;


    document.getElementById(
        "balanceModal"
    ).classList.add(
        "show"
    );


    setTimeout(
        () => {

            document.getElementById(
                "balanceInput"
            ).focus();

        },
        100
    );

}


function closeBalanceModal() {

    document.getElementById(
        "balanceModal"
    ).classList.remove(
        "show"
    );

}


function saveBalance() {

    if (!activeAccount) {

        return;

    }


    const value =
        parseFloat(
            document.getElementById(
                "balanceInput"
            ).value
        );


    if (
        Number.isNaN(value)
    ) {

        alert(
            "Please enter a valid balance."
        );

        return;

    }


    activeAccount.balance =
        value;


    activeAccount.updated =
        getTodayFormatted();


    saveData();

    closeBalanceModal();

    render();

}



/* ================================= */
/* CREDIT MODAL */
/* ================================= */


function openCreditModal(id) {

    activeCreditCard =
        financeData.creditCards.find(
            card =>
                card.id === id
        );


    if (!activeCreditCard) {

        return;

    }


    document.getElementById(
        "creditModalName"
    ).textContent =
        activeCreditCard.name;


    document.getElementById(
        "creditUsedInput"
    ).value =
        activeCreditCard.used;


    document.getElementById(
        "creditLimitInput"
    ).value =
        activeCreditCard.limit;


    document.getElementById(
        "creditDueDateInput"
    ).value =
        activeCreditCard.dueDate || "";


    document.getElementById(
        "creditModal"
    ).classList.add(
        "show"
    );

}


function closeCreditModal() {

    document.getElementById(
        "creditModal"
    ).classList.remove(
        "show"
    );

}


function saveCredit() {

    if (!activeCreditCard) {

        return;

    }


    const used =
        parseFloat(
            document.getElementById(
                "creditUsedInput"
            ).value
        );


    const limit =
        parseFloat(
            document.getElementById(
                "creditLimitInput"
            ).value
        );


    const dueDate =
        document.getElementById(
            "creditDueDateInput"
        ).value;


    if (
        Number.isNaN(used) ||
        Number.isNaN(limit)
    ) {

        alert(
            "Please enter valid credit card values."
        );

        return;

    }


    if (used < 0 || limit < 0) {

        alert(
            "Values cannot be negative."
        );

        return;

    }


    activeCreditCard.used =
        used;


    activeCreditCard.limit =
        limit;


    activeCreditCard.dueDate =
        dueDate;


    saveData();

    closeCreditModal();

    render();

}



/* ================================= */
/* SAVINGS MODAL */
/* ================================= */


function openSavingsModal() {

    document.getElementById(
        "savingsInput"
    ).value =
        financeData.savings.current;


    document.getElementById(
        "goalInput"
    ).value =
        financeData.savings.goal;


    document.getElementById(
        "savingsModal"
    ).classList.add(
        "show"
    );

}


function closeSavingsModal() {

    document.getElementById(
        "savingsModal"
    ).classList.remove(
        "show"
    );

}


function saveSavings() {

    const savings =
        parseFloat(
            document.getElementById(
                "savingsInput"
            ).value
        );


    const goal =
        parseFloat(
            document.getElementById(
                "goalInput"
            ).value
        );


    if (
        Number.isNaN(savings) ||
        Number.isNaN(goal)
    ) {

        alert(
            "Please enter valid savings values."
        );

        return;

    }


    if (
        savings < 0 ||
        goal < 0
    ) {

        alert(
            "Savings values cannot be negative."
        );

        return;

    }


    financeData.savings.current =
        savings;


    financeData.savings.goal =
        goal;


    saveData();

    closeSavingsModal();

    render();

}



/* ================================= */
/* PRIVACY MODE */
/* ================================= */


function toggleBalances() {

    balancesHidden =
        !balancesHidden;


    document.getElementById(
        "hideBalances"
    ).textContent =
        balancesHidden
            ?
            "👁 Show Balances"
            :
            "👁 Hide Balances";


    document.getElementById(
        "mobileHideBalances"
    ).textContent =
        balancesHidden
            ?
            "🙈"
            :
            "👁";


    render();

}


document.getElementById(
    "hideBalances"
).addEventListener(
    "click",
    toggleBalances
);


document.getElementById(
    "mobileHideBalances"
).addEventListener(
    "click",
    toggleBalances
);



/* ================================= */
/* CLOSE MODALS */
/* ================================= */


window.addEventListener(
    "click",
    event => {

        const modals = [

            document.getElementById(
                "balanceModal"
            ),

            document.getElementById(
                "creditModal"
            ),

            document.getElementById(
                "savingsModal"
            )

        ];


        modals.forEach(
            modal => {

                if (
                    event.target === modal
                ) {

                    modal.classList.remove(
                        "show"
                    );

                }

            }
        );

    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeBalanceModal();

            closeCreditModal();

            closeSavingsModal();

        }

    }
);



/* ================================= */
/* MASTER RENDER */
/* ================================= */


function render() {

    renderAccounts();

    renderCreditCards();

    renderTotals();

    renderSavings();

    renderAnalytics();

}


render();