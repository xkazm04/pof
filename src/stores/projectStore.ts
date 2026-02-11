'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type GameGenre = 'roguelike' | 'tower-defense' | 'platformer' | 'fps' | 'rpg' | 'puzzle' | 'simulation' | 'other';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TargetPlatform = 'windows' | 'mac' | 'linux' | 'console' | 'mobile';

interface ProjectState {
  projectName: string;
  projectPath: string;
  ueVersion: string;
  gameGenre: GameGenre | null;
  targetPlatform: TargetPlatform[];
  experienceLevel: ExperienceLevel;
  isSetupComplete: boolean;
  isNewProject: boolean;
  setupStep: number;

  setProject: (data: Partial<ProjectState>) => void;
  completeSetup: () => void;
  resetProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectName: '',
      projectPath: '',
      ueVersion: '5.5.4',
      gameGenre: null,
      targetPlatform: ['windows'],
      experienceLevel: 'intermediate',
      isSetupComplete: false,
      isNewProject: true,
      setupStep: 0,

      setProject: (data) => set((state) => ({ ...state, ...data })),

      completeSetup: () => set({ isSetupComplete: true }),

      resetProject: () => set({
        projectName: '',
        projectPath: '',
        ueVersion: '5.5.4',
        gameGenre: null,
        targetPlatform: ['windows'],
        experienceLevel: 'intermediate',
        isSetupComplete: false,
        isNewProject: true,
        setupStep: 0,
      }),
    }),
    {
      name: 'pof-project',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
