/**
 * Cinematic mood presets for the Post-Process Recipe Studio.
 *
 * Each preset defines which effects to enable and their parameter overrides,
 * creating a signature visual look that users can apply with one click.
 */

import type { PPPreset } from '@/types/post-process-studio';

export const PRESETS: PPPreset[] = [
  {
    id: 'film-noir',
    name: 'Film Noir',
    description: 'High contrast B&W with deep shadows and dramatic vignette',
    mood: 'film-noir',
    gradientFrom: '#1a1a2e',
    gradientTo: '#4a4a5e',
    enabledEffects: ['bloom', 'color-grading', 'ambient-occlusion', 'vignette', 'film-grain'],
    overrides: {
      'bloom': { 'Intensity': 0.3, 'Threshold': 2.0, 'Size Scale': 6.0 },
      'color-grading': { 'Temperature': 5500, 'Tint': -0.1, 'Saturation': 0.05, 'Contrast': 1.6, 'Gamma': 0.85 },
      'ambient-occlusion': { 'Intensity': 0.8, 'Radius': 250, 'Quality': 75 },
      'vignette': { 'Intensity': 0.7 },
      'film-grain': { 'Intensity': 0.35, 'Jitter': 0.8 },
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Saturated neons, chromatic aberration, and electric bloom',
    mood: 'cyberpunk-neon',
    gradientFrom: '#0a001a',
    gradientTo: '#ff00ff',
    enabledEffects: ['bloom', 'color-grading', 'vignette', 'chromatic-aberration'],
    overrides: {
      'bloom': { 'Intensity': 2.5, 'Threshold': 0.5, 'Size Scale': 8.0 },
      'color-grading': { 'Temperature': 4500, 'Tint': 0.3, 'Saturation': 1.6, 'Contrast': 1.3, 'Gamma': 1.1 },
      'vignette': { 'Intensity': 0.5 },
      'chromatic-aberration': { 'Intensity': 1.5, 'Start Offset': 0.4 },
    },
  },
  {
    id: 'horror-desaturation',
    name: 'Horror Desaturation',
    description: 'Washed-out color, heavy fog, oppressive darkness',
    mood: 'horror-desaturation',
    gradientFrom: '#0d0d0d',
    gradientTo: '#2a1a1a',
    enabledEffects: ['bloom', 'color-grading', 'ambient-occlusion', 'vignette', 'fog', 'film-grain'],
    overrides: {
      'bloom': { 'Intensity': 0.2, 'Threshold': 4.0, 'Size Scale': 3.0 },
      'color-grading': { 'Temperature': 4000, 'Tint': -0.2, 'Saturation': 0.25, 'Contrast': 1.4, 'Gamma': 0.75 },
      'ambient-occlusion': { 'Intensity': 0.9, 'Radius': 300, 'Quality': 80 },
      'vignette': { 'Intensity': 0.85 },
      'fog': { 'Density': 0.08, 'Height Falloff': 0.1, 'Start Distance': 0, 'Inscattering R': 0.1, 'Inscattering G': 0.08, 'Inscattering B': 0.08 },
      'film-grain': { 'Intensity': 0.2, 'Jitter': 0.6 },
    },
  },
  {
    id: 'fantasy-bloom',
    name: 'Fantasy Bloom',
    description: 'Soft ethereal glow with warm golden tones',
    mood: 'fantasy-bloom',
    gradientFrom: '#1a0f00',
    gradientTo: '#ffd700',
    enabledEffects: ['bloom', 'color-grading', 'depth-of-field', 'vignette'],
    overrides: {
      'bloom': { 'Intensity': 3.5, 'Threshold': -0.5, 'Size Scale': 12.0 },
      'color-grading': { 'Temperature': 7500, 'Tint': 0.15, 'Saturation': 1.15, 'Contrast': 0.95, 'Gamma': 1.05 },
      'depth-of-field': { 'Focal Distance': 500, 'F-Stop': 2.0, 'Sensor Width': 36 },
      'vignette': { 'Intensity': 0.3 },
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm sunset lighting with lens flare bloom',
    mood: 'golden-hour',
    gradientFrom: '#1a0800',
    gradientTo: '#ff8c00',
    enabledEffects: ['bloom', 'color-grading', 'vignette', 'exposure'],
    overrides: {
      'bloom': { 'Intensity': 1.5, 'Threshold': 0.8, 'Size Scale': 6.0 },
      'color-grading': { 'Temperature': 9000, 'Tint': 0.1, 'Saturation': 1.2, 'Contrast': 1.05, 'Gamma': 1.0 },
      'vignette': { 'Intensity': 0.35 },
      'exposure': { 'Min Brightness': 0.5, 'Max Brightness': 3.0, 'Speed Up': 2.0, 'Speed Down': 0.5 },
    },
  },
  {
    id: 'arctic-cold',
    name: 'Arctic Cold',
    description: 'Desaturated blue with high exposure and icy fog',
    mood: 'arctic-cold',
    gradientFrom: '#0a0a1e',
    gradientTo: '#88ccff',
    enabledEffects: ['bloom', 'color-grading', 'ambient-occlusion', 'vignette', 'fog'],
    overrides: {
      'bloom': { 'Intensity': 1.0, 'Threshold': 1.0, 'Size Scale': 5.0 },
      'color-grading': { 'Temperature': 3500, 'Tint': -0.3, 'Saturation': 0.6, 'Contrast': 1.15, 'Gamma': 1.1 },
      'ambient-occlusion': { 'Intensity': 0.4, 'Radius': 180, 'Quality': 60 },
      'vignette': { 'Intensity': 0.25 },
      'fog': { 'Density': 0.05, 'Height Falloff': 0.15, 'Start Distance': 200, 'Inscattering R': 0.7, 'Inscattering G': 0.8, 'Inscattering B': 0.95 },
    },
  },
  {
    id: 'underwater',
    name: 'Underwater',
    description: 'Teal caustics, heavy DOF, and light-scattering fog',
    mood: 'underwater',
    gradientFrom: '#001a1a',
    gradientTo: '#00ccaa',
    enabledEffects: ['bloom', 'color-grading', 'depth-of-field', 'vignette', 'fog', 'chromatic-aberration'],
    overrides: {
      'bloom': { 'Intensity': 1.2, 'Threshold': 0.3, 'Size Scale': 10.0 },
      'color-grading': { 'Temperature': 4500, 'Tint': -0.4, 'Saturation': 0.8, 'Contrast': 0.9, 'Gamma': 1.15 },
      'depth-of-field': { 'Focal Distance': 300, 'F-Stop': 1.4, 'Sensor Width': 24.576 },
      'vignette': { 'Intensity': 0.6 },
      'fog': { 'Density': 0.12, 'Height Falloff': 0.05, 'Start Distance': 0, 'Inscattering R': 0.05, 'Inscattering G': 0.35, 'Inscattering B': 0.4 },
      'chromatic-aberration': { 'Intensity': 0.8, 'Start Offset': 0.3 },
    },
  },
];
