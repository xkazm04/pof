import { IBM_Plex_Mono, Inter, JetBrains_Mono } from 'next/font/google';

/** Lab fonts. `variable` exposes each as a CSS custom property so lab-tokens.css
 *  can map --lab-font-* to the active theme's face. `.className` is kept for the
 *  legacy `className={t.fontMono}` call sites (compat shim). */
export const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
export const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-jetbrains' });
export const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-ibm-plex' });

/** All three font-variable classNames, applied once on the lab root so the CSS vars resolve. */
export const labFontVars = `${inter.variable} ${jetbrainsMono.variable} ${ibmPlexMono.variable}`;
