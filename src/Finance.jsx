import { useEffect, useState } from "react";
import { db, fs } from "./firebase";
import {
  ref,
  push,
  onValue,
  remove,
  update,
} from "firebase/database";
import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

const dbFS = fs;
const isPermissionDeniedError = (err) =>
  typeof err?.code === "string"
  && (err.code.includes("permission-denied") || err.code.includes("PERMISSION_DENIED"));

function Finance({ user }) {
  const [name, setName] = useState("");
  const [initial, setInitial] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [txAmount, setTxAmount] = useState(0);
  const [txType, setTxType] = useState("given");
  const [txNote, setTxNote] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [transactions, setTransactions] = useState({});
  const [financeError, setFinanceError] = useState("");

  // Realtime listener for customers
  useEffect(() => {
    const customersRef = ref(db, `users/${user.uid}/finance/customers`);
    const txUnsubscribers = new Map();

    const unsubscribeCustomers = onValue(customersRef, (snap) => {
      const val = snap.val();
      if (!val) {
        setCustomers([]);
        setTransactions({});

        txUnsubscribers.forEach((unsub) => unsub());
        txUnsubscribers.clear();
        return;
      }

      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      setCustomers(list);

      const activeIds = new Set(list.map((customer) => customer.id));

      txUnsubscribers.forEach((unsub, customerId) => {
        if (!activeIds.has(customerId)) {
          unsub();
          txUnsubscribers.delete(customerId);
        }
      });

      list.forEach((customer) => {
        if (txUnsubscribers.has(customer.id)) {
          return;
        }

        const txRef = ref(db, `users/${user.uid}/finance/customers/${customer.id}/transactions`);
        const unsubscribeTx = onValue(txRef, (txSnap) => {
          const txVal = txSnap.val();
          if (!txVal) {
            setTransactions((prev) => ({ ...prev, [customer.id]: [] }));
            return;
          }
          const txList = Object.entries(txVal).map(([id, v]) => ({ id, ...v }));
          setTransactions((prev) => ({ ...prev, [customer.id]: txList }));
        });

        txUnsubscribers.set(customer.id, unsubscribeTx);
      });
    });

    return () => {
      unsubscribeCustomers();
      txUnsubscribers.forEach((unsub) => unsub());
      txUnsubscribers.clear();
    };
  }, [user.uid]);

  // Calculate net total based on current customer balances
  const calculateNetTotal = () => {
    let total = 0;
    customers.forEach((customer) => {
      total += customer.balance || 0;
    });
    return total;
  };

  // Get all transactions sorted by date
  const getAllTransactions = () => {
    const allTxs = [];
    customers.forEach((customer) => {
      (transactions[customer.id] || []).forEach((tx) => {
        allTxs.push({
          ...tx,
          customerName: customer.name,
          customerId: customer.id,
        });
      });
    });
    // Sort by date (newest first)
    return allTxs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const net = calculateNetTotal();
  const allTransactions = getAllTransactions();

  const addCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFinanceError("");

    const customerData = {
      name: name.trim(),
      balance: Number(initial) || 0,
      createdAt: Date.now(),
    };

    try {
      // Realtime DB is the source of truth for this screen.
      const newRef = await push(ref(db, `users/${user.uid}/finance/customers`), customerData);
      const id = newRef.key;

      // Keep Firestore mirrored when possible, but do not fail the UI if denied.
      try {
        await setDoc(doc(dbFS, "users", user.uid, "financeCustomers", id), customerData);
      } catch (err) {
        if (isPermissionDeniedError(err)) {
          console.warn("Firestore mirror skipped due to permissions:", err);
        } else {
          throw err;
        }
      }

      setName("");
      setInitial(0);
    } catch (err) {
      console.error("Failed to add customer:", err);
      setFinanceError("Could not add customer. Please check Firebase permissions and try again.");
    }
  };

  const addTransaction = async (customer) => {
    const amount = Number(txAmount) || 0;
    if (!amount) return;
    setFinanceError("");

    const delta = txType === "given" ? amount : -amount;

    const tx = {
      amount,
      type: txType,
      note: txNote || "",
      createdAt: Date.now(),
    };

    try {
      // Update Realtime customer balance and push transaction
      const customerRef = ref(db, `users/${user.uid}/finance/customers/${customer.id}`);
      await update(customerRef, { balance: (customer.balance || 0) + delta });
      await push(ref(db, `users/${user.uid}/finance/customers/${customer.id}/transactions`), tx);

      // Update Firestore mirror when allowed.
      try {
        const customerDocRef = doc(dbFS, "users", user.uid, "financeCustomers", customer.id);
        await updateDoc(customerDocRef, { balance: (customer.balance || 0) + delta });
        await addDoc(collection(dbFS, "users", user.uid, "financeCustomers", customer.id, "transactions"), tx);
      } catch (err) {
        if (isPermissionDeniedError(err)) {
          console.warn("Firestore mirror skipped due to permissions:", err);
        } else {
          throw err;
        }
      }

      setTxAmount(0);
      setTxNote("");
      setSelected(null);
    } catch (err) {
      console.error("Failed to add transaction:", err);
      setFinanceError("Could not save transaction. Please check Firebase permissions and try again.");
    }
  };

  return (
    <div className="finance-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h3>Finance Manager</h3>

      {/* Net Total Card */}
      <div style={{ padding: 16, background: "rgba(33, 150, 243, 0.15)", border: `2px solid ${net >= 0 ? "rgba(76, 175, 80, 0.4)" : "rgba(244, 67, 54, 0.4)"}`, borderRadius: 8, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#64b5f6", marginBottom: 6 }}>Current Net Total</div>
        <div style={{ fontSize: 28, fontWeight: "bold", color: net >= 0 ? "#4caf50" : "#f44336" }}>₨{net}</div>
      </div>

      <form className="finance-add-form" onSubmit={addCustomer} style={{ marginBottom: 18 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" style={{ padding: 8, marginRight: 8 }} />
        <input value={initial} onChange={(e) => setInitial(e.target.value)} type="number" placeholder="Initial balance" style={{ padding: 8, width: 140, marginRight: 8 }} />
        <button type="submit">Add Customer</button>
      </form>

      {financeError && (
        <div style={{ marginBottom: 12, color: "#ff6b6b", fontSize: 13 }}>{financeError}</div>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {customers.map((c) => (
          <li key={c.id} style={{ marginBottom: 12, padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
            <div className="finance-customer-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: transactions[c.id]?.length > 0 ? 8 : 0 }}>
              <div style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <div style={{ color: '#ccc', fontSize: 13 }}>Balance: <span style={{ color: c.balance >= 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>₨{c.balance ?? 0}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {transactions[c.id]?.length > 0 && (
                  <button onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)} style={{ padding: "4px 8px", fontSize: 12 }}>
                    {expandedCustomer === c.id ? "Hide" : "Show"} Transactions
                  </button>
                )}
                <button onClick={() => setSelected(c)}>Add</button>
                <button onClick={async () => {
                  setFinanceError("");
                  try {
                    await remove(ref(db, `users/${user.uid}/finance/customers/${c.id}`));
                    await deleteFirestoreCustomer(dbFS, user.uid, c.id);
                  } catch (err) {
                    console.error("Failed to delete customer:", err);
                    setFinanceError("Could not delete customer. Please try again.");
                  }
                }}>Delete</button>
              </div>
            </div>

            {/* Transactions List */}
            {expandedCustomer === c.id && transactions[c.id]?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}>
                {transactions[c.id].map((tx) => (
                  <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingLeft: 8 }}>
                    <span style={{ color: tx.type === "given" ? "#4caf50" : "#f44336" }}>
                      {tx.type === "given" ? "✓ Given" : "✗ Taken"} ₨{tx.amount}
                    </span>
                    <span style={{ color: "#999", fontSize: 11 }}>{tx.note || "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {selected && (
        <div className="finance-transaction-form" style={{ marginTop: 18, padding: 12, background: 'rgba(0,0,0,0.35)', borderRadius: 8 }}>
          <h4>New transaction for {selected.name}</h4>
          <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Amount" style={{ padding: 8, marginRight: 8 }} />
          <select value={txType} onChange={(e) => setTxType(e.target.value)} style={{ padding: 8, marginRight: 8 }}>
            <option value="given">Given (we gave cash)</option>
            <option value="taken">Taken (we took cash)</option>
          </select>
          <input value={txNote} onChange={(e) => setTxNote(e.target.value)} placeholder="Note" style={{ padding: 8, marginRight: 8 }} />
          <button onClick={() => addTransaction(selected)}>Save</button>
          <button onClick={() => setSelected(null)} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      )}

      {/* Finance History */}
      <div style={{ marginTop: 28 }}>
        <h4 style={{ marginBottom: 12 }}>📋 Finance History</h4>
        {allTransactions.length === 0 ? (
          <div style={{ padding: 12, color: "#999", textAlign: "center" }}>No transactions yet</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {allTransactions.map((tx) => (
              <li
                key={tx.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 10,
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  borderLeft: `3px solid ${tx.type === "given" ? "#4caf50" : "#f44336"}`,
                }}
              >
                <div>
                  <strong>{tx.customerName}</strong>
                  <div style={{ fontSize: 12, color: "#999" }}>{tx.note || "-"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: "bold",
                      color: tx.type === "given" ? "#4caf50" : "#f44336",
                    }}
                  >
                    {tx.type === "given" ? "+" : "-"}₨{tx.amount}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>{new Date(tx.createdAt).toLocaleDateString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function deleteFirestoreCustomer(dbFS, uid, id) {
  try {
    await deleteDoc(doc(dbFS, "users", uid, "financeCustomers", id));
  } catch (err) {
    console.warn("Error deleting firestore customer", err);
  }
}

export default Finance;
