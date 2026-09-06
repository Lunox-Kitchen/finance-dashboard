import { withSupabase } from "npm:@supabase/server@^1";

interface IncomingPayload {
  message: string;
}

interface ParsedTransaction {
  bank: string;
  instrumentType: "debit_account" | "credit_card";
  transactionType:
    | "purchase"
    | "credit_card_payment"
    | "statement"
    | "cash_advance"
    | "transfer_in"
    | "transfer_out"
    | "declined"
    | "unknown";

  status: "completed" | "declined";

  merchant: string | null;
  amount: number | null;

  currency: string;

  cardLast4: string | null;

  balanceAfter: number | null;

  availableCredit: number | null;

  statementBalance: number | null;

  minimumPayment: number | null;

  paymentDueDate: string | null;

  transactionDate: string | null;

  transactionTime: string | null;

  reference: string | null;

  category: string | null;
}


function categorizeMerchant(
  merchant: string | null
): string {
  if (!merchant) {
    return "Other";
  }

  const name =
    merchant.toUpperCase();

  if (
    name.includes("HEALTHY CALORIE") ||
    name.includes("TALABAT") ||
    name.includes("KEETA") ||
    name.includes("RESTAURANT") ||
    name.includes("CAFE") ||
    name.includes("AMAKIN")
  ) {
    return "Food";
  }

  if (
    name.includes("FUEL") ||
    name.includes("BAPCO") ||
    name.includes("PETROL") ||
    name.includes("GALALI")
  ) {
    return "Fuel";
  }

  if (
    name.includes("ALJAZIRA") ||
    name.includes("MARKET") ||
    name.includes("SUPERMARKET") ||
    name.includes("LULU")
  ) {
    return "Groceries";
  }

  if (
    name.includes("NETFLIX") ||
    name.includes("SPOTIFY")
  ) {
    return "Subscriptions";
  }

  return "Other";
}


function convertDate(
  day: string,
  month: string,
  year: string
): string {
  const fullYear =
    year.length === 2
      ? `20${year}`
      : year;

  return `${fullYear}-${month}-${day}`;
}


function detectBank(
  message: string
): string | null {
  const upper =
    message.toUpperCase();

  if (
    upper.includes("17214433")
  ) {
    return "NBB";
  }

  if (
    upper.includes("17123456")
  ) {
    return "ila";
  }


  if (
    upper.includes("17221999")
  ) {
    return "KFH";
  }

  return null;
}


/* ==========================
   NBB
   ========================== */

