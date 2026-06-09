/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Demo Fixtures                              */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  Throwaway demo data that stands in for two not-yet-real backends:  */
/*    • SAMPLE_STRINGS  — simulates a UE5 C++ source scan              */
/*    • TRANSLATION_DB  — simulates a machine-translation API          */
/*                                                                     */
/*  It lives here behind the typed accessors below (getSampleStrings / */
/*  lookupTranslation) so the scan + translation engines stay free of  */
/*  inline mock data. Swapping in real scanning / an LLM translation   */
/*  call becomes a single-file change at this clearly-labelled seam.   */
/* ------------------------------------------------------------------ */

import type { StringContext } from '@/types/localization-pipeline';

/** A simulated localizable string as if discovered in real UE5 source code. */
export interface SampleString {
  text: string;
  usage: 'hardcoded' | 'ftext_fromstring' | 'nsloctext' | 'loctext';
  codeTemplate: string;
  fileHint: string;
  contextHint: StringContext;
}

/* ------------------------------------------------------------------ */
/*  Sample source corpus (simulates scanning real UE5 code)            */
/* ------------------------------------------------------------------ */

const SAMPLE_STRINGS: SampleString[] = [
  // Abilities
  { text: 'Fireball', usage: 'ftext_fromstring', codeTemplate: 'AbilityName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Abilities/GA_Fireball.cpp', contextHint: 'ability_name' },
  { text: 'Hurl a blazing orb that deals fire damage on impact', usage: 'ftext_fromstring', codeTemplate: 'AbilityDesc = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Abilities/GA_Fireball.cpp', contextHint: 'ability_description' },
  { text: 'Ground Slam', usage: 'ftext_fromstring', codeTemplate: 'DisplayName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Abilities/GA_GroundSlam.cpp', contextHint: 'ability_name' },
  { text: 'Slam the ground dealing AoE damage and stunning enemies', usage: 'ftext_fromstring', codeTemplate: 'SetTooltip(FText::FromString(TEXT("{0}")));', fileHint: 'Source/Abilities/GA_GroundSlam.cpp', contextHint: 'ability_description' },
  { text: 'Dash Strike', usage: 'hardcoded', codeTemplate: 'FString AbilityName = TEXT("{0}");', fileHint: 'Source/Abilities/GA_DashStrike.cpp', contextHint: 'ability_name' },
  { text: 'War Cry', usage: 'ftext_fromstring', codeTemplate: 'AbilityLabel = FText::FromString("{0}");', fileHint: 'Source/Abilities/GA_WarCry.cpp', contextHint: 'ability_name' },
  { text: 'Let out a mighty war cry, buffing nearby allies', usage: 'ftext_fromstring', codeTemplate: 'AbilityDescription = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Abilities/GA_WarCry.cpp', contextHint: 'ability_description' },
  { text: 'Dodge Roll', usage: 'ftext_fromstring', codeTemplate: 'SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/Abilities/GA_DodgeRoll.cpp', contextHint: 'ability_name' },

  // Items
  { text: 'Iron Sword', usage: 'ftext_fromstring', codeTemplate: 'ItemName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Items/BaseWeapon.cpp', contextHint: 'item_name' },
  { text: 'A sturdy blade forged from iron. Reliable but unremarkable.', usage: 'ftext_fromstring', codeTemplate: 'ItemTooltip = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Items/BaseWeapon.cpp', contextHint: 'item_tooltip' },
  { text: 'Health Potion', usage: 'ftext_fromstring', codeTemplate: 'DisplayName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Items/Consumable.cpp', contextHint: 'item_name' },
  { text: 'Restores 50 Health over 5 seconds', usage: 'hardcoded', codeTemplate: 'FString Desc = TEXT("Restores ") + FString::FromInt(Amount) + TEXT(" Health over ") + FString::FromInt(Duration) + TEXT(" seconds");', fileHint: 'Source/Items/Consumable.cpp', contextHint: 'item_tooltip' },
  { text: 'Enchanted Amulet of the Phoenix', usage: 'ftext_fromstring', codeTemplate: 'ItemName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Items/Accessory.cpp', contextHint: 'item_name' },
  { text: 'Grants a second chance upon death, reviving with 30% HP', usage: 'ftext_fromstring', codeTemplate: 'SetTooltipText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/Items/Accessory.cpp', contextHint: 'item_tooltip' },

  // UI Labels
  { text: 'Inventory', usage: 'ftext_fromstring', codeTemplate: 'MenuTitle->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_InventoryMenu.cpp', contextHint: 'menu_title' },
  { text: 'Character Stats', usage: 'ftext_fromstring', codeTemplate: 'Header->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_CharacterSheet.cpp', contextHint: 'menu_title' },
  { text: 'Equip', usage: 'ftext_fromstring', codeTemplate: 'EquipButton->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_ItemContextMenu.cpp', contextHint: 'ui_button' },
  { text: 'Drop', usage: 'ftext_fromstring', codeTemplate: 'DropButton->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_ItemContextMenu.cpp', contextHint: 'ui_button' },
  { text: 'Use', usage: 'ftext_fromstring', codeTemplate: 'UseButton->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_ItemContextMenu.cpp', contextHint: 'ui_button' },
  { text: 'Confirm', usage: 'ftext_fromstring', codeTemplate: 'ConfirmBtn->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_DialogBox.cpp', contextHint: 'ui_button' },
  { text: 'Cancel', usage: 'ftext_fromstring', codeTemplate: 'CancelBtn->SetText(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_DialogBox.cpp', contextHint: 'ui_button' },

  // Quest Text
  { text: 'The Lost Relic', usage: 'ftext_fromstring', codeTemplate: 'QuestTitle = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Quests/QD_LostRelic.cpp', contextHint: 'quest_title' },
  { text: 'Recover the ancient artifact from the depths of the Sunken Temple', usage: 'ftext_fromstring', codeTemplate: 'QuestDescription = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Quests/QD_LostRelic.cpp', contextHint: 'quest_description' },
  { text: 'A New Beginning', usage: 'ftext_fromstring', codeTemplate: 'QuestName = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Quests/QD_Tutorial.cpp', contextHint: 'quest_title' },

  // Dialogue
  { text: 'Greetings, adventurer. What brings you to this forsaken land?', usage: 'ftext_fromstring', codeTemplate: 'DialogueText = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Dialogue/DT_NPCGreetings.cpp', contextHint: 'dialogue_line' },
  { text: 'The darkness grows stronger each day. We need a hero.', usage: 'ftext_fromstring', codeTemplate: 'SpeechLine = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Dialogue/DT_MainStory.cpp', contextHint: 'dialogue_line' },

  // Stats
  { text: 'Health', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },
  { text: 'Mana', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },
  { text: 'Strength', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },
  { text: 'Dexterity', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },
  { text: 'Intelligence', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },
  { text: 'Critical Hit Chance', usage: 'ftext_fromstring', codeTemplate: 'StatLabel = FText::FromString(TEXT("{0}"));', fileHint: 'Source/Attributes/ARPGAttributeSet.cpp', contextHint: 'stat_label' },

  // Notifications
  { text: 'Level Up!', usage: 'hardcoded', codeTemplate: 'NotifyText = FText::FromString(TEXT("{0}"));', fileHint: 'Source/UI/WBP_NotificationSystem.cpp', contextHint: 'notification' },
  { text: 'Quest Complete!', usage: 'ftext_fromstring', codeTemplate: 'ShowNotification(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_NotificationSystem.cpp', contextHint: 'notification' },
  { text: 'New Item Acquired', usage: 'ftext_fromstring', codeTemplate: 'ShowToast(FText::FromString(TEXT("{0}")));', fileHint: 'Source/UI/WBP_NotificationSystem.cpp', contextHint: 'notification' },
  { text: 'Not enough mana!', usage: 'hardcoded', codeTemplate: 'FString ErrMsg = TEXT("{0}");', fileHint: 'Source/Abilities/AbilitySystemComponent.cpp', contextHint: 'notification' },

  // Already-localized examples
  { text: 'Options', usage: 'nsloctext', codeTemplate: 'NSLOCTEXT("Menu", "Options", "{0}")', fileHint: 'Source/UI/WBP_MainMenu.cpp', contextHint: 'menu_title' },
  { text: 'Play', usage: 'nsloctext', codeTemplate: 'NSLOCTEXT("Menu", "Play", "{0}")', fileHint: 'Source/UI/WBP_MainMenu.cpp', contextHint: 'ui_button' },
  { text: 'Quit', usage: 'nsloctext', codeTemplate: 'NSLOCTEXT("Menu", "Quit", "{0}")', fileHint: 'Source/UI/WBP_MainMenu.cpp', contextHint: 'ui_button' },
];

