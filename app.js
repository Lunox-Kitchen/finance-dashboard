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
            limit: 1000
        },

        {
            id: "ilaCredit",
            name: "ila Credit",
            used: 0,
            limit: 1000
        }
    ],

    savings: {
        current: 0,
        goal: 5000
    }

};


let financeData =
    JSON.parse(
        localStorage.getItem(
            "financeDashboardData"
        )
    ) || defaultData;


let activeAccount = null;

let balancesHidden = false;


function saveData() {

    localStorage.setItem(
        "financeDashboardData",
        JSON.stringify(financeData)
    );

}


function money(value) {

    return new Intl.NumberFormat(
        "en-BH",
        {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }
    ).format(value);

}


function displayMoney(value) {

    if (balancesHidden) {
        return "BHD •••••";
    }

    return `BHD ${money(value)}`;

}


function renderAccounts() {

    const grid =
        document.getElementById(
            "accountsGrid"
        );

    grid.innerHTML = "";


    financeData.accounts.forEach(
        account => {

            const updatedText =
                account.updated
                    ? `Updated ${account.updated}`
                    : "Not updated yet";


            const card =
                document.createElement("div");

            card.className =
                "account-card";


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


            grid.appendChild(card);

        }
    );

}


function renderCreditCards() {

    const grid =
        document.getElementById(
            "creditCardsGrid"
        );


    grid.innerHTML = "";


    financeData.creditCards.forEach(
        card => {

            const percentage =
                card.limit > 0
                    ? Math.min(
                        (
                            card.used /
                            card.limit
                        ) * 100,
                        100
                    )
                    : 0;


            const element =
                document.createElement("div");


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


                <div class="savings-bottom">

                    <span>
                        ${percentage.toFixed(1)}%
                        utilization
                    </span>

                    <button
                        class="update-button"
                        onclick="
                            updateCredit(
                                '${card.id}'
                            )
                        "
                    >
                        Update
                    </button>

                </div>

            `;


            grid.appendChild(element);

        }
    );

}


function calculateTotals() {

    const totalCash =
        financeData.accounts.reduce(
            (sum, account) =>
                sum + account.balance,
            0
        );


    const totalCredit =
        financeData.creditCards.reduce(
            (sum, card) =>
                sum + card.used,
            0
        );


    const netWorth =
        totalCash - totalCredit;


    document.getElementById(
        "totalCash"
    ).textContent =
        displayMoney(totalCash);


    document.getElementById(
        "creditUsed"
    ).textContent =
        displayMoney(totalCredit);


    document.getElementById(
        "netWorth"
    ).textContent =
        displayMoney(netWorth);


    document.getElementById(
        "totalSavings"
    ).textContent =
        displayMoney(
            financeData.savings.current
        );

}


function renderSavings() {

    const current =
        financeData.savings.current;

    const goal =
        financeData.savings.goal;


    const percent =
        goal > 0
            ? Math.min(
                (current / goal) * 100,
                100
            )
            : 0;


    const remaining =
        Math.max(
            goal - current,
            0
        );


    document.getElementById(
        "savingsAmount"
    ).textContent =
        displayMoney(current);


    document.getElementById(
        "savingsGoal"
    ).textContent =
        displayMoney(goal);


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
        balancesHidden
            ? "BHD ••••• remaining"
            :
            `BHD ${money(
                remaining
            )} remaining`;

}


function render() {

    renderAccounts();

    renderCreditCards();

    calculateTotals();

    renderSavings();

}


function openBalanceModal(id) {

    activeAccount =
        financeData.accounts.find(
            account =>
                account.id === id
        );


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
    ).classList.add("show");

}


function closeBalanceModal() {

    document.getElementById(
        "balanceModal"
    ).classList.remove("show");

}


function saveBalance() {

    const input =
        parseFloat(
            document.getElementById(
                "balanceInput"
            ).value
        );


    if (Number.isNaN(input)) {
        return;
    }


    activeAccount.balance =
        input;


    activeAccount.updated =
        new Date().toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short"
            }
        );


    saveData();

    closeBalanceModal();

    render();

}


function updateCredit(id) {

    const card =
        financeData.creditCards.find(
            item =>
                item.id === id
        );


    const used =
        prompt(
            `${card.name}\n\nCurrent amount used:`,
            card.used
        );


    if (used === null) {
        return;
    }


    const limit =
        prompt(
            "Credit limit:",
            card.limit
        );


    if (limit === null) {
        return;
    }


    card.used =
        parseFloat(used) || 0;


    card.limit =
        parseFloat(limit) || 0;


    saveData();

    render();

}


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
    ).classList.add("show");

}


function closeSavingsModal() {

    document.getElementById(
        "savingsModal"
    ).classList.remove("show");

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


    financeData.savings.current =
        savings || 0;


    financeData.savings.goal =
        goal || 0;


    saveData();

    closeSavingsModal();

    render();

}


document.getElementById(
    "hideBalances"
).addEventListener(
    "click",
    function () {

        balancesHidden =
            !balancesHidden;


        this.textContent =
            balancesHidden
                ? "👁 Show Balances"
                : "👁 Hide Balances";


        render();

    }
);


function resetBalances() {

    const confirmReset =
        confirm(
            "Reset all dashboard data?"
        );


    if (!confirmReset) {
        return;
    }


    localStorage.removeItem(
        "financeDashboardData"
    );


    financeData =
        JSON.parse(
            JSON.stringify(defaultData)
        );


    saveData();

    render();

}


render();