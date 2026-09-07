import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminNav />
      <main className="flex-1 w-full max-w-6xl px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
