import "./globals.css";

export const metadata = {
  title: "Invoice Automation Dashboard",
  description: "Outlook invoice email tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
