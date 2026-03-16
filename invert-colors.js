import fs from 'fs';

const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// The goal is to invert colors for a dark mode.
// We will apply these replacements globally in App.jsx

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
