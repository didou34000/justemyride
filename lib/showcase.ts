/**
 * Images de la vitrine (accueil). Ce sont des rendus 3D sans logo (tools/shop_shots.py),
 * pas encore des photos de miniatures imprimées : la page le dit.
 * Pour le comparateur, remplace `before` par une vraie photo de voiture (la tienne ou celle d'un client
 * qui a donné son accord) et passe le libellé à « La vraie voiture ».
 */
export const hero = {
  before: { src: "/shop/origine_hero.jpg", label: "D'origine" },
  after: { src: "/shop/perso_hero.jpg", label: "Ta version" },
};

export const examples = [
  { img: "/shop/variante_bleu.jpg", name: "M140i bleue", detail: "Jantes noires, étriers bleus" },
  { img: "/shop/variante_nardo.jpg", name: "M140i gris Nardo", detail: "Jantes noires, étriers rouges" },
  { img: "/shop/variante_rouge.jpg", name: "M140i rouge", detail: "Jantes argent" },
  { img: "/shop/variante_noir.jpg", name: "M140i noire", detail: "Jantes bronze, étriers orange" },
];

export const shots = {
  base: "/shop/origine_34_avant.jpg",
  detail: "/shop/perso_diffuseur.jpg",
  done: "/shop/perso_34_avant.jpg",
  wide: "/shop/perso_large.jpg",
};