function parseNbb(
  message: string
): ParsedTransaction | null {
  const upper =
    message.toUpperCase();


  /* NBB CREDIT PURCHASE */

  const purchaseRegex =
    /BHD\s?([\d.]+)\s+at\s+(.+?)\s+on\s+(\d{2})\/(\d{2})\/(\d{2})\s+at\s+(\d{2}:\d{2})\s+was made using card ending\s+(\d{4}).*?BHD\s?(-?[\d.]+)\s+to use/i;

  const purchase =
    message.match(
      purchaseRegex
    );

  if (purchase) {
    const merchant =
      purchase[2].trim();

    return {
      bank: "NBB",
      instrumentType:
        "credit_card",

      transactionType:
        "purchase",

      status:
        "completed",

      merchant,

      amount:
        Number(
          purchase[1]
        ),

      currency:
        "BHD",

      cardLast4:
        purchase[7],

      balanceAfter:
        null,

      availableCredit:
        Number(
          purchase[8]
        ),

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          purchase[3],
          purchase[4],
          purchase[5]
        ),

      transactionTime:
        purchase[6],

      reference:
        null,

      category:
        categorizeMerchant(
          merchant
        ),
    };
  }


  /* NBB CREDIT CARD PAYMENT */

  const paymentRegex =
    /Thank you for paying\s+BHD\s?([\d.]+)\s+for card ending\s+(\d{4})\s+on\s+(\d{2})\/(\d{2})\/(\d{2})\s+at\s+(\d{2}:\d{2}).*?BHD\s?(-?[\d.]+)\s+to use/i;

  const payment =
    message.match(
      paymentRegex
    );

  if (payment) {
    return {
      bank:
        "NBB",

      instrumentType:
        "credit_card",

      transactionType:
        "credit_card_payment",

      status:
        "completed",

      merchant:
        "Credit Card Payment",

      amount:
        Number(
          payment[1]
        ),

      currency:
        "BHD",

      cardLast4:
        payment[2],

      balanceAfter:
        null,

      availableCredit:
        Number(
          payment[7]
        ),

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          payment[3],
          payment[4],
          payment[5]
        ),

      transactionTime:
        payment[6],

      reference:
        null,

      category:
        "Credit Card Payment",
    };
  }


  /* NBB STATEMENT */

  const statementRegex =
    /Card ending\s+(\d{4}).*?closing balance is\s+BHD\s?([\d.]+).*?minimum of\s+BHD\s?([\d.]+)\s+by\s+(\d{2})\/(\d{2})\/(\d{4})/i;

  const statement =
    message.match(
      statementRegex
    );

  if (statement) {
    return {
      bank:
        "NBB",

      instrumentType:
        "credit_card",

      transactionType:
        "statement",

      status:
        "completed",

      merchant:
        "Credit Card Statement",

      amount:
        null,

      currency:
        "BHD",

      cardLast4:
        statement[1],

      balanceAfter:
        null,

      availableCredit:
        null,

      statementBalance:
        Number(
          statement[2]
        ),

      minimumPayment:
        Number(
          statement[3]
        ),

      paymentDueDate:
        convertDate(
          statement[4],
          statement[5],
          statement[6]
        ),

      transactionDate:
        null,

      transactionTime:
        null,

      reference:
        null,

      category:
        null,
    };
  }


  return null;
}


/* ==========================
   ILA
   ========================== */

