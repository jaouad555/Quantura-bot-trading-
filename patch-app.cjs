const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import { auth } from "./lib/firebase";')) {
  code = code.replace(
    'import { AuthScreen } from "./components/AuthScreen";',
    'import { AuthScreen } from "./components/AuthScreen";\nimport { auth } from "./lib/firebase";\nimport { onAuthStateChanged, signOut } from "firebase/auth";'
  );
}

code = code.replace(
  /const \[isAuthenticated, setIsAuthenticated\] = useState<boolean>\(\(\) => \{[\s\S]*?\}\);/,
  `const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setUsername(user.email ? user.email.split('@')[0] : 'user');
      } else {
        setIsAuthenticated(false);
        setUsername('');
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);`
);

code = code.replace(
  /const handleLogin = \(name: string\) => \{[\s\S]*?\};/,
  `const handleLogin = (name: string) => {
    // handled by onAuthStateChanged
  };`
);

code = code.replace(
  /const handleLogout = \(\) => \{[\s\S]*?\};/,
  `const handleLogout = async () => {
    try {
      await signOut(auth);
      apiStorage.clear();
      setIsAuthenticated(false);
      setUsername('');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };`
);

code = code.replace(
  /{!isAuthenticated \? \(/,
  `{authChecking ? (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !isAuthenticated ? (`
);

fs.writeFileSync('src/App.tsx', code);
