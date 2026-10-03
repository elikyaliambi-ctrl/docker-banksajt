"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Fel användarnamn eller lösenord");
      }

      window.localStorage.setItem("token", data.token);
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Logga in
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Användarnamn
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-base text-black dark:border-white/20 dark:bg-black dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Lösenord
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {loading ? "Loggar in..." : "Logga in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Inget konto än?{" "}
        <Link
          href="/register"
          className="font-medium text-black underline dark:text-zinc-50"
        >
          Skapa konto
        </Link>
      </p>
    </main>
  );
}