function parseIla(
  message: string
): ParsedTransaction | null {
  const upper =
    message.toUpperCase();


  /* IGNORE DECLINED */

  if (
    upper.includes(
      "DECLINED"
    )
  ) {
    return {
      bank:
        "ila",

      instrumentType:
        "debit_account",

      transactionType:
        "declined",

      status:
        "declined",

      merchant:
        null,

      amount:
        null,

      currency:
        "BHD",

      cardLast4:
        null,

      balanceAfter:
        null,

      availableCredit:
        null,

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        null,

      transactionTime:
        null,

      reference:
        null,

      category:
        null,
    };
  }


  /* ILA DEBIT PURCHASE */

  const debitPurchaseRegex =
    /Purchase at\s+(.+?)\s+using card\s+\*{4}(\d{4})\s+for\s+BHD\s?([\d.]+)\s+on\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}).*?Balance\s+BHD\s?([\d.]+)/i;

  const debitPurchase =
    message.match(
      debitPurchaseRegex
    );

  if (
    debitPurchase &&
    !upper.includes(
      "CREDIT CARD PURCHASE"
    )
  ) {
    const merchant =
      debitPurchase[1].trim();

    return {
      bank:
        "ila",

      instrumentType:
        "debit_account",

      transactionType:
        "purchase",

      status:
        "completed",

      merchant,

      amount:
        Number(
          debitPurchase[3]
        ),

      currency:
        "BHD",

      cardLast4:
        debitPurchase[2],

      balanceAfter:
        Number(
          debitPurchase[8]
        ),

      availableCredit:
        null,

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          debitPurchase[4],
          debitPurchase[5],
          debitPurchase[6]
        ),

      transactionTime:
        debitPurchase[7],

      reference:
        null,

      category:
        categorizeMerchant(
          merchant
        ),
    };
  }


  /* ILA CREDIT CARD PURCHASE */

  const creditPurchaseRegex =
    /Credit Card Purchase at\s+(.+?)\s+using\s+(?:X|\*{4})(\d{4})\s+for\s+BHD\s?([\d.]+)\s+on\s+(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+(\d{2}:\d{2})\s+Bal\s+BHD\s?([\d.]+)/i;

  const creditPurchase =
    message.match(
      creditPurchaseRegex
    );

  if (
    creditPurchase
  ) {
    const merchant =
      creditPurchase[1].trim();

    let year =
      creditPurchase[6];

    if (!year) {
      year =
        new Date()
          .getFullYear()
          .toString();
    }

    return {
      bank:
        "ila",

      instrumentType:
        "credit_card",

      transactionType:
        "purchase",

      status:
        "completed",

      merchant,

      amount:
        Number(
          creditPurchase[3]
        ),

      currency:
        "BHD",

      cardLast4:
        creditPurchase[2],

      balanceAfter:
        null,

      availableCredit:
        Number(
          creditPurchase[8]
        ),

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          creditPurchase[4],
          creditPurchase[5],
          year
        ),

      transactionTime:
        creditPurchase[7],

      reference:
        null,

      category:
        categorizeMerchant(
          merchant
        ),
    };
  }


  /* ILA CREDIT CARD CASH ADVANCE */

  const cashAdvanceRegex =
    /Credit Card Cash Advance transferred from card\s+X{4}(\d{4}).*?amount of\s+BHD\s?([\d.]+).*?Available limit\s+BHD\s?([\d.]+)/i;

  const cashAdvanceAltRegex =
    /amount of\s+BHD\s?([\d.]+)\s+Credit Card Cash Advance transferred from card\s+X{4}(\d{4}).*?Available limit\s+BHD\s?([\d.]+)/i;


  let cashAdvance =
    message.match(
      cashAdvanceRegex
    );


  if (cashAdvance) {
    return {
      bank:
        "ila",

      instrumentType:
        "credit_card",

      transactionType:
        "cash_advance",

      status:
        "completed",

      merchant:
        "Credit Card Cash Advance",

      amount:
        Number(
          cashAdvance[2]
        ),

      currency:
        "BHD",

      cardLast4:
        cashAdvance[1],

      balanceAfter:
        null,

      availableCredit:
        Number(
          cashAdvance[3]
        ),

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        null,

      transactionTime:
        null,

      reference:
        null,

      category:
        "Cash Advance",
    };
  }


  cashAdvance =
    message.match(
      cashAdvanceAltRegex
    );


  if (
    cashAdvance
  ) {
    return {
      bank:
        "ila",

      instrumentType:
        "credit_card",

      transactionType:
        "cash_advance",

      status:
        "completed",

      merchant:
        "Credit Card Cash Advance",

      amount:
        Number(
          cashAdvance[1]
        ),

      currency:
        "BHD",

      cardLast4:
        cashAdvance[2],

      balanceAfter:
        null,

      availableCredit:
        Number(
          cashAdvance[3]
        ),

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        null,

      transactionTime:
        null,

      reference:
        null,

      category:
        "Cash Advance",
    };
  }


  /* ILA FAWRI OUT */

  const fawriOutRegex =
    /Fawri\+\s+transfer of\s+BHD\s?([\d.]+).*?completed on\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}).*?Ref\s+([A-Z0-9]+).*?Balance\s+BHD\s?([\d.]+)/i;

  const fawriOut =
    message.match(
      fawriOutRegex
    );

  if (
    fawriOut
  ) {
    return {
      bank:
        "ila",

      instrumentType:
        "debit_account",

      transactionType:
        "transfer_out",

      status:
        "completed",

      merchant:
        "Fawri+ Transfer",

      amount:
        Number(
          fawriOut[1]
        ),

      currency:
        "BHD",

      cardLast4:
        null,

      balanceAfter:
        Number(
          fawriOut[7]
        ),

      availableCredit:
        null,

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          fawriOut[2],
          fawriOut[3],
          fawriOut[4]
        ),

      transactionTime:
        fawriOut[5],

      reference:
        fawriOut[6],

      category:
        "Transfer",
    };
  }


  return null;
}


/* ==========================
   AL SALAM
   ========================== */

