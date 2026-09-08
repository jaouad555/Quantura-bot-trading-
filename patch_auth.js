const fs = require('fs');
let content = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const regex = /\{isConfigured \? \([\s\S]*?\{\/\* 2FA Input Field \*\/\}/g;

if (regex.test(content)) {
  content = content.replace(regex, `              <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in duration-200">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-300">
                    {getLabel('المفتاح السري محفوظ ومحمي بأمان', 'Secret Key Securely Protected', 'Clé secrète protégée')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {getLabel('تم إخفاء المفتاح نهائياً لأسباب أمنية. افتح تطبيق الهاتف وأدخل الرمز أدناه.', 'Key is permanently hidden for security. Open Authenticator and enter code below.', 'Clé masquée pour des raisons de sécurité. Entrez le code ci-dessous.')}
                  </div>
                </div>
              </div>

              {/* 2FA Input Field */}`);
  fs.writeFileSync('src/components/AuthScreen.tsx', content);
  console.log("Success");
} else {
  console.log("Regex not matched");
}
