#!/usr/bin/env node
/**
 * Patches expo-router context files to hardcode the app directory path.
 * EXPO_ROUTER_APP_ROOT env var is not resolved at bundler time in this env.
 */
const fs   = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'node_modules', 'expo-router');

const patches = [
  {
    file: '_ctx.web.js',
    content: `export const ctx = require.context(\n  "../../app",\n  true,\n  /^(?:\\.\\/)(${''
    }?!(?:(?:(?:.*\\+api)|(?:\\+html)|(?:\\+middleware)))\\.[tj]sx?$).*(?:\\.ios|\\.android)?\\.${''
    }[tj]sx?$/\n);\n`,
  },
  {
    file: '_ctx.android.js',
    content: `export const ctx = require.context(\n  "../../app",\n  true,\n  /^(?:\\.\\/)(${''
    }?!(?:(?:(?:.*\\+api)|(?:\\+html)|(?:\\+middleware)))\\.[tj]sx?$).*(?:\\.ios|\\.web)?\\.${''
    }[tj]sx?$/\n);\n`,
  },
  {
    file: '_ctx.ios.js',
    content: `export const ctx = require.context(\n  "../../app",\n  true,\n  /^(?:\\.\\/)(${''
    }?!(?:(?:(?:.*\\+api)|(?:\\+html)|(?:\\+middleware)))\\.[tj]sx?$).*(?:\\.android|\\.web)?\\.${''
    }[tj]sx?$/\n);\n`,
  },
];

for (const { file, content } of patches) {
  const fullPath = path.join(base, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`[patch-expo-router] skip (not found): ${file}`);
    continue;
  }
  const current = fs.readFileSync(fullPath, 'utf8');
  if (current.includes('process.env.EXPO_ROUTER_APP_ROOT')) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-expo-router] patched: ${file}`);
  } else {
    console.log(`[patch-expo-router] already patched: ${file}`);
  }
}