function parseAlSalam(
  message: string
): ParsedTransaction | null {
  const purchaseRegex =
    /BHD\s?([\d.]+)\s+has been debited from your account\s+X+\d+\s+at\s+(.+?)\s+on\s+(\d{2})\/(\d{2})\s+at\s+(\d{2}:\d{2}).*?balance is\s+BHD\s?([\d.]+)/i;

  const purchase =
    message.match(
      purchaseRegex
    );

  if (purchase) {
    const merchant =
      purchase[2].trim();

    const year =
      new Date()
        .getFullYear()
        .toString();

    return {
      bank:
        "Al Salam",

      instrumentType:
        "debit_account",

      transactionType:
        "purchase",

      status:
        "completed",

      merchant,

      amount:
        Number(
          purchase[1]
        ),

      currency:
        "BHD",

      cardLast4:
        null,

      balanceAfter:
        Number(
          purchase[6]
        ),

      availableCredit:
        null,

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          purchase[3],
          purchase[4],
          year
        ),

      transactionTime:
        purchase[5],

      reference:
        null,

      category:
        categorizeMerchant(
          merchant
        ),
    };
  }


  const genericDebitRegex =
    /BHD\s?([\d.]+)\s+has been debited from your account.*?balance is\s+BHD\s?([\d.]+)\s+on\s+(\d{2})\/(\d{2})\/(\d{2})\s+at\s+(\d{2}:\d{2})/i;

  const genericDebit =
    message.match(
      genericDebitRegex
    );

  if (
    genericDebit
  ) {
    return {
      bank:
        "Al Salam",

      instrumentType:
        "debit_account",

      transactionType:
        "transfer_out",

      status:
        "completed",

      merchant:
        "Account Debit",

      amount:
        Number(
          genericDebit[1]
        ),

      currency:
        "BHD",

      cardLast4:
        null,

      balanceAfter:
        Number(
          genericDebit[2]
        ),

      availableCredit:
        null,

      statementBalance:
        null,

      minimumPayment:
        null,

      paymentDueDate:
        null,

      transactionDate:
        convertDate(
          genericDebit[3],
          genericDebit[4],
          genericDebit[5]
        ),

      transactionTime:
        genericDebit[6],

      reference:
        null,

      category:
        "Transfer",
    };
  }


  return null;
}


/* ==========================
   KFH
   ========================== */

