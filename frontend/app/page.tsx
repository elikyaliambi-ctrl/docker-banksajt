import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
        Enkel banking, helt digitalt
      </h1>
      <p className="mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Öppna ett konto på under en minut och sätt in dina första kronor direkt.
      </p>
      <Link
        href="/register"
        className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Skapa användare
      </Link>
    </main>
  );
}
