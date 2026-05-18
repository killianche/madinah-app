import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Вход — Madinah" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const auth = await getAuth();
  if (auth) {
    redirect("/");
  }

  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-near-black">Madinah</h1>
          <p className="text-olive-gray mt-2">Журнал уроков</p>
        </div>

        <div className="card">
          <LoginForm redirectTo={sp.from} initialError={sp.error} />
        </div>
      </div>
    </div>
  );
}
