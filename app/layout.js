import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata = {
  title: "Maths Formula Sheet — Engineering Mathematics M1, M2, M3, M4",
  description:
    "Complete, searchable formula sheet for Engineering Mathematics: Class 11–12 basics (algebra, trigonometry, differentiation, integration) plus M1 Units 1–5 and student-added formulas, theory, properties and syllabus for M2, M3 and M4.",
  keywords: [
    "maths formula sheet",
    "engineering mathematics formulas",
    "M1 formulas",
    "trigonometry formulas",
    "integration formulas",
    "differentiation formulas",
    "matrix formulas",
    "differential equations formulas",
    "complex analysis formulas",
  ],
  openGraph: {
    title: "Maths Formula Sheet — Engineering Mathematics",
    description:
      "All formulas, properties and short theory in one searchable place — basics to M1–M4.",
    type: "website",
  },
};

export const preferredRegion = "bom1";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
