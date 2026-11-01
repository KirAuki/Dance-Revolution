export default function ArrowIcon({ direction = "up-right" }) {
  return (
    <span
      className={`arrow-icon arrow-icon--${direction}`}
      aria-hidden="true"
    />
  );
}
