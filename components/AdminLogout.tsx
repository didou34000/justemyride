"use client";

import { useRouter } from "next/navigation";

export default function AdminLogout() {
  const router = useRouter();
  return (
    <button
      className="link"
      onClick={async () => {
        await fetch("/api/admin/login", { method: "DELETE" });
        router.refresh();
      }}
    >
      Se déconnecter
    </button>
  );
}
