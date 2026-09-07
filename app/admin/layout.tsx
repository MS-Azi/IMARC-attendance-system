import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen flex">
      <AdminNav />
      <main className="flex-1 px-8 py-7 max-w-6xl">{children}</main>
    </div>
  );
}
