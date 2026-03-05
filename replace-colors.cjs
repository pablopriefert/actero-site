const fs = require('fs');

const files = [
    'src/App.jsx',
    'components/ui/glass-hero.jsx',
    'components/ui/animated-counter.tsx',
    'components/ui/lead-capture-modal.jsx',
    'components/blocks/demo-hero.tsx',
    'components/ui/button-colorful.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    // Replace indigo logic
    content = content.replace(/indigo-50\b/g, 'zinc-800');
    content = content.replace(/indigo-100\b/g, 'zinc-700');
    content = content.replace(/indigo-200\b/g, 'zinc-600');
    content = content.replace(/indigo-300\b/g, 'zinc-400');
    content = content.replace(/indigo-400\b/g, 'zinc-300');
    content = content.replace(/indigo-500\b/g, 'zinc-400');
    content = content.replace(/indigo-600\b/g, 'zinc-300');
    content = content.replace(/indigo-700\b/g, 'zinc-400');
    content = content.replace(/indigo-800\b/g, 'zinc-700');
    content = content.replace(/indigo-900\b/g, 'zinc-800');
    content = content.replace(/indigo\b/g, 'zinc');

    // Replace purple logic
    content = content.replace(/purple-50\b/g, 'zinc-800');
    content = content.replace(/purple-100\b/g, 'zinc-700');
    content = content.replace(/purple-200\b/g, 'zinc-600');
    content = content.replace(/purple-300\b/g, 'zinc-400');
    content = content.replace(/purple-400\b/g, 'zinc-300');
    content = content.replace(/purple-500\b/g, 'zinc-400');
    content = content.replace(/purple-600\b/g, 'zinc-300');
    content = content.replace(/purple-700\b/g, 'zinc-400');
    content = content.replace(/purple-800\b/g, 'zinc-700');
    content = content.replace(/purple-900\b/g, 'zinc-800');
    content = content.replace(/purple\b/g, 'zinc');

    fs.writeFileSync(file, content);
    console.log(`Replaced colors in ${file}`);
});
