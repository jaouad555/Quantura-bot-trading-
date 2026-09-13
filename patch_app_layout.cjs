const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '{activeTab === \'signal\' && (\n            <div className="space-y-6">',
  '{activeTab === \'signal\' && (\n            <div className="space-y-4 md:space-y-6 flex flex-col h-full">'
);

content = content.replace(
  '<div style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? \'hidden\' : \'visible\' }}>\n                <TradingChart',
  '<div className="flex-1 min-h-0" style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? \'hidden\' : \'visible\' }}>\n                <TradingChart'
);

content = content.replace(
  '{activeTab === \'chart\' && (\n            <div style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? \'hidden\' : \'visible\' }}>',
  '{activeTab === \'chart\' && (\n            <div className="flex-1 min-h-0" style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? \'hidden\' : \'visible\' }}>'
);

fs.writeFileSync('src/App.tsx', content);