function parseKfh(
  message: string
): ParsedTransaction | null {
  /*
   * KFH Fawri+ OUTGOING
   * Example wording: "BD 325.500, Ref. ABC... credited to IBAN ... on 26/08/2026 at 23:58"
   */
  const outgoingRegex =
    /B(?:H)?D\s?([\d.]+),?\s*Ref\.\s*([A-Z0-9]+).*?credited\s+to\s+IBAN\s*([A-Z0-9]+).*?on\s+(\d{2})\/(\d{2})\/(\d{4})\s+at\s+(\d{2}:\d{2})/is;

  const outgoing = message.match(outgoingRegex);

  if (outgoing) {
    return {
      bank: "KFH",
      instrumentType: "debit_account",
      transactionType: "transfer_out",
      status: "completed",
      merchant: "Fawri+ Transfer Out",
      amount: Number(outgoing[1]),
      currency: "BHD",
      cardLast4: null,
      balanceAfter: null,
      availableCredit: null,
      statementBalance: null,
      minimumPayment: null,
      paymentDueDate: null,
      transactionDate: convertDate(outgoing[4], outgoing[5], outgoing[6]),
      transactionTime: outgoing[7],
      reference: outgoing[2],
      category: "Transfer",
    };
  }

  /*
   * KFH Fawri+ INCOMING
   * Example wording: "BD 0.100, Ref. ABC... received from IBAN ... on 06/09/2026 at 12:35"
   */
  const incomingRegex =
    /B(?:H)?D\s?([\d.]+),?\s*Ref\.\s*([A-Z0-9]+).*?received\s+from\s+IBAN\s*([A-Z0-9]+).*?on\s+(\d{2})\/(\d{2})\/(\d{4})\s+at\s+(\d{2}:\d{2})/is;

  const incoming = message.match(incomingRegex);

  if (incoming) {
    return {
      bank: "KFH",
      instrumentType: "debit_account",
      transactionType: "transfer_in",
      status: "completed",
      merchant: "Fawri+ Transfer In",
      amount: Number(incoming[1]),
      currency: "BHD",
      cardLast4: null,
      balanceAfter: null,
      availableCredit: null,
      statementBalance: null,
      minimumPayment: null,
      paymentDueDate: null,
      transactionDate: convertDate(incoming[4], incoming[5], incoming[6]),
      transactionTime: incoming[7],
      reference: incoming[2],
      category: "Transfer",
    };
  }

  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* ==========================
   MAIN PARSER
   ========================== */

function parseMessage(
  message: string
): ParsedTransaction | null {
  const bank = detectBank(message);

  if (!bank) {
    return null;
  }

  if (bank === "NBB") {
    const parsed = parseNbb(message);
    return parsed?.instrumentType === "credit_card" ? parsed : null;
  }

  if (bank === "ila") {
    const parsed = parseIla(message);
    return parsed?.instrumentType === "credit_card" ? parsed : null;
  }

  if (bank === "KFH") {
    return parseKfh(message);
  }

  return null;
}


/* ==========================
   EDGE FUNCTION
   ========================== */

export default {
  fetch: withSupabase(
    {
      auth: "none",
    },

    async (
      req,
      ctx
    ) => {
      try {
        if (
          req.method !==
          "POST"
        ) {
          return Response.json(
            {
              error:
                "POST requests only",
            },
            {
              status: 405,
            }
          );
        }


        const suppliedSecret =
          req.headers.get(
            "X-Finance-Key"
          );


        const expectedSecret =
          Deno.env.get(
            "FINANCE_WEBHOOK_SECRET"
          );


        if (
          !expectedSecret
        ) {
          return Response.json(
            {
              error:
                "Server secret missing",
            },
            {
              status: 500,
            }
          );
        }


        if (
          !suppliedSecret ||
          suppliedSecret !==
            expectedSecret
        ) {
          return Response.json(
            {
              error:
                "Unauthorized",
            },
            {
              status: 401,
            }
          );
        }


        const body:
          IncomingPayload =
          await req.json();


        if (
          !body.message
        ) {
          return Response.json(
            {
              error:
                "message is required",
            },
            {
              status: 400,
            }
          );
        }


        const parsed =
          parseMessage(
            body.message
          );


        if (!parsed) {
          return Response.json(
            {
              ignored: true,
              reason:
                "No supported transaction format matched",
            },
            {
              status: 200,
            }
          );
        }


        if (
          parsed.status ===
          "declined"
        ) {
          return Response.json({
            ignored: true,
            reason:
              "Declined transaction",
            bank:
              parsed.bank,
          });
        }


        /*
         * Statements update the card
         * but are not normal spending transactions.
         */

        if (
          parsed.transactionType ===
          "statement"
        ) {
          const {
            error:
              statementError,
          } =
            await ctx
              .supabaseAdmin
              .from("accounts")
              .update({
                statement_balance:
                  parsed.statementBalance,

                minimum_payment:
                  parsed.minimumPayment,

                payment_due_date:
                  parsed.paymentDueDate,

                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "bank",
                parsed.bank
              )
              .eq(
                "account_type",
                "credit"
              )
              .eq(
                "card_last4",
                parsed.cardLast4
              );


          if (
            statementError
          ) {
            console.error(
              statementError
            );
          }


          return Response.json({
            success: true,
            type:
              "statement",
            parsed,
          });
        }


        /*
         * Save transaction. The SMS hash prevents an iPhone Shortcut retry
         * from recording the same transaction twice.
         */

        const sourceHash = await sha256Hex(body.message);

        const {
          error:
            transactionError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              "transactions"
            )
            .insert({
              source_hash:
                sourceHash,
              bank:
                parsed.bank,

              merchant:
                parsed.merchant,

              amount:
                parsed.amount,

              direction:
                parsed.transactionType === "transfer_in" ||
                parsed.transactionType === "credit_card_payment"
                  ? "credit"
                  : "debit",

              card_last4:
                parsed.cardLast4,

              balance_after:
                parsed.balanceAfter,

              transaction_date:
                parsed.transactionDate,

              transaction_time:
                parsed.transactionTime,

              category:
                parsed.category,

              raw_message:
                body.message,

              instrument_type:
                parsed.instrumentType,

              transaction_type:
                parsed.transactionType,

              status:
                parsed.status,

              reference:
                parsed.reference,

              currency:
                parsed.currency,
            });


        if (
          transactionError
        ) {
          if (transactionError.code === "23505") {
            return Response.json({
              ignored: true,
              reason: "Duplicate SMS",
              bank: parsed.bank,
            });
          }

          console.error(transactionError);

          return Response.json(
            {
              error: "Could not save transaction",
              details: transactionError.message,
            },
            { status: 500 }
          );
        }


        /*
         * KFH Fawri+ messages do not contain the bank balance.
         * Adjust the stored balance atomically after a successful, non-duplicate insert.
         */
        if (
          parsed.bank === "KFH" &&
          parsed.instrumentType === "debit_account" &&
          parsed.balanceAfter === null &&
          parsed.amount !== null &&
          (parsed.transactionType === "transfer_in" || parsed.transactionType === "transfer_out")
        ) {
          const direction = parsed.transactionType === "transfer_in" ? "credit" : "debit";

          const { error: balanceError } = await ctx.supabaseAdmin.rpc(
            "adjust_kfh_balance",
            {
              p_amount: parsed.amount,
              p_direction: direction,
            }
          );

          if (balanceError) {
            console.error(balanceError);

            // Roll back the inserted transaction so a retry can safely try again.
            await ctx.supabaseAdmin
              .from("transactions")
              .delete()
              .eq("source_hash", sourceHash);

            return Response.json(
              {
                error: "Transaction saved but KFH balance could not be adjusted",
                details: balanceError.message,
              },
              { status: 500 }
            );
          }
        }


        /*
         * DEBIT ACCOUNT UPDATE
         */

        if (
          parsed.instrumentType ===
            "debit_account" &&
          parsed.balanceAfter !==
            null
        ) {
          let query =
            ctx
              .supabaseAdmin
              .from("accounts")
              .update({
                balance:
                  parsed.balanceAfter,

                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "bank",
                parsed.bank
              )
              .eq(
                "account_type",
                "debit"
              );


          if (
            parsed.cardLast4
          ) {
            query =
              query.eq(
                "card_last4",
                parsed.cardLast4
              );
          }


          const {
            error:
              accountError,
          } =
            await query;


          if (
            accountError
          ) {
            console.error(
              accountError
            );
          }
        }


        /*
         * CREDIT CARD UPDATE
         */

        if (
          parsed.instrumentType ===
            "credit_card"
        ) {
          const updateData:
            Record<string, unknown> =
            {
              updated_at:
                new Date()
                  .toISOString(),
            };


          if (
            parsed.availableCredit !==
            null
          ) {
            updateData[
              "available_credit"
            ] =
              parsed.availableCredit;
          }


          const {
            error:
              creditError,
          } =
            await ctx
              .supabaseAdmin
              .from("accounts")
              .update(
                updateData
              )
              .eq(
                "bank",
                parsed.bank
              )
              .eq(
                "account_type",
                "credit"
              )
              .eq(
                "card_last4",
                parsed.cardLast4
              );


          if (
            creditError
          ) {
            console.error(
              creditError
            );
          }
        }


        return Response.json({
          success: true,
          parsed,
        });
      }

      catch (
        error
      ) {
        console.error(
          error
        );

        return Response.json(
          {
            error:
              "Unexpected server error",
          },
          {
            status: 500,
          }
        );
      }
    }
  ),
};