import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["italic"],
  weight: "700",
  variable: "--font-playfair",
  display: "swap",
});

export const metadata = {
  title: "BlueVerse Co. — Research, Strategy & Clear Writing",
  description:
    "Bridging complex research, strategy, and clear writing for academics, decision-makers, and digital creators.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

