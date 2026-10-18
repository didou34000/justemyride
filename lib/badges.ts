/**
 * Bibliothèque de badges 3D prêts à poser, par marque (faits une fois dans Blender : tools/badges.py).
 * Pas de logo de marque copié : un monogramme générique « JM » remplace le logo.
 * Quand la voiture d'une demande correspond, le bloc Logos se remplit tout seul.
 */
export type BadgeSet = { glb: string; image: string; label: string };

const SETS: (BadgeSet & { match: RegExp })[] = [
  { match: /\bmini\b/i, glb: "/badges/mini.glb", image: "/badges/mini.png", label: "Badges Mini : monogramme ailé JM, « S », « Cooper S »" },
];

export function badgeSet(car: string): BadgeSet | null {
  const s = SETS.find((x) => x.match.test(car));
  return s ? { glb: s.glb, image: s.image, label: s.label } : null;
}
