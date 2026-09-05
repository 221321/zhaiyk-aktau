#!/usr/bin/env node
// Компилирует public/src/app.jsx (исходник интерфейса, редактируется руками)
// в public/app.js (обычный JS, без JSX) — чтобы браузер не гонял babel-standalone
// на каждом открытии приложения. Индекс подключает только public/app.js.
//
// Запускать после любой правки public/src/app.jsx: npm run build

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const srcPath = path.join(__dirname, '..', 'public', 'src', 'app.jsx');
const outPath = path.join(__dirname, '..', 'public', 'app.js');

const source = fs.readFileSync(srcPath, 'utf8');

const result = babel.transformSync(source, {
  filename: srcPath,
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  babelrc: false,
  configFile: false,
});

fs.writeFileSync(outPath, result.code + '\n');
console.log(`Собрано: ${srcPath} -> ${outPath} (${result.code.length} байт)`);
