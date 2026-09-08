const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const handleToggleMarketType = \(newMarketType: MarketType\) => \{([\s\S]*?)fetchMarketData\(timeframe, selectedSymbol, newMarketType\);\s*\};/;

const newHandleMarketType = `const handleToggleMarketType = (newMarketType: MarketType) => {
    setBotConfig((prev) => ({
      ...prev,
      marketType: newMarketType,
      leverage: newMarketType === 'FUTURES' ? ((prev.leverage && prev.leverage > 1) ? prev.leverage : 3) : 1,
    }));
    
    // FAST UI UPDATE
    const baseUrl = newMarketType === 'FUTURES' ? 'https://fapi.binance.com/fapi/v1/ticker/24hr' : 'https://api.binance.com/api/v3/ticker/24hr';
    fetch(\`\${baseUrl}?symbol=\${selectedSymbol}\`)
      .then(res => res.json())
      .then(data => {
        if (data && data.lastPrice) {
          setTicker({
            symbol: data.symbol,
            price: parseFloat(data.lastPrice),
            priceChangePercent24h: parseFloat(data.priceChangePercent),
            volume24h: parseFloat(data.volume),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice)
          });
        }
      })
      .catch(() => {});

    binanceWsManager.setMarketType(newMarketType);
    fetchMarketData(timeframe, selectedSymbol, newMarketType);
  };`;

if (regex.test(content)) {
    content = content.replace(regex, newHandleMarketType);
    fs.writeFileSync('src/App.tsx', content, 'utf8');
    console.log('Patched handleToggleMarketType');
} else {
    console.log('Could not patch handleToggleMarketType');
}
