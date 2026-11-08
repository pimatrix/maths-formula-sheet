import Link from "next/link";
import { notFound } from "next/navigation";
import Tracker from "../../../components/Tracker";
import ShareButton from "../../../components/ShareButton";
import { getAllCategories, getAllEntries, getAllSyllabus } from "../../../lib/data";
import { formulaTextToHtml } from "../../../lib/render";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const categories = await getAllCategories();
  const cat = categories.find((c) => c.slug === params.slug);
  if (!cat) return { title: "Category not found — Maths Formula Sheet" };
  return {
    title: `${cat.title} — All Formulas, Properties & Theory | Maths Formula Sheet`,
    description: `All ${cat.title} formulas with properties and short theory — searchable, printable, with syllabus. Engineering Mathematics formula sheet.`,
  };
}

export default async function CategoryPage({ params }) {
  const [categories, entries, syllabus] = await Promise.all([
    getAllCategories(),
    getAllEntries(),
    getAllSyllabus(),
  ]);
  const cat = categories.find((c) => c.slug === params.slug);
  if (!cat) notFound();
  const list = entries.filter((e) => e.category === cat.slug);
  const syl = syllabus.filter((s) => s.category === cat.slug);
  const sections = [];
  const secMap = {};
  list.forEach((e) => {
    const s = e.section || "General";
    if (!secMap[s]) {
      secMap[s] = [];
      sections.push({ name: s, items: secMap[s] });
    }
    secMap[s].push(e);
  });

  return (
    <div className="fs-root">
      <Tracker category={cat.slug} />
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <p style={{ margin: "0 0 6px" }}>
            <Link href="/" style={{ color: "#f5b942" }}>← All formulas</Link>
          </p>
          <h1>{cat.title}</h1>
          <p>{list.length} entries — formulas, properties and short theory.</p>
        </div>
      </div>
      <main className="fs-main">
        {sections.map((s) => (
          <div key={s.name} className="fs-section">
            {s.name !== "General" && <h2 className="fs-sec-title">{s.name}</h2>}
            <div className="fs-grid">
              {s.items.map((e) => (
                <article key={e.id} className={"fs-card" + (e.kind === "theory" ? " fs-theory" : "") + (e.kind === "table" ? " fs-table-card" : "")}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 14.5, color: "#143a66" }}>{e.name}</h3>
                  {e.userAdded ? (
                    <div className="fs-body" dangerouslySetInnerHTML={{ __html: formulaTextToHtml(e.body) }} />
                  ) : (
                    <div className="fs-body" dangerouslySetInnerHTML={{ __html: e.body }} />
                  )}
                  <div className="fs-card-actions">
                    <ShareButton name={e.name} category={e.category} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
        {syl.length > 0 && (
          <section className="fs-cat">
            <h2 className="fs-cat-title">Syllabus — {cat.title}</h2>
            <div className="fs-syllabus-list">
              {syl.map((s) => (
                <div key={s.id} className="fs-syllabus-item">
                  <h4>{s.title}</h4>
                  {s.content && <div className="content">{s.content}</div>}
                  {s.file_url && (
                    <p style={{ margin: "6px 0 0" }}>
                      <a href={s.file_url} target="_blank" rel="noreferrer">Open / download file: {s.file_name || "syllabus file"}</a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
