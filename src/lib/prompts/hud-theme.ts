import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import { GENERATE_ALL_DIRECTLY } from '@/lib/prompts/_shared';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import type { ThemeChange } from '@/components/modules/content/ui-hud/HudThemeEditor/themeDiff';

/**
 * "Apply to project" for the HUD Theme Editor: set exactly the UPROPERTY defaults
 * that changed since the last successful apply (diffThemeExport), widget by widget,
 * then build. Unchanged values are never named, so the run cannot touch them.
 */
export function buildHudThemeApplyPrompt(changes: readonly ThemeChange[], ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    ...moduleKnowledge('ui-hud'),
    extraRules: [
      GENERATE_ALL_DIRECTLY,
      'Change ONLY the UPROPERTY defaults listed under "Changes". Do not touch any other property, function or file.',
    ],
  });

  const byWidget = new Map<string, ThemeChange[]>();
  for (const c of changes) {
    const list = byWidget.get(c.widget) ?? [];
    list.push(c);
    byWidget.set(c.widget, list);
  }

  const widgetSections = [...byWidget.entries()].map(([widget, list]) => {
    const rows = list.map((c) => [
      `- **${c.name}** (Category = "${c.category}")`,
      `  - last applied by PoF: ${c.from ? `\`${c.from}\`` : '(never)'}`,
      `  - set: \`${c.to}\``,
    ].join('\n'));
    return `### U${widget}\n${rows.join('\n')}`;
  }).join('\n\n');

  return `${header}

## Task: Apply HUD Theme Changes to the Project

The HUD Theme Editor changed ${changes.length} UPROPERTY default${changes.length === 1 ? '' : 's'} since the last successful apply. Write exactly these values into the project's C++ widget classes.

## Changes
${widgetSections}

## Instructions
1. Find each widget class under Source/${moduleName}/ (search for \`class\` declarations of the class names above). If a class does not exist yet, create it under Source/${moduleName}/UI/ as a UUserWidget subclass.
2. For each listed property, set its default to the value on the "set" line. Declare it in the header (\`UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "<Category>")\`) only if it is missing. If the class initialises it in the constructor instead, update that assignment.
3. Leave every property that is not listed unchanged.
4. Build with the build command above and fix any error you introduced.

## Success Criteria
- Each listed property's default equals the value on its "set" line.
- No other property default changed.
- The project builds.`;
}
