import "./globals.css";

export const metadata = {
  title: "manas-fm Example",
  description: "Example Next.js project demonstrating the manas-fm file management package",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
