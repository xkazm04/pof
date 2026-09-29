/**
 * Overwrite review — what a whole-file "Write to Project" DELETES, in UE vocabulary.
 *
 * Standard: ai-registry `game-production/visual-script-to-code-transpilation`,
 * "structural round-trip diff": diffing the TEXT reports noise on equivalent
 * files and hides membership changes. The review compares declared members
 * (UPROPERTY / UFUNCTION by name + specifier names) and `<Class>::` definitions,
 * never line positions.
 */
import { describe, it, expect } from 'vitest';
import { parseBlueprintJson } from '@/lib/blueprint-parser';
import { generateCppFromBlueprint } from '@/lib/blueprint-cpp-codegen';
import { diffPrompts } from '@/lib/text-diff';
import { SAMPLE_BLUEPRINT } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/constants';
import {
  reviewOverwrite, overwriteConfirmGate, buildOverwriteMergePrompt, type OverwriteReview,
} from '@/lib/blueprint-transpiler/overwrite-review';

const gen = generateCppFromBlueprint(parseBlueprintJson(SAMPLE_BLUEPRINT), 'MyGame', 'MyGame');
const GEN_H = gen.headerCode;
const GEN_CPP = gen.sourceCode;
const CLS = gen.className;

/** GEN_H plus two members an engineer hand-added after a first write. */
const HAND_H = GEN_H.replace(
  /(\n\tUFUNCTION\(BlueprintCallable)/,
  '\n\tUPROPERTY(ReplicatedUsing = OnRep_Ammo)\n\tint32 Ammo;\n\n\tUFUNCTION(Server, Reliable)\n\tvoid ServerFire(FVector Aim);\n$1',
);

describe('reviewOverwrite — membership, not location', () => {
  it('a file that does not exist yet loses nothing: verdict new-file', () => {
    const r = reviewOverwrite({ before: '', after: GEN_H }, { before: '', after: GEN_CPP }, 'ABP_Hero');
    expect(r).toMatchObject({ verdict: 'new-file', lost: [], changed: [], lostDefinitions: [] });
  });

  it('names the hand-added UPROPERTY and UFUNCTION an overwrite deletes (the text diff only says +0 / -6)', () => {
    expect(HAND_H).not.toBe(GEN_H);
    expect(diffPrompts(HAND_H, GEN_H).summary).toMatchObject({ added: 0, removed: 6 });
    const r = reviewOverwrite({ before: HAND_H, after: GEN_H }, { before: GEN_CPP, after: GEN_CPP }, CLS);
    expect(r.verdict).toBe('loses-members');
    expect(r.lost).toMatchObject([
      { kind: 'property', name: 'Ammo' },
      { kind: 'function', name: 'ServerFire', signature: 'void ServerFire(FVector Aim)' },
    ]);
    expect(r.lost[0].specifiers.join(' ')).toMatch(/ReplicatedUsing/);
    expect(r.changed).toEqual([]);
    expect(r.lostDefinitions).toEqual([]);
  });

  it('reordered UPROPERTY blocks and added comments are not a loss, even though the line diff removes lines', () => {
    const blocks = [
      '\t/** Current health points */\n\tUPROPERTY(EditAnywhere, BlueprintReadWrite)\n\tfloat Health = 100.0;\n',
      '\tUPROPERTY(EditAnywhere, BlueprintReadWrite)\n\tfloat MaxHealth = 100.0;\n',
      '\tUPROPERTY(EditAnywhere, BlueprintReadWrite)\n\tfloat MoveSpeed = 600.0;\n',
      '\tUPROPERTY(BlueprintReadWrite)\n\tbool bIsDead = false;\n',
    ];
    for (const b of blocks) expect(GEN_H).toContain(b);
    const joined = blocks.join('\n');
    const reordered = [blocks[3], blocks[1], blocks[0], blocks[2]]
      .map((b, i) => `\t// hand note ${i}\n${b}`).join('\n');
    const before = GEN_H.replace(joined, reordered);
    expect(before).not.toBe(GEN_H);
    expect(diffPrompts(before, GEN_H).summary.removed).toBeGreaterThan(0);

    const r = reviewOverwrite({ before, after: GEN_H }, { before: GEN_CPP, after: GEN_CPP }, CLS);
    expect(r.verdict).toBe('no-loss');
    expect(r.lost).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it('a surviving member that loses a specifier is a changed member (ReplicatedUsing dropped)', () => {
    const wrap = (decl: string) => `UCLASS()\nclass MYGAME_API AHero : public ACharacter\n{\n\tGENERATED_BODY()\npublic:\n\t${decl}\n};\n`;
    const r = reviewOverwrite(
      { before: wrap('UPROPERTY(ReplicatedUsing = OnRep_Health)\n\tfloat Health;'), after: wrap('UPROPERTY(EditAnywhere)\n\tfloat Health;') },
      { before: '', after: '' },
      'AHero',
    );
    expect(r.changed).toMatchObject([{ name: 'Health', droppedSpecifiers: ['ReplicatedUsing'] }]);
    expect(r.lost).toEqual([]);
    expect(r.verdict).toBe('loses-members');
  });

  it('names the .cpp definitions the overwrite deletes (qualified names, calls excluded)', () => {
    const genCpp = '#include "AHero.h"\n\nAHero::AHero()\n{\n}\n\nvoid AHero::BeginPlay()\n{\n\tSuper::BeginPlay();\n}\n';
    const handCpp = `${genCpp}
int32 AHero::Helper(int32 X) const
{
\treturn X + AHero::StaticValue();
}

void AHero::ServerFire_Implementation(FVector Aim)
{
\tHelper(1);
}
// void AHero::Commented() {}
`;
    const r = reviewOverwrite({ before: '', after: '' }, { before: handCpp, after: genCpp }, 'AHero');
    expect(r.lostDefinitions).toEqual(['Helper', 'ServerFire_Implementation']);
    expect(r.verdict).toBe('loses-members');
  });

  it('a class name carrying regex metacharacters is matched literally, never as a pattern', () => {
    const cpp = 'void A.Hero::Fn()\n{\n}\nvoid AxHero::Other()\n{\n}\n';
    const r = reviewOverwrite({ before: '', after: '' }, { before: cpp, after: '' }, 'A.Hero');
    expect(r.lostDefinitions).toEqual(['Fn']);
  });
});

describe('overwriteConfirmGate — a loss needs an explicit acknowledgement', () => {
  const lossy = reviewOverwrite({ before: HAND_H, after: GEN_H }, { before: GEN_CPP, after: GEN_CPP }, CLS);
  const fresh = reviewOverwrite({ before: '', after: GEN_H }, { before: '', after: GEN_CPP }, CLS);
  const same = reviewOverwrite({ before: GEN_H, after: GEN_H }, { before: GEN_CPP, after: GEN_CPP }, CLS);

  it('loses-members needs the ack; with it, confirm', () => {
    expect(overwriteConfirmGate(lossy, false)).toBe('needs-ack');
    expect(overwriteConfirmGate(lossy, true)).toBe('confirm');
  });

  it('new-file and no-loss confirm without an ack', () => {
    expect(fresh.verdict).toBe('new-file');
    expect(same.verdict).toBe('no-loss');
    for (const r of [fresh, same]) {
      expect(overwriteConfirmGate(r, false)).toBe('confirm');
      expect(overwriteConfirmGate(r, true)).toBe('confirm');
    }
  });
});

describe('buildOverwriteMergePrompt — the keep-list travels whole', () => {
  it('carries every lost signature, both paths, the generated code and the keep instruction', () => {
    const handCpp = `${GEN_CPP}\nvoid ${CLS}::Helper()\n{\n}\n`;
    const review: OverwriteReview = reviewOverwrite({ before: HAND_H, after: GEN_H }, { before: handCpp, after: GEN_CPP }, CLS);
    expect(review.lost.length).toBe(2);
    const relPaths = { header: `Source/MyGame/${CLS}.h`, source: `Source/MyGame/${CLS}.cpp` };
    const prompt = buildOverwriteMergePrompt(review, { className: CLS, moduleName: 'MyGame', relPaths, header: GEN_H, source: GEN_CPP });

    for (const m of review.lost) expect(prompt).toContain(m.signature);
    expect(prompt).toContain('ReplicatedUsing = OnRep_Ammo');
    expect(prompt).toContain('Helper');
    expect(prompt).toContain(relPaths.header);
    expect(prompt).toContain(relPaths.source);
    expect(prompt).toContain(GEN_H.trim());
    expect(prompt).toContain(GEN_CPP.trim());
    expect(prompt).toMatch(/keep/i);
    expect(prompt).toMatch(/do not (delete|remove)/i);
  });
});
