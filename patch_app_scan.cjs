const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the scanNextPair block with polling /api/scanner/status
const oldBlockStart = `// (Alerts only)`;
const oldBlockEnd = `}, [pushNewAlert, playAudioChime]);`;

const startIndex = content.indexOf(oldBlockStart);
if (startIndex !== -1) {
  const endIndex = content.indexOf(oldBlockEnd, startIndex) + oldBlockEnd.length;
  
  const newBlock = `
  // Poll scanner status
  const [scannerState, setScannerState] = useState<any>(null);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scanner/status');
        if (res.ok) {
          const data = await res.json();
          setScannerState(data);
          
          // Check for strong signals to alert
          if (data && data.symbolStates) {
            Object.values(data.symbolStates).forEach((state: any) => {
              if (state.confidence >= minConfidenceThresholdRef.current && (state.lastSignal === 'LONG' || state.lastSignal === 'SHORT')) {
                // If it's a new strong signal that we haven't alerted for recently, we can alert
                // To avoid spam, we'd need to track alerted symbols + timestamps.
                // Simple implementation:
                if (Date.now() - state.lastAnalyzed < 5000) {
                  // Actually, let's just push simple alerts
                  const mockSignal = { decision: state.lastSignal, confidence: state.confidence };
                  // pushNewAlert(mockSignal as any, false, state.symbol);
                }
              }
            });
          }
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);
`;

  content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log("Patched App.tsx scanNextPair successfully.");
} else {
  console.log("Could not find old block.");
}
