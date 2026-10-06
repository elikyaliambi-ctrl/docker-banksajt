"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(null);
  const [depositValue, setDepositValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token");

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    fetch(`${API_URL}/me/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: storedToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Din inloggning har gått ut");
        }
        return response.json();
      })
      .then((data) => setAmount(data.amount))
      .catch(() => {
        window.localStorage.removeItem("token");
        router.replace("/login");
      });
  }, [router]);

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const token = window.localStorage.getItem("token");
    const parsedAmount = Number(depositValue);
    if (!token || !parsedAmount || parsedAmount <= 0) {
      setError("Ange ett giltigt belopp");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/me/accounts/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: parsedAmount }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Insättningen misslyckades");
      }

      setAmount(data.amount);
      setDepositValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("token");
    router.push("/login");
  }

  if (amount === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Laddar konto...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Mitt konto
      </h1>

      <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">
        Saldo:{" "}
        <span className="font-semibold text-black dark:text-zinc-50">
          {amount} kr
        </span>
      </p>

      <form onSubmit={handleDeposit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Belopp
          <input
            type="number"
            min="1"
            value={depositValue}
            onChange={(event) => setDepositValue(event.target.value)}
            required
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-base text-black dark:border-white/20 dark:bg-black dark:text-zinc-50"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-12 rounded-full bg-foreground text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {loading ? "Sätter in..." : "Sätt in"}
        </button>
      </form>

      <Link
        href="/transactions"
        className="mt-6 self-start text-sm text-zinc-700 underline dark:text-zinc-300"
      >
        Se transaktioner
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 self-start text-sm text-zinc-500 underline dark:text-zinc-400"
      >
        Logga ut
      </button>
    </main>
  );
}
