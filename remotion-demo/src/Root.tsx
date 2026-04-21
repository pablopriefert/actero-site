import React from 'react'
import { Composition } from 'remotion'
import { ActeroDemo } from './ActeroDemo/Composition'
import { DURATION_FRAMES, FPS, WIDTH, HEIGHT } from './ActeroDemo/constants'
import { loadFonts } from './ActeroDemo/fonts'

loadFonts()

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ActeroDemo"
        component={ActeroDemo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  )
}
