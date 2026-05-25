import { IBM_Plex_Mono, Inter, JetBrains_Mono } from 'next/font/google';

/** Lab fonts: Inter (body, both themes), IBM Plex Mono (light/Blueprint), JetBrains Mono (dark/Studio). */
export const inter = Inter({ subsets: ['latin'], display: 'swap' });
export const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap' });
export const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });
