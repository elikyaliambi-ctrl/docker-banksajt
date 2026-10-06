"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";

type Transaction = {
  amount: number;
  type: string;
  createdAt: string;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token");

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    fetch(`${API_URL}/me/accounts/transactions`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Din inloggning har gått ut");
        }
        return response.json();
      })
      .then((data) => setTransactions(data.transactions))
      .catch(() => {
        window.localStorage.removeItem("token");
        router.replace("/login");
      });
  }, [router]);

  function formatDate(value: string) {
    return new Date(value).toLocaleString("sv-SE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Transaktioner
      </h1>

      <Link
        href="/account"
        className="mt-4 self-start text-sm text-zinc-500 underline dark:text-zinc-400"
      >
        Tillbaka till kontot
      </Link>

      {transactions === null && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Laddar transaktioner...
        </p>
      )}

      {transactions !== null && transactions.length === 0 && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Inga transaktioner ännu. Sätt in pengar på kontosidan för att se dem
          här.
        </p>
      )}

      {transactions !== null && transactions.length > 0 && (
        <ul className="mt-8 flex flex-col gap-3">
          {transactions.map((transaction, index) => (
            <li
              key={index}
              className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3 dark:border-white/20"
            >
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatDate(transaction.createdAt)}
              </span>
              <span className="font-semibold text-black dark:text-zinc-50">
                +{transaction.amount} kr
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
