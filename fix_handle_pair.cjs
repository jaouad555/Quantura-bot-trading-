const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldHandlePairChange = `  const handlePairChange = (pair: TradingPair) => {
    setSelectedSymbol(pair.symbol);
    try {
      apiStorage.setItem('selected_trading_pair', pair.symbol);
    } catch (e) {
      // ignore storage error
    }
    binanceWsManager.setSymbol(pair.symbol);
    fetchMarketData(timeframe, pair.symbol, botConfig.marketType || 'FUTURES');
  };`;

const newHandlePairChange = `  const handlePairChange = (pair: TradingPair) => {
    setSelectedSymbol(pair.symbol);
    try {
      apiStorage.setItem('selected_trading_pair', pair.symbol);
    } catch (e) {
      // ignore storage error
    }
    
    // FAST UI UPDATE: Fetch ticker instantly from Binance REST directly for immediate visual feedback
    const activeMT = botConfig.marketType || 'FUTURES';
    const baseUrl = activeMT === 'FUTURES' ? 'https://fapi.binance.com/fapi/v1/ticker/24hr' : 'https://api.binance.com/api/v3/ticker/24hr';
    fetch(\`\${baseUrl}?symbol=\${pair.symbol}\`)
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

    binanceWsManager.setSymbol(pair.symbol);
    fetchMarketData(timeframe, pair.symbol, activeMT);
  };`;

if (content.includes(oldHandlePairChange)) {
    content = content.replace(oldHandlePairChange, newHandlePairChange);
    fs.writeFileSync('src/App.tsx', content, 'utf8');
    console.log('Patched handlePairChange in App.tsx');
} else {
    console.log('Could not find exact handlePairChange block. Will try regex.');
    // Fallback using regex
    const regex = /const handlePairChange = \(pair: TradingPair\) => \{[\s\S]*?fetchMarketData\(timeframe, pair.symbol, botConfig.marketType \|\| 'FUTURES'\);\s*\};/;
    if (regex.test(content)) {
        content = content.replace(regex, newHandlePairChange);
        fs.writeFileSync('src/App.tsx', content, 'utf8');
        console.log('Patched handlePairChange via Regex');
    } else {
        console.log('Regex also failed.');
    }
}
