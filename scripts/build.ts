import fs from 'fs-extra';
import json from 'lucide-static/font/info.json';
import pkg from '../package.json';
import { set } from './set';

const NAME = 'lucide-icons';
const DISPLAY_NAME = 'Lucide';

async function theme() {
  const icons = Object.entries(set.icons).map(([k, v]) => {
    v = v || k;
    k = k.replace('codicon:', '');
    const [_id, name] = v.split(':');
    return [k, name];
  });

  const iconDefinitions = {};
  const unicodeMap = json as {
    [key: string]: {
      encodedCode: string;
      prefix: string;
      className: string;
      unicode: string;
    };
  };

  for (const [k, name] of icons) {
    if (unicodeMap[name]) {
      Object.assign(iconDefinitions, {
        [k]: {
          fontCharacter: unicodeMap[name].encodedCode,
        },
      });
    }
  }

  fs.copyFileSync(
    `node_modules/lucide-static/font/lucide.woff`,
    `theme/${NAME}.woff`,
  );

  fs.writeJSONSync(
    `theme/${NAME}.json`,
    {
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
    },
    { spaces: 2 },
  );

  fs.writeJSONSync(
    'theme/package.json',
    {
      publisher: pkg.publisher,
      name: NAME,
      displayName: `${DISPLAY_NAME} Product Icons`,
      version: pkg.version,
      description: `${DISPLAY_NAME} Product Icons for VS Code`,
      author: {
        name: 'Tony Zhang',
      },
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/ZTL-UwU/vscode-lucide-icons.git',
      },
      bugs: {
        url: 'https://github.com/ZTL-UwU/vscode-lucide-icons/issues',
      },
      keywords: ['icon', 'theme', 'product', 'product-icon-theme'],
      categories: ['Themes'],
      icon: 'icon.png',
      engines: {
        vscode: pkg.engines.vscode,
      },
      extensionKind: ['ui'],
      contributes: {
        productIconThemes: [
          {
            id: DISPLAY_NAME,
            label: `${DISPLAY_NAME} Icons`,
            path: `./${NAME}.json`,
          },
        ],
      },
    },
    { spaces: 2 },
  );

  fs.copySync('README.md', 'theme/README.md');
  fs.copySync('icon.png', 'theme/icon.png');
  fs.copySync('LICENSE', 'theme/LICENSE');
}

theme();
