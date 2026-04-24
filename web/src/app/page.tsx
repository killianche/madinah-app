import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";

/**
 * Главная — диспетчер по роли.
 * Разные роли идут в разные разделы.
 */
export default async function Home() {
  const { user } = await requireAuth();

  switch (user.role) {
    case "teacher":
      redirect("/teacher");
    case "manager":
    case "curator":
      redirect("/manager");
    case "director":
      redirect("/director");
    case "admin":
      redirect("/admin");
  }

  redirect("/login");
}
