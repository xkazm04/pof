import { Code, Gamepad2, Gauge, Radar, LucideIcon } from 'lucide-react';

export type SkillId = 'ue5-code' | 'game-design' | 'optimization' | 'analysis';

export interface CLISkill {
  id: SkillId;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  color: string;
  prompt: string;
}

const ue5CodeSkill: CLISkill = {
  id: 'ue5-code',
  name: 'UE5 C++ Expert',
  shortName: 'UE5',
  description: 'Unreal Engine 5 C++ development with best practices',
  icon: Code,
  color: 'blue',
  prompt: `## UE5 C++ Expert Mode

You are operating in UE5 C++ Expert mode. Apply these principles:

**UE5 Best Practices:**
- Use UPROPERTY, UFUNCTION, UCLASS macros correctly
- Follow Unreal naming conventions (F for structs, U for UObject, A for Actor, E for enum)
- Use forward declarations in headers, includes in cpp
- Prefer TArray, TMap, TSet over STL containers
- Use soft references for assets to avoid hard dependencies

**Code Architecture:**
- Separate logic into components over monolithic actors
- Use interfaces for cross-system communication
- Implement proper UCLASS specifiers (Blueprintable, BlueprintType)
- Use gameplay tags for extensible categorization

**Output:**
- Include .h and .cpp files with proper include guards
- Add UPROPERTY specifiers for editor/blueprint exposure
- Include Build.cs module dependencies when needed
`,
};

const gameDesignSkill: CLISkill = {
  id: 'game-design',
  name: 'Game Design',
  shortName: 'Design',
  description: 'Game mechanics, balance, and systems design',
  icon: Gamepad2,
  color: 'purple',
  prompt: `## Game Design Mode

You are operating in Game Design mode. Apply these principles:

**Systems Thinking:**
- Consider how systems interact and create emergent gameplay
- Design for iteration - make values data-driven via data tables
- Think about player feedback loops and progression curves

**Balance & Tuning:**
- Suggest reasonable initial values that can be tuned
- Consider edge cases and exploits
- Design with difficulty scaling in mind

**Player Experience:**
- Prioritize game feel and responsiveness
- Consider accessibility and input methods
- Design clear feedback for player actions
`,
};

const optimizationSkill: CLISkill = {
  id: 'optimization',
  name: 'Performance',
  shortName: 'Perf',
  description: 'Performance optimization and profiling',
  icon: Gauge,
  color: 'green',
  prompt: `## Performance Optimization Mode

You are operating in Performance mode. Apply these principles:

**UE5 Performance:**
- Minimize tick functions, use timers and events
- Object pooling for frequently spawned actors
- Async loading for large assets
- LOD and culling for visual content

**Memory:**
- Use weak pointers where appropriate
- Clean up delegates and timers on destroy
- Profile with Unreal Insights

**Profiling First:**
- Always suggest profiling before optimizing
- Identify bottlenecks with stat commands
- Measure before and after changes
`,
};

const analysisSkill: CLISkill = {
  id: 'analysis',
  name: 'Analysis',
  shortName: 'Analyze',
  description: 'Deep code analysis and architecture review',
  icon: Radar,
  color: 'red',
  prompt: `## Analysis Mode

You are operating in Analysis mode. Apply these principles:

**Code Review:**
- Thoroughly analyze existing codebase structure
- Map dependencies and identify coupling issues
- Look for common UE5 anti-patterns
- Check for memory leaks and dangling references

**Architecture:**
- Evaluate module boundaries and responsibilities
- Suggest refactoring opportunities
- Identify technical debt
- Consider scalability of current approach

**Output:**
- Provide clear, actionable findings
- Prioritize issues by impact
- Suggest specific code changes
`,
};

export const CLI_SKILLS: Record<SkillId, CLISkill> = {
  'ue5-code': ue5CodeSkill,
  'game-design': gameDesignSkill,
  'optimization': optimizationSkill,
  'analysis': analysisSkill,
};

export function getSkill(id: SkillId): CLISkill {
  return CLI_SKILLS[id];
}

export function getAllSkills(): CLISkill[] {
  return Object.values(CLI_SKILLS);
}

export function buildSkillsPrompt(enabledSkills: SkillId[]): string {
  if (enabledSkills.length === 0) return '';
  const prompts = enabledSkills.map((id) => CLI_SKILLS[id]?.prompt).filter(Boolean);
  if (prompts.length === 0) return '';
  return `# Active Skills\n\n${prompts.join('\n\n---\n\n')}\n\n---\n\nNow proceed with the task:\n\n`;
}
