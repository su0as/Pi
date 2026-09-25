import { brand } from "@pi/config/brand";

export default function HomePage() {
  return (
    <main>
      <h1>{brand.name}</h1>
      <p>Foundation scaffold — the real home page lands in milestone M6/M8.</p>
    </main>
  );
}
