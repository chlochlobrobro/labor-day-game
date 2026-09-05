export default function Initial({ name }: { name: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]);
  return <span className="avatar">{letters.join("").toUpperCase() || "?"}</span>;
}
