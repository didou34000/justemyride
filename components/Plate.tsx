export default function Plate({ text }: { text: string }) {
  return (
    <div className="plate" aria-label="Plaque d'immatriculation">
      <span className="plate-band">
        <span className="plate-stars">★</span>F
      </span>
      <span className="plate-text">{text || "AB-123-CD"}</span>
      <span className="plate-band plate-band-right" />
    </div>
  );
}
