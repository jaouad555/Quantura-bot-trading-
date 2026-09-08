import { apiStorage } from "./apiStorage";
export const exportConfigToJson = () => {
  const allData: Record<string, string> = {};
  for (let i = 0; i < apiStorage.length; i++) {
    const key = apiStorage.key(i);
    if (key && key !== 'btc_bot_logs') { // Avoid huge logs
      allData[key] = apiStorage.getItem(key) || '';
    }
  }
  
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ais-trading-config-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importConfigFromJson = (file: File, onSuccess: () => void, onError: (err: string) => void) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (typeof data !== 'object' || data === null) throw new Error('Invalid JSON format');
      
      Object.keys(data).forEach(key => {
        apiStorage.setItem(key, data[key]);
      });
      
      onSuccess();
    } catch (error) {
      onError((error as Error).message);
    }
  };
  reader.readAsText(file);
};
