import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppMotionProvider } from "@/components/providers/AppMotionProvider";
import { DevInspector } from "./_dev-inspector/DevInspector";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POF - Game Development Assistant",
  description: "Power of Fun - UE5 C++ game development assistant powered by Claude",
};

/**
 * Root layout.
 *
 * Two things are load-bearing here beyond the fonts:
 *  - `<AppMotionProvider>` supplies the app's only `MotionConfig`. framer-motion
 *    defaults to `reducedMotion: "never"`, so without it every `motion.*` element
 *    ignores the OS preference that `globals.css` honours for CSS animations.
 *  - The body floor is token-backed (`bg-background` / `text-text`). It used to
 *    hardcode an arbitrary hex that had drifted one digit off the real
 *    `--background` (#0a0a16), so the page floor never matched the surface ladder
 *    painted on top of it.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-text`}
      >
        <AppMotionProvider>{children}</AppMotionProvider>
        {process.env.NODE_ENV === "development" && <DevInspector />}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111128',
              border: '1px solid #1e1e3a',
              color: '#e0e4f0',
            },
          }}
        />
      </body>
    </html>
  );
}
