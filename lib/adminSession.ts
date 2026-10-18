import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionOk } from "@/lib/adminAuth";

/** Dans une page serveur : le visiteur est-il connecté en admin ? */
export async function adminSession() {
  return sessionOk((await cookies()).get(ADMIN_COOKIE)?.value);
}
