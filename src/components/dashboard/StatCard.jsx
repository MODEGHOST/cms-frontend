/** Placeholder dashboard components */
export function StatCard({ title, value }) {
  return (
    <div>
      <div>{title}</div>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}
