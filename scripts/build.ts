import fs from 'node:fs/promises'
import path from 'node:path'
import lucideFontJson from 'lucide-static/font/info.json'
import { set } from './set'

const NAME = 'lucide-icons'

// Transform the icon mappings from the set configuration into a processable format
const icons = Object.entries(set.icons).map(([codiconId, lucideId]) => {
	// Use the original codicon ID if no Lucide mapping exists
	const mappedLucideId = lucideId || codiconId

	// Remove the 'codicon:' prefix from the identifier
	const cleanCodiconId = codiconId.replace('codicon:', '')

	// Extract just the icon name from the Lucide identifier (after the ':')
	const [, lucideIconName] = mappedLucideId.split(':')

	// Return tuple of [cleaned codicon ID, Lucide icon name]
	return [cleanCodiconId, lucideIconName]
})

const iconDefinitions = {}
const unicodeMap = lucideFontJson as {
	[key: string]: {
		encodedCode: string
		prefix: string
		className: string
		unicode: string
	}
}

// Create mapping of unicode characters for our icons
for (const [k, name] of icons) {
	if (unicodeMap[name]) {
		Object.assign(iconDefinitions, {
			[k]: {
				fontCharacter: unicodeMap[name].encodedCode,
			},
		})
	}
}

await fs.copyFile(
	path.join('node_modules', 'lucide-static', 'font', 'lucide.woff'),
	path.join('dist', 'lucide-icons.woff'),
)

// Write the JSON configuration
await fs.writeFile(
	path.join('dist', `${NAME}.json`),
	JSON.stringify({
		fonts: [
			{
				id: NAME,
				src: [
					{
						path: `./${NAME}.woff`,
						format: 'woff',
					},
				],
				weight: 'normal',
				style: 'normal',
			},
		],
		iconDefinitions,
	}),
)
