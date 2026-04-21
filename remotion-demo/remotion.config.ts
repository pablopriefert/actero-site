import { Config } from '@remotion/cli/config'
import { enableTailwind } from '@remotion/tailwind-v4'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.overrideWebpackConfig((config) => enableTailwind(config))
// High-quality preset for final renders
Config.setCrf(18)
