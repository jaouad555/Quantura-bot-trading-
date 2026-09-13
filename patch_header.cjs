const fs = require('fs');
const content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Add Display Mode types
let updated = content.replace(
  "export interface HeaderProps {",
  `export type DisplayMode = 'auto' | 'standard' | 'compact' | 'fullscreen';\n\nexport interface HeaderProps {`
);

// Add displayMode props
updated = updated.replace(
  "onToggleAndroidView: () => void;",
  `onToggleAndroidView: () => void;\n  displayMode?: DisplayMode;\n  onChangeDisplayMode?: (mode: DisplayMode) => void;`
);

// Add the import for the icon Maximize (which can represent Display Mode)
updated = updated.replace(
  "Settings, Monitor, Smartphone,",
  "Settings, Monitor, Smartphone, Maximize, AppWindow,"
);

// Add it to function signature
updated = updated.replace(
  "onToggleAndroidView,",
  "onToggleAndroidView,\n  displayMode = 'standard',\n  onChangeDisplayMode,"
);

// We need a dropdown for Display Mode.
const displayModeMenu = `
            {/* Display Mode Dropdown */}
            {onChangeDisplayMode && (
              <div className="relative group/displaymode shrink-0">
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition shrink-0 cursor-pointer active:scale-95"
                  title="Display Mode"
                  aria-label="Display mode"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-32 rounded-lg bg-slate-900 border border-slate-800 shadow-xl opacity-0 invisible group-hover/displaymode:opacity-100 group-hover/displaymode:visible transition-all duration-200 z-50 overflow-hidden flex flex-col">
                  <button onClick={() => onChangeDisplayMode('auto')} className={\`text-left px-3 py-2 text-xs hover:bg-slate-800 transition \${displayMode === 'auto' ? 'text-brand-400 bg-slate-800/50' : 'text-slate-300'}\`}>Auto Mode</button>
                  <button onClick={() => onChangeDisplayMode('standard')} className={\`text-left px-3 py-2 text-xs hover:bg-slate-800 transition \${displayMode === 'standard' ? 'text-brand-400 bg-slate-800/50' : 'text-slate-300'}\`}>Standard Mode</button>
                  <button onClick={() => onChangeDisplayMode('compact')} className={\`text-left px-3 py-2 text-xs hover:bg-slate-800 transition \${displayMode === 'compact' ? 'text-brand-400 bg-slate-800/50' : 'text-slate-300'}\`}>Compact Mode</button>
                  <button onClick={() => onChangeDisplayMode('fullscreen')} className={\`text-left px-3 py-2 text-xs hover:bg-slate-800 transition \${displayMode === 'fullscreen' ? 'text-brand-400 bg-slate-800/50' : 'text-slate-300'}\`}>Fullscreen</button>
                </div>
              </div>
            )}
`;

// Insert the display mode menu right before Settings Button
updated = updated.replace(
  "{/* Settings Button */}",
  displayModeMenu + "\n            {/* Settings Button */}"
);

fs.writeFileSync('src/components/Header.tsx', updated);
