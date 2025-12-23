import { createReadStream, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont'
import svg2ttf from 'svg2ttf'
import ttf2woff from 'ttf2woff'
import SVGFixer from 'oslllo-svg-fixer'

import { set } from './set.ts'

const FONT_NAME = 'lucide-icons'
const OUTPUT_DIR = path.resolve('./dist')
const TEMP_DIR = path.resolve('./.temp')
const ICONS_DIR = path.resolve('node_modules', 'lucide-static', 'icons')

//#region Types
type GlyphName = string // e.g. "debug"
type LucideIconName = string // e.g. "bug"

/**
 * A tuple representing a mapping between:
 * - `glyphName`: The cleaned codicon identifier (used as glyph name in the font)
 * - `lucideIconName`: The Lucide icon name (without extension), used to locate the SVG
 */
type IconDefinitionPair = [glyphName: GlyphName, lucideIconName: LucideIconName]
//#endregion

/** Mapping of glyph name to its icon definition for VS Code */
const iconDefinitions: Record<string, { fontCharacter: string }> = {}

/**
 * Prepare the output and temp directories.
 */
function prepareDirectories(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
  }
  process.on('exit', () => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true })
    }
  })
}

/**
 * Converts the icon set mappings to an internal array of tuples.
 * Removes 'codicon:' prefix and resolves fallback mapping if needed.
 */
function parseIconMappings(): IconDefinitionPair[] {
  return Object.entries(set.icons).map(([codiconId, lucideId]) => {
    const cleanCodiconId = codiconId.replace(/^codicon:/, '')
    const mappedLucideId = lucideId || codiconId
    const [, lucideIconName] = mappedLucideId.split(':')
    return [cleanCodiconId, lucideIconName]
  }) as unknown as IconDefinitionPair[]
}

/**
 * Fixes SVG icons using oslllo-svg-fixer and returns only valid fixed icons.
 */
async function fixSVGs(icons: IconDefinitionPair[]): Promise<IconDefinitionPair[]> {
  console.log('Fixing SVGs...')

  const tasks = icons.map(async ([glyphName, lucideIconName]) => {
    const svgPath = path.resolve(ICONS_DIR, `${lucideIconName}.svg`)

    if (!existsSync(svgPath)) {
      console.warn(`⚠️  Icon not found: ${lucideIconName}, skipping...`)
      return null
    }

    await SVGFixer(svgPath, TEMP_DIR).fix()
    return [glyphName, lucideIconName]
  })

  const results = await Promise.all(tasks)
  const fixedIcons = results.filter((r): r is IconDefinitionPair => r !== null)

  console.log(`✅ Fixed ${fixedIcons.length} icons`)
  return fixedIcons
}

/**
 * Generates the SVG font from fixed SVGs and returns the SVG content as string.
 */
async function generateSVGFontFrom(fixedIcons: IconDefinitionPair[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const fontStream = new SVGIcons2SVGFontStream({
      fontName: FONT_NAME,
      normalize: true,
      fontHeight: 1000,
    })

    const chunks: string[] = []
    fontStream.on('data', (chunk) => chunks.push(chunk.toString()))
    fontStream.on('finish', () => {
      const svgFontContent = chunks.join('')
      console.log(`✅ Generated ${FONT_NAME}.svg`)

      resolve(svgFontContent)
    })

    fontStream.on('error', (err) => {
      console.error('❌ Font generation failed:', err)
      reject(err)
    })

    let unicodeCode = 0xe000

    for (const [glyphName, lucideIconName] of fixedIcons) {
      const svgPath = path.resolve(TEMP_DIR, `${lucideIconName}.svg`)
      const glyph = createReadStream(svgPath)

      // @ts-expect-error
      glyph.metadata = {
        unicode: [String.fromCharCode(unicodeCode)],
        name: glyphName,
      }

      fontStream.write(glyph)

      iconDefinitions[glyphName] = {
        fontCharacter: `\\${unicodeCode.toString(16).toUpperCase()}`,
      }

      unicodeCode++
    }

    fontStream.end()
  })
}

/**
 * Converts SVG font string to WOFF and writes it to disk.
 */
function convertFonts(svgFont: string): void {
  const ttf = svg2ttf(svgFont, {})
  console.log(`✅ Generated ${FONT_NAME}.ttf (in memory)`)

  const woff = ttf2woff(ttf.buffer)
  const woffPath = path.resolve(OUTPUT_DIR, `${FONT_NAME}.woff`)
  writeFileSync(woffPath, Buffer.from(woff.buffer))
  console.log(`✅ Generated ${FONT_NAME}.woff`)
}

/**
 * Writes VS Code icon configuration JSON based on icon definitions.
 */
async function writeVSCodeIconConfig(fixedIcons: IconDefinitionPair[]): Promise<void> {
  const iconConfig = {
    fonts: [
      {
        id: FONT_NAME,
        src: [{ path: `./${FONT_NAME}.woff`, format: 'woff' }],
        weight: 'normal',
        style: 'normal',
      },
    ],
    iconDefinitions,
  }

  const jsonPath = path.resolve(OUTPUT_DIR, `${FONT_NAME}.json`)
  writeFileSync(jsonPath, JSON.stringify(iconConfig))
  console.log(`✅ Generated ${FONT_NAME}.json with ${fixedIcons.length} icon definitions`)
}

async function main(): Promise<void> {
  console.log('🚀 Starting build...')

  prepareDirectories()

  const iconsDefinitions = parseIconMappings()
  console.log(`📦 Building font with ${iconsDefinitions.length} icons...`)

  const fixedIconsDefinitions = await fixSVGs(iconsDefinitions)

  const svgFont = await generateSVGFontFrom(fixedIconsDefinitions)

  await Promise.all([writeVSCodeIconConfig(fixedIconsDefinitions), convertFonts(svgFont)])

  console.log('🎉 Build completed successfully!')
}

main().catch((err) => {
  console.error('❌ Build failed:', err)
  process.exit(1)
})
