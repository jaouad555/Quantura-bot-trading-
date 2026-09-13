const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add DisplayMode type import if needed or define locally
const displayModeType = `export type DisplayMode = 'auto' | 'standard' | 'compact' | 'fullscreen';\n`;

// Insert the type if not there
if (!content.includes("export type DisplayMode")) {
  content = content.replace("export const App: React.FC = () => {", displayModeType + "export const App: React.FC = () => {");
}

// Add state
const stateCode = `
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      return (apiStorage.getItem('quantura_display_mode') as DisplayMode) || 'standard';
    } catch {
      return 'standard';
    }
  });

  const [effectiveDisplayMode, setEffectiveDisplayMode] = useState<'standard' | 'compact' | 'fullscreen'>('standard');

  useEffect(() => {
    try {
      apiStorage.setItem('quantura_display_mode', displayMode);
    } catch {}

    if (displayMode === 'fullscreen') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setEffectiveDisplayMode('fullscreen');
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      
      if (displayMode === 'auto') {
        const handleResize = () => {
          const w = window.innerWidth;
          if (w < 1366) setEffectiveDisplayMode('compact');
          else setEffectiveDisplayMode('standard');
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      } else {
        setEffectiveDisplayMode(displayMode as 'standard' | 'compact');
      }
    }
  }, [displayMode]);
`;

content = content.replace("  const [isAndroidView, setIsAndroidView] = useState(false);", "  const [isAndroidView, setIsAndroidView] = useState(false);\n" + stateCode);

// Inject into Header
content = content.replace(
  "onToggleAndroidView={() => setIsAndroidView(!isAndroidView)}",
  "onToggleAndroidView={() => setIsAndroidView(!isAndroidView)}\n            displayMode={displayMode}\n            onChangeDisplayMode={setDisplayMode}"
);

// Apply dynamic classes on the root element
// In App.tsx:
// <div className={`min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-brand-500 selection:text-slate-950 ${isArabic ? 'rtl' : 'ltr'}`}>

content = content.replace(
  "selection:text-slate-950 ${isArabic ? 'rtl' : 'ltr'}`}",
  "selection:text-slate-950 ${isArabic ? 'rtl' : 'ltr'} mode-${effectiveDisplayMode}`}"
);

fs.writeFileSync('src/App.tsx', content);
