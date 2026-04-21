import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { SCENE_FRAMES, COLORS } from './constants'
import { SceneHook } from './scenes/SceneHook'
import { SceneSolution } from './scenes/SceneSolution'
import { SceneSetup } from './scenes/SceneSetup'
import { SceneAgent } from './scenes/SceneAgent'
import { SceneResults } from './scenes/SceneResults'
import { SceneCta } from './scenes/SceneCta'

/**
 * ActeroDemo — composition maîtresse.
 *
 * Les scènes sont orchestrées via <Series> → chaque scène voit son frame
 * remis à 0 au début de sa sequence, donc les animations à l'intérieur
 * de chaque scène utilisent `useCurrentFrame()` sans offset.
 *
 * Background global cream — les scènes peuvent override (CTA passe en
 * dark forest) via leur propre wrapper full-bleed.
 */
export const ActeroDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <Series>
        <Series.Sequence durationInFrames={SCENE_FRAMES.hook}>
          <SceneHook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.solution}>
          <SceneSolution />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.setup}>
          <SceneSetup />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.agent}>
          <SceneAgent />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.results}>
          <SceneResults />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.cta}>
          <SceneCta />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}
