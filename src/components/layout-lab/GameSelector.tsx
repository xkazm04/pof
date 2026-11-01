'use client';

/**
 * The ACTIVE-game selector — one compact control for the lab header and the /status header.
 *
 * A native `<select>` (the same labelled-select idiom the Matrix's catalog picker uses — the
 * browser owns keyboard, focus and screen-reader behaviour, so there is no hand-rolled
 * dropdown chrome) listing every registered game by title, plus the lab `Button` toggle that
 * reveals the game's OFF-manifest pipelines greyed ("not in <title>"). Writes go to
 * `useActiveGameStore`; `useActiveGameUrlSync` (mounted once per surface) mirrors them into
 * the URL `g` param.
 */
import { useId } from 'react';
import { GAMES } from '@/lib/games/registry';
import { GAME_IDS, type GameId } from '@/lib/games/types';
import { useActiveGame, useActiveGameStore } from '@/stores/activeGameStore';
import { Button } from './ui/Button';

export interface GameSelectorProps {
  /** Hide the "show all pipelines" toggle (a surface with no pipeline list to reveal). */
  hideShowAll?: boolean;
}

export function GameSelector({ hideShowAll = false }: GameSelectorProps) {
  const id = useId();
  const { gameId, game, showAllPipelines } = useActiveGame();
  const setGame = useActiveGameStore((s) => s.setGame);
  const setShowAll = useActiveGameStore((s) => s.setShowAllPipelines);
  // PoF's manifest is the whole registry — there is nothing off-manifest to reveal.
  const canReveal = game.manifest !== 'all';
  return (
    <div data-testid="game-selector" role="group" aria-label="Active game"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s2)', minWidth: 0 }}>
      <label htmlFor={id} style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lab-muted)' }}>
        Game
      </label>
      <select
        id={id}
        data-testid="game-select"
        value={gameId}
        onChange={(e) => setGame(e.target.value as GameId)}
        className="focus-ring"
        style={{
          minWidth: 0, maxWidth: 200, padding: 'var(--lab-s1) var(--lab-s2)',
          fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)',
          color: 'var(--lab-ink)', background: 'var(--lab-panel)',
          border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', cursor: 'pointer',
        }}
      >
        {GAME_IDS.map((g) => <option key={g} value={g}>{GAMES[g].title}</option>)}
      </select>
      {!hideShowAll && canReveal && (
        <Button
          mono
          active={showAllPipelines}
          onClick={() => setShowAll(!showAllPipelines)}
          data-testid="game-show-all"
          ariaLabel={showAllPipelines ? `Hide pipelines not in ${game.title}` : `Show all pipelines, including those not in ${game.title}`}
          title="Reveal the registered pipelines this game's manifest does not use (greyed)"
        >
          All pipelines
        </Button>
      )}
    </div>
  );
}
