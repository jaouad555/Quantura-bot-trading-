with open("src/components/BinanceConnectionModal.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add isFrench
content = content.replace(
    "  const isArabic = language === 'ar';\n  const isEn = language === 'en';",
    "  const isArabic = language === 'ar';\n  const isEn = language === 'en';\n  const isFrench = language === 'fr';"
)

replacements = [
    ("message: data.error || (isArabic ? 'فشل الاتصال بـ Binance API' : 'Échec de connexion à Binance API')",
     "message: data.error || (isArabic ? 'فشل الاتصال بـ Binance API' : isFrench ? 'Échec de connexion à Binance API' : 'Failed to connect to Binance API')"),

    ("message: err.message || (isArabic ? 'حدث خطأ أثناء فحص الاتصال' : 'Erreur lors du test de connexion.')",
     "message: err.message || (isArabic ? 'حدث خطأ أثناء فحص الاتصال' : isFrench ? 'Erreur lors du test de connexion.' : 'Error while testing connection.')"),

    ("text: isArabic ? 'الحد الأدنى لصفقات بايننس هو 10$ USDT' : 'Montant minimum Binance : 10$ USDT'",
     "text: isArabic ? 'الحد الأدنى لصفقات بايننس هو 10$ USDT' : isFrench ? 'Montant minimum Binance : 10$ USDT' : 'Binance minimum order amount is $10 USDT'"),

    ("{isArabic ? 'وضع تنفيذ التداول (Execution Mode)' : 'Mode d\\'Exécution'}",
     "{isArabic ? 'وضع تنفيذ التداول (Execution Mode)' : isFrench ? 'Mode d\\'Exécution' : 'Execution Mode'}"),

    ("<span>{isArabic ? 'تداول تجريبي (Paper Trading)' : 'Paper Trading (Virtuel)'}</span>",
     "<span>{isArabic ? 'تداول تجريبي (Paper Trading)' : isFrench ? 'Paper Trading (Virtuel)' : 'Paper Trading (Demo)'}</span>"),

    ("<span>{isArabic ? 'حساب حقيقي (Binance Live)' : 'Compte Réel (Binance Live)'}</span>",
     "<span>{isArabic ? 'حساب حقيقي (Binance Live)' : isFrench ? 'Compte Réel (Binance Live)' : 'Live Account (Binance Live)'}</span>"),

    ("{isArabic ? 'تنبيه: التداول الحقيقي مفعل بالأموال الحقيقية!' : 'Attention : Le Trading Réel est Actif !'}",
     "{isArabic ? 'تنبيه: التداول الحقيقي مفعل بالأموال الحقيقية!' : isFrench ? 'Attention : Le Trading Réel est Actif !' : 'Warning: Live Trading with Real Funds is Active!'}"),

    ("{isArabic ? 'مقارنة الأرصدة والمصدر النشط للتداول' : 'Aperçu des Soldes (Paper vs Live)'}",
     "{isArabic ? 'مقارنة الأرصدة والمصدر النشط للتداول' : isFrench ? 'Aperçu des Soldes (Paper vs Live)' : 'Balance Overview (Paper vs Live)'}"),

    ("<span>{isArabic ? 'رصيد الورقة المالية (Paper)' : 'Solde Virtuel (Paper)'}</span>",
     "<span>{isArabic ? 'رصيد الورقة المالية (Paper)' : isFrench ? 'Solde Virtuel (Paper)' : 'Paper Trading Balance'}</span>"),

    ("{isArabic ? 'أموال محاكاة تجريبية بدون مخاطرة' : 'Fonds virtuels de simulation'}",
     "{isArabic ? 'أموال محاكاة تجريبية بدون مخاطرة' : isFrench ? 'Fonds virtuels de simulation' : 'Risk-free simulation funds'}"),

    ("<span>{isArabic ? 'رصيد بايننس الحقيقي (Live)' : 'Solde Binance Réel (Live)'}</span>",
     "<span>{isArabic ? 'رصيد بايننس الحقيقي (Live)' : isFrench ? 'Solde Binance Réel (Live)' : 'Real Binance Balance (Live)'}</span>"),

    ("<span>{isArabic ? 'إرشادات الأمان الموصى بها لمفاتيح API' : 'Sécurité & Permissions de vos Clés API'}</span>",
     "<span>{isArabic ? 'إرشادات الأمان الموصى بها لمفاتيح API' : isFrench ? 'Sécurité & Permissions de vos Clés API' : 'API Key Security & Permissions Guidelines'}</span>"),

    ("<strong className=\"text-white\">{isArabic ? 'تعطيل السحب (Disable Withdrawals):' : 'Désactiver les Retraits :'}</strong>",
     "<strong className=\"text-white\">{isArabic ? 'تعطيل السحب (Disable Withdrawals):' : isFrench ? 'Désactiver les Retraits :' : 'Disable Withdrawals:'}</strong>"),

    ("<strong className=\"text-white\">{isArabic ? 'تشفير الخادم:' : 'Sécurité Serveur :'}</strong>",
     "<strong className=\"text-white\">{isArabic ? 'تشفير الخادم:' : isFrench ? 'Sécurité Serveur :' : 'Server Security:'}</strong>"),

    ("{isArabic ? 'سوق التداول' : 'Marché de Trading'}",
     "{isArabic ? 'سوق التداول' : isFrench ? 'Marché de Trading' : 'Trading Market'}"),

    ("{isArabic ? 'شبكة الاختبار (Testnet Sandbox)' : 'Utiliser Binance Testnet'}",
     "{isArabic ? 'شبكة الاختبار (Testnet Sandbox)' : isFrench ? 'Utiliser Binance Testnet' : 'Use Binance Testnet'}"),

    ("{isArabic ? 'المفتاح العام' : 'Clé Publique'}",
     "{isArabic ? 'المفتاح العام' : isFrench ? 'Clé Publique' : 'API Key (Public)'}"),

    ("{isArabic ? 'المفتاح السري (يتم حفظه بأمان)' : 'Clé Secrète'}",
     "{isArabic ? 'المفتاح السري (يتم حفظه بأمان)' : isFrench ? 'Clé Secrète' : 'API Secret (Stored Securely)'}"),

    ("<span>{isArabic ? 'جارِ التحقق والاتصال...' : 'Vérification en cours...'}</span>",
     "<span>{isArabic ? 'جارِ التحقق والاتصال...' : isFrench ? 'Vérification en cours...' : 'Testing connection...'}</span>"),

    ("<span>{isArabic ? 'فحص الاتصال وحفظ المفاتيح ⚡' : 'Tester & Sauvegarder la Connexion'}</span>",
     "<span>{isArabic ? 'فحص الاتصال وحفظ المفاتيح ⚡' : isFrench ? 'Tester & Sauvegarder la Connexion' : 'Test & Save Connection ⚡'}</span>"),

    ("{isArabic ? 'مسح المفاتيح' : 'Effacer'}",
     "{isArabic ? 'مسح المفاتيح' : isFrench ? 'Effacer' : 'Clear Keys'}"),

    ("{isArabic ? 'أرصدة حساب Binance المباشر' : 'Solde du Compte Binance Réel'}",
     "{isArabic ? 'أرصدة حساب Binance المباشر' : isFrench ? 'Solde du Compte Binance Réel' : 'Live Binance Account Balances'}"),

    (".join(' | ') || (isArabic ? 'لا توجد عملات أخرى' : 'Aucun autre actif')}",
     ".join(' | ') || (isArabic ? 'لا توجد عملات أخرى' : isFrench ? 'Aucun autre actif' : 'No other assets')}"),

    ("<span>{isArabic ? `تنفيذ يدوي فوري على بايننس (${activeSymbol})` : `Ordre Manuel Immédiat (${activeSymbol})`}</span>",
     "<span>{isArabic ? `تنفيذ يدوي فوري على بايننس (${activeSymbol})` : isFrench ? `Ordre Manuel Immédiat (${activeSymbol})` : `Instant Manual Execution (${activeSymbol})`}</span>"),

    ("<span>{isArabic ? `شراء فوري BUY ($${manualOrderAmount})` : `ACHAT MARKET ($${manualOrderAmount})`}</span>",
     "<span>{isArabic ? `شراء فوري BUY ($${manualOrderAmount})` : isFrench ? `ACHAT MARKET ($${manualOrderAmount})` : `MARKET BUY ($${manualOrderAmount})`}</span>"),

    ("<span>{isArabic ? `بيع فوري SELL ($${manualOrderAmount})` : `VENTE MARKET ($${manualOrderAmount})`}</span>",
     "<span>{isArabic ? `بيع فوري SELL ($${manualOrderAmount})` : isFrench ? `VENTE MARKET ($${manualOrderAmount})` : `MARKET SELL ($${manualOrderAmount})`}</span>"),

    ("{isArabic ? 'إغلاق النافذة' : 'Fermer'}",
     "{isArabic ? 'إغلاق النافذة' : isFrench ? 'Fermer' : 'Close Window'}"),

    ("{isArabic ? 'تأكيد تفعيل التداول الحقيقي بالأموال الفعلية' : 'Confirmer l\\'Activation du Trading Réel'}",
     "{isArabic ? 'تأكيد تفعيل التداول الحقيقي بالأموال الفعلية' : isFrench ? 'Confirmer l\\'Activation du Trading Réel' : 'Confirm Live Trading Activation with Real Funds'}"),

    ("<div>• {isArabic ? 'الرصيد المتاح للتداول:' : 'Solde disponible :'} <strong className=\"text-emerald-400\">${activeAccount?.freeUsdt.toFixed(2) || '0.00'} USDT</strong></div>",
     "<div>• {isArabic ? 'الرصيد المتاح للتداول:' : isFrench ? 'Solde disponible :' : 'Available Trading Balance:'} <strong className=\"text-emerald-400\">${activeAccount?.freeUsdt.toFixed(2) || '0.00'} USDT</strong></div>"),

    ("<div>• {isArabic ? 'الشبكة:' : 'Réseau :'} <strong className=\"text-white\">{useTestnet ? 'Binance Testnet' : 'Binance Mainnet (Live)'}</strong></div>",
     "<div>• {isArabic ? 'الشبكة:' : isFrench ? 'Réseau :' : 'Network:'} <strong className=\"text-white\">{useTestnet ? 'Binance Testnet' : 'Binance Mainnet (Live)'}</strong></div>"),

    ("{isArabic ? 'إلغاء والعودة للتجريبي' : 'Annuler'}",
     "{isArabic ? 'إلغاء والعودة للتجريبي' : isFrench ? 'Annuler' : 'Cancel and Return to Demo'}"),

    ("{isArabic ? 'نعم، تفعيل التداول الحقيقي 🔥' : 'Oui, Activer le Mode Réel'}",
     "{isArabic ? 'نعم، تفعيل التداول الحقيقي 🔥' : isFrench ? 'Oui, Activer le Mode Réel' : 'Yes, Activate Live Mode 🔥'}"),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
    else:
        print("NOT FOUND:", old[:40])

with open("src/components/BinanceConnectionModal.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print(f"Applied {count} in BinanceConnectionModal.tsx")
