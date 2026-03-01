import fs from 'fs';

const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// The goal is to invert colors for a dark mode.
// We will apply these replacements globally in App.jsx

const replacements = [
    // Backgrounds
    { from: /bg-white/g, to: 'bg-[#0a0a0a]' },
    { from: /bg-\[#FAFAFA\]/g, to: 'bg-[#030303]' },
    { from: /bg-gray-50(?!0)/g, to: 'bg-white/5' },
    { from: /bg-gray-100/g, to: 'bg-white/10' },
    { from: /bg-[#F6F7FB]/g, to: 'bg-[#0a0a0a]' },
    // Text colors (general content)
    { from: /text-gray-900/g, to: 'text-white' },
    { from: /text-zinc-900/g, to: 'text-white' },
    { from: /text-gray-800/g, to: 'text-gray-200' },
    { from: /text-gray-700/g, to: 'text-gray-300' },
    { from: /text-gray-600/g, to: 'text-gray-400' },
    { from: /text-gray-500/g, to: 'text-gray-400' },
    { from: /text-zinc-500/g, to: 'text-zinc-400' },
    { from: /text-white/g, to: 'text-[[#0a0a0a]]' }, // We first map normal text-white to dark dynamically. Wait, text-white is used inside buttons where bg is indigo-600 or zinc-900.
    // Actually, mapping `text-white` to black globally might break colored buttons. We should skip text-white globally, but handle specific hardcoded text-white on pure black backgrounds.
    // Borders
    { from: /border-gray-200/g, to: 'border-white/10' },
    { from: /border-gray-100/g, to: 'border-white/5' },
    { from: /border-zinc-200/g, to: 'border-white/10' },
    { from: /border-zinc-100/g, to: 'border-white/5' },
    // Specifically fix bg-zinc-900 (dark buttons) -> bg-white text-black
    { from: /bg-zinc-900/g, to: 'bg-white text-zinc-900' },
    { from: /bg-gray-900/g, to: 'bg-white text-gray-900' },
    // For shadows that depend on light backgrounds
    // { from: /shadow-sm/g, to: 'shadow-none' } // Optional
];

// Refined strategy: text-white -> we don't change by default unless it's in a specific context.
// But some `bg-zinc-900 text-white` might be transformed to `bg-white text-zinc-900 text-white` which conflicts.
// Let's do a smarter replace.

content = content.replace(/bg-white/g, 'bg-[#0a0a0a]');
content = content.replace(/bg-\[#FAFAFA\]/g, 'bg-[#030303]');
content = content.replace(/bg-gray-50(?!0)/g, 'bg-white/5');
content = content.replace(/bg-gray-100/g, 'bg-white/10');
content = content.replace(/bg-zinc-50(?!0)/g, 'bg-white/5');
content = content.replace(/bg-\[#F6F7FB\]/g, 'bg-[#0a0a0a]');

content = content.replace(/text-gray-900/g, 'text-white');
content = content.replace(/text-zinc-900/g, 'text-white');
content = content.replace(/text-gray-800/g, 'text-gray-200');
content = content.replace(/text-gray-700/g, 'text-gray-300');
content = content.replace(/text-gray-600/g, 'text-gray-400');
content = content.replace(/text-gray-500/g, 'text-gray-400');
content = content.replace(/text-zinc-500/g, 'text-zinc-400');
content = content.replace(/text-zinc-400/g, 'text-zinc-500');

content = content.replace(/border-gray-200/g, 'border-white/10');
content = content.replace(/border-gray-100/g, 'border-white/5');
content = content.replace(/border-zinc-200/g, 'border-white/10');
content = content.replace(/border-zinc-100/g, 'border-white/5');

// Black buttons to white buttons
content = content.replace(/bg-zinc-900 text-white/g, 'bg-white text-zinc-900');
content = content.replace(/bg-gray-900 text-white/g, 'bg-white text-gray-900');

fs.writeFileSync(file, content);
console.log('App.jsx has been inverted to dark mode styles.');
