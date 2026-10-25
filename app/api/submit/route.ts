import { after, NextResponse } from "next/server";
import { storageEnabled } from "@/lib/storage";
import { putFile } from "@/lib/store";
import { notifyNewRequest } from "@/lib/notify";
import { fetchBase } from "@/lib/base";
import type { Base } from "@/lib/catalog";
import { parsePlaque, type Plaque } from "@/lib/plaques";
import { authConfigured, clientKey, clientStatus, readClient, saveClient, userFromRequest } from "@/lib/clients";

type Submission = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  /** Taille souhaitée sur la fiche produit (1-43, 1-24, 1-18), indicative. */
  size?: string;
  /** La plaque choisie à l'étape « Ta plaque » (style + texte). */
  plaque?: Plaque;
  mode: "photos";
  files: { slot: string; url: string; pathname: string }[];
};

// Laisse le temps de télécharger le modèle Sketchfab, après la réponse au client.
export const maxDuration = 300;

/** Enregistre la demande (contact + liste des fichiers) à côté des fichiers envoyés. */
export async function POST(request: Request) {
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
  }

  const s = (await request.json()) as Submission & { client?: string; apercuPaye?: boolean };
  delete s.client;
  delete s.apercuPaye;

  // Connexion branchée : l'adresse est celle du compte, et un seul aperçu gratuit par compte.
  const user = authConfigured() ? await userFromRequest(request) : null;
  if (authConfigured() && !user) return NextResponse.json({ error: "Connecte-toi pour envoyer ta voiture" }, { status: 401 });
  if (user) s.email = user.email;
  if (!/^[\w-]{6,40}$/.test(s.id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(s.email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (!s.files?.length) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  if (s.size !== undefined && !/^1-(43|24|18)$/.test(s.size)) delete s.size;
  const plaque = parsePlaque(s.plaque);
  if (plaque) s.plaque = plaque;
  else delete s.plaque;

  if (user) {
    const key = clientKey(user.email);
    const c = await readClient(key, user.email);
    const st = clientStatus(c, user.email);
    if (!st.peutEnvoyer) {
      return NextResponse.json({ error: "Ton aperçu gratuit est déjà utilisé : le suivant est payant.", payant: true }, { status: 402 });
    }
    const payee = !st.gratuit;
    if (payee) c.credits -= 1;
    c.apercus.push({ id: s.id, at: new Date().toISOString(), ...(payee ? { payee } : {}) });
    await saveClient(key, c);
    s.client = key;
    if (payee) s.apercuPaye = true;
  }

  await putFile(`submissions/${s.id}/demande.json`, JSON.stringify({ ...s, receivedAt: new Date().toISOString() }, null, 2), "application/json");

  // L'alerte ne doit jamais faire échouer l'envoi : la demande est déjà enregistrée.
  let alert: string;
  try {
    alert = await notifyNewRequest(s);
  } catch (e) {
    console.error("Alerte e-mail non envoyée :", (e as Error).message);
    alert = "failed";
  }

  // Le modèle de base est téléchargé dans la commande tout de suite : le client n'attend pas.
  after(async () => {
    try {
      await fetchBase(s.id);
    } catch (e) {
      console.error("Modèle de base non téléchargé :", (e as Error).message);
    }
  });

  return NextResponse.json({ id: s.id, alert });
}
