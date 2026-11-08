import FormulaApp from "../components/FormulaApp";
import Tracker from "../components/Tracker";
import { getAllCategories, getAllEntries, getAllSyllabus } from "../lib/data";

export const revalidate = 30;
export const preferredRegion = "bom1";

export default async function HomePage() {
  const [categories, entries, syllabus] = await Promise.all([
    getAllCategories(),
    getAllEntries(),
    getAllSyllabus(),
  ]);
  return (
    <>
      <Tracker />
      <FormulaApp initialData={{ categories, entries, syllabus }} />
    </>
  );
}
