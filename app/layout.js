import "./globals.css";

export const metadata = {
  title: "Saved Attachments Sync",
  description: "Auto-syncs files from a local folder into the bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:," />
      </head>
      <body>{children}</body>
    </html>
  );
}