/* ------------------------------------------------------------------ */
/*  Simulated machine-translation database                             */
/*  (In production, this is replaced by an LLM / MT API call)          */
/* ------------------------------------------------------------------ */

const TRANSLATION_DB: Record<string, string> = {
  // German (de)
  'Fireball:de': 'Feuerball',
  'Hurl a blazing orb that deals fire damage on impact:de': 'Schleuder eine lodernde Kugel, die bei Einschlag Feuerschaden verursacht',
  'Ground Slam:de': 'Erderschütterung',
  'Slam the ground dealing AoE damage and stunning enemies:de': 'Schlage auf den Boden und verursache Flächenschaden, der Feinde betäubt',
  'Dash Strike:de': 'Sturmangriff',
  'War Cry:de': 'Kriegsruf',
  'Let out a mighty war cry, buffing nearby allies:de': 'Stoße einen mächtigen Kriegsruf aus, der nahe Verbündete stärkt',
  'Dodge Roll:de': 'Ausweichrolle',
  'Iron Sword:de': 'Eisenschwert',
  'A sturdy blade forged from iron. Reliable but unremarkable.:de': 'Eine robuste, aus Eisen geschmiedete Klinge. Zuverlässig, aber unscheinbar.',
  'Health Potion:de': 'Heiltrank',
  'Restores 50 Health over 5 seconds:de': 'Stellt 50 Gesundheit über 5 Sekunden wieder her',
  'Enchanted Amulet of the Phoenix:de': 'Verzaubertes Amulett des Phönix',
  'Grants a second chance upon death, reviving with 30% HP:de': 'Gewährt beim Tod eine zweite Chance und belebt mit 30% LP wieder',
  'Inventory:de': 'Inventar',
  'Character Stats:de': 'Charakterwerte',
  'Equip:de': 'Ausrüsten',
  'Drop:de': 'Ablegen',
  'Use:de': 'Benutzen',
  'Confirm:de': 'Bestätigen',
  'Cancel:de': 'Abbrechen',
  'The Lost Relic:de': 'Das verlorene Relikt',
  'Recover the ancient artifact from the depths of the Sunken Temple:de': 'Berge das antike Artefakt aus den Tiefen des Versunkenen Tempels',
  'A New Beginning:de': 'Ein neuer Anfang',
  'Greetings, adventurer. What brings you to this forsaken land?:de': 'Seid gegrüßt, Abenteurer. Was führt Euch in dieses verwunschene Land?',
  'The darkness grows stronger each day. We need a hero.:de': 'Die Dunkelheit wird jeden Tag stärker. Wir brauchen einen Helden.',
  'Health:de': 'Gesundheit',
  'Mana:de': 'Mana',
  'Strength:de': 'Stärke',
  'Dexterity:de': 'Geschick',
  'Intelligence:de': 'Intelligenz',
  'Critical Hit Chance:de': 'Kritische Trefferchance',
  'Level Up!:de': 'Aufstieg!',
  'Quest Complete!:de': 'Quest abgeschlossen!',
  'New Item Acquired:de': 'Neuer Gegenstand erhalten',
  'Not enough mana!:de': 'Nicht genug Mana!',

  // French (fr)
  'Fireball:fr': 'Boule de Feu',
  'Hurl a blazing orb that deals fire damage on impact:fr': 'Lance un orbe ardent qui inflige des dégâts de feu à l\'impact',
  'Ground Slam:fr': 'Fracas du Sol',
  'Dash Strike:fr': 'Frappe Éclair',
  'War Cry:fr': 'Cri de Guerre',
  'Dodge Roll:fr': 'Roulade d\'Esquive',
  'Iron Sword:fr': 'Épée de Fer',
  'Health Potion:fr': 'Potion de Soin',
  'Inventory:fr': 'Inventaire',
  'Character Stats:fr': 'Statistiques du Personnage',
  'Equip:fr': 'Équiper',
  'Drop:fr': 'Jeter',
  'Use:fr': 'Utiliser',
  'Confirm:fr': 'Confirmer',
  'Cancel:fr': 'Annuler',
  'The Lost Relic:fr': 'La Relique Perdue',
  'A New Beginning:fr': 'Un Nouveau Départ',
  'Health:fr': 'Santé',
  'Mana:fr': 'Mana',
  'Strength:fr': 'Force',
  'Dexterity:fr': 'Dextérité',
  'Intelligence:fr': 'Intelligence',
  'Level Up!:fr': 'Niveau Supérieur !',
  'Quest Complete!:fr': 'Quête Terminée !',
  'Not enough mana!:fr': 'Pas assez de mana !',

  // Spanish (es)
  'Fireball:es': 'Bola de Fuego',
  'Ground Slam:es': 'Golpe Sísmico',
  'Dash Strike:es': 'Embestida Veloz',
  'War Cry:es': 'Grito de Guerra',
  'Dodge Roll:es': 'Rodada Evasiva',
  'Iron Sword:es': 'Espada de Hierro',
  'Health Potion:es': 'Poción de Salud',
  'Inventory:es': 'Inventario',
  'Equip:es': 'Equipar',
  'Drop:es': 'Soltar',
  'Use:es': 'Usar',
  'Confirm:es': 'Confirmar',
  'Cancel:es': 'Cancelar',
  'Health:es': 'Salud',
  'Mana:es': 'Maná',
  'Strength:es': 'Fuerza',
  'Level Up!:es': '¡Subida de Nivel!',
  'Not enough mana!:es': '¡No hay suficiente maná!',

  // Japanese (ja)
  'Fireball:ja': 'ファイアボール',
  'Ground Slam:ja': 'グランドスラム',
  'Dash Strike:ja': 'ダッシュストライク',
  'War Cry:ja': '鬨の声',
  'Dodge Roll:ja': '回避ロール',
  'Iron Sword:ja': '鉄の剣',
  'Health Potion:ja': '回復薬',
  'Inventory:ja': 'インベントリ',
  'Equip:ja': '装備',
  'Drop:ja': '捨てる',
  'Use:ja': '使用',
  'Confirm:ja': '確認',
  'Cancel:ja': 'キャンセル',
  'Health:ja': '体力',
  'Mana:ja': 'マナ',
  'Strength:ja': '筋力',
  'Dexterity:ja': '器用さ',
  'Intelligence:ja': '知力',
  'Level Up!:ja': 'レベルアップ！',
  'Not enough mana!:ja': 'マナが足りない！',

  // Simplified Chinese (zh-Hans)
  'Fireball:zh-Hans': '火球术',
  'Ground Slam:zh-Hans': '地裂斩',
  'War Cry:zh-Hans': '战吼',
  'Iron Sword:zh-Hans': '铁剑',
  'Health Potion:zh-Hans': '生命药水',
  'Inventory:zh-Hans': '背包',
  'Equip:zh-Hans': '装备',
  'Health:zh-Hans': '生命值',
  'Mana:zh-Hans': '魔力',
  'Strength:zh-Hans': '力量',
  'Level Up!:zh-Hans': '升级！',
};

/* ------------------------------------------------------------------ */
/*  Typed accessors (the single seam the engines depend on)            */
/* ------------------------------------------------------------------ */

/** The demo corpus of localizable strings, as if returned by a UE5 source scan. */
export function getSampleStrings(): SampleString[] {
  return SAMPLE_STRINGS;
}

/**
 * Look up a simulated machine translation for a source string in a target
 * locale. Returns `undefined` when no canned translation exists (the engine
 * then falls back to an auto-generated placeholder).
 */
export function lookupTranslation(sourceText: string, locale: string): string | undefined {
  return TRANSLATION_DB[`${sourceText}:${locale}`];
}
