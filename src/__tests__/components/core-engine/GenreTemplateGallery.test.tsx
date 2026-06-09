import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import { GenreTemplateGallery } from '@/components/modules/core-engine/GenreTemplateGallery';
import { useGenomeStore } from '@/stores/genomeStore';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';
import { GENRE_GENOME_TEMPLATES } from '@/lib/genome/genre-genome-templates';
import { BASED_ON_TAG_PREFIX } from '@/lib/genome/archetype-templates';

afterEach(() => cleanup());

beforeEach(() => {
  globalThis.localStorage.clear();
  useGenomeStore.getState().resetToPresets();
  useItemGenomeStore.getState().resetToPresets();
});

describe('<GenreTemplateGallery />', () => {
  it('renders the curated character and item templates for the sub-genre', () => {
    const set = GENRE_GENOME_TEMPLATES['souls-like'];
    const { getByText, getByLabelText } = render(
      <GenreTemplateGallery subGenre="souls-like" accentColor="#ef4444" />,
    );
    expect(getByText(set.characters[0].name)).toBeTruthy();
    expect(getByText(set.items[0].name)).toBeTruthy();
    expect(getByLabelText(/Import .* character archetype/i)).toBeTruthy();
    expect(getByLabelText(/Import .* weapon genome/i)).toBeTruthy();
  });

  it('imports the character archetype into the genome store with a lineage tag', () => {
    const template = GENRE_GENOME_TEMPLATES['souls-like'].characters[0];
    const before = useGenomeStore.getState().genomes.length;

    const { getByLabelText } = render(
      <GenreTemplateGallery subGenre="souls-like" accentColor="#ef4444" />,
    );
    fireEvent.click(getByLabelText(/character archetype/i));

    const state = useGenomeStore.getState();
    expect(state.genomes).toHaveLength(before + 1);
    const added = state.genomes[state.genomes.length - 1];
    expect(added.name).toBe(template.name);
    expect(added.tags).toContain(`${BASED_ON_TAG_PREFIX}${template.id}`);
    // the imported genome becomes the active one, ready to edit
    expect(state.activeId).toBe(added.id);
  });

  it('imports the weapon genome into the item store with a fresh id', () => {
    const template = GENRE_GENOME_TEMPLATES['diablo-like'].items[0];
    const before = useItemGenomeStore.getState().genomes.length;

    const { getByLabelText } = render(
      <GenreTemplateGallery subGenre="diablo-like" accentColor="#c084fc" />,
    );
    fireEvent.click(getByLabelText(/weapon genome/i));

    const state = useItemGenomeStore.getState();
    expect(state.genomes).toHaveLength(before + 1);
    const added = state.genomes[state.genomes.length - 1];
    expect(added.name).toBe(template.name);
    expect(added.id).toBeTruthy();
    expect(added.traits).toHaveLength(4);
    expect(state.selectedId).toBe(added.id);
  });

  it('shows imported feedback and lets the user import again', () => {
    const { getByLabelText, getByText } = render(
      <GenreTemplateGallery subGenre="character-action" accentColor="#60a5fa" />,
    );
    const charBtn = getByLabelText(/character archetype/i);

    fireEvent.click(charBtn);
    expect(getByText(/Added — import again/i)).toBeTruthy();

    // a second click adds a second, independent genome
    const before = useGenomeStore.getState().genomes.length;
    fireEvent.click(charBtn);
    expect(useGenomeStore.getState().genomes.length).toBe(before + 1);
    const all = useGenomeStore.getState().genomes;
    expect(all[all.length - 1].id).not.toBe(all[all.length - 2].id);
  });

  it('renders nothing for an unknown sub-genre', () => {
    const { container } = render(
      // @ts-expect-error — exercising the defensive guard for an unmapped id
      <GenreTemplateGallery subGenre="not-a-genre" accentColor="#fff" />,
    );
    expect(within(container).queryByText(/Genome Templates/i)).toBeNull();
  });
});
