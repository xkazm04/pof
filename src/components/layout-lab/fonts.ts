import { Fraunces, Oswald, IBM_Plex_Mono, Nunito, Inter, JetBrains_Mono } from 'next/font/google';

/** Per-variant web fonts for the identity lab. Variable fonts omit `weight`. */
export const fraunces = Fraunces({ subsets: ['latin'], display: 'swap' });
export const oswald = Oswald({ subsets: ['latin'], display: 'swap' });
export const nunito = Nunito({ subsets: ['latin'], display: 'swap' });
export const inter = Inter({ subsets: ['latin'], display: 'swap' });
export const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap' });
export const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });
