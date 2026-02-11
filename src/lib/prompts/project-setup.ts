export function buildSetupPrompt(config: {
  projectName: string;
  projectPath: string;
  gameGenre: string;
  ueVersion: string;
  targetPlatform: string[];
  experienceLevel: string;
  isNewProject: boolean;
}): string {
  if (config.isNewProject) {
    return `Create a complete UE5 ${config.ueVersion} C++ project from scratch for a ${config.gameGenre} game called "${config.projectName}".

The project should be created at: ${config.projectPath}/${config.projectName}

Target platforms: ${config.targetPlatform.join(', ')}
Developer experience: ${config.experienceLevel}

Create the full project structure:
1. ${config.projectName}.uproject file with correct engine association and modules
2. Source/${config.projectName}/ directory with:
   - ${config.projectName}.Build.cs with appropriate module dependencies
   - ${config.projectName}Module.h/.cpp (module implementation)
3. Core gameplay classes:
   - Custom GameMode (A${config.projectName}GameMode)
   - Custom GameState
   - Custom PlayerController
   - Custom Character appropriate for a ${config.gameGenre}
4. Config/ directory with:
   - DefaultEngine.ini with rendering and physics settings
   - DefaultGame.ini with project metadata
   - DefaultInput.ini for Enhanced Input System
5. Add helpful comments explaining each file's purpose

Use UE5 best practices:
- Enhanced Input System for input
- Proper UPROPERTY/UFUNCTION macros with specifiers
- Forward declarations in headers, includes in .cpp
- Component-based architecture
- Unreal naming conventions (A for Actors, U for UObjects, F for structs)`;
  }

  return `Analyze and integrate with the existing UE5 ${config.ueVersion} C++ project at this path for a ${config.gameGenre} game called "${config.projectName}".

Target platforms: ${config.targetPlatform.join(', ')}
Developer experience: ${config.experienceLevel}

Please:
1. Read the existing project structure and understand what's already there
2. Identify any missing core gameplay classes (GameMode, GameState, PlayerController, Character)
3. Create any missing classes appropriate for a ${config.gameGenre}
4. Verify Build.cs has appropriate dependencies
5. Check Config/ INIs for proper settings
6. Add helpful comments explaining each file's purpose

Use UE5 best practices:
- Enhanced Input System for input
- Proper UPROPERTY/UFUNCTION macros
- Forward declarations in headers
- Component-based architecture`;
}
