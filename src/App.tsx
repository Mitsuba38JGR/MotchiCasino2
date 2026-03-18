/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Dice5, 
  Gamepad2, 
  Trophy, 
  LogOut, 
  TrendingUp, 
  Sword, 
  Layers, 
  CircleDot, 
  ArrowRightLeft,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Landmark,
  Settings,
  UserX,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getMocchiParts(amount: number): { value: string; unit: string } {
  const absAmount = Math.abs(amount);
  const TERA = 1_000_000_000;
  const NEO = 1_000_000_000_000_000_000;
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= NEO) {
    return { value: sign + (absAmount / NEO).toLocaleString(undefined, { maximumFractionDigits: 2 }), unit: 'ネオもっち' };
  }
  if (absAmount >= TERA) {
    return { value: sign + (absAmount / TERA).toLocaleString(undefined, { maximumFractionDigits: 2 }), unit: 'テラもっち' };
  }
  return { value: sign + absAmount.toLocaleString(), unit: 'もっち' };
}

// --- Types ---
interface UserData {
  userId: string;
  displayName: string;
  email: string;
  balance: number;
  accountBalance: number;
  faBalance: number;
  unitRev: string;
  loanAmount: number;
  loanDue: string;
}

type GameTab = 'lobby' | 'ranking' | 'cointoss' | 'dice' | 'poker' | 'blackjack' | 'russian' | 'slot' | 'pachinko' | 'roulette' | 'fx' | 'bank' | 'settings';

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
      secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
      outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
      danger: 'bg-rose-600 text-white hover:bg-rose-700',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GameTab>('lobby');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Check Auth on Load
  useEffect(() => {
    console.log('Checking auth...');
    fetch('/api/me')
      .then(async res => {
        if (res.ok) return res.json();
        if (res.status === 401) return null;
        const text = await res.text();
        console.error(`Auth check failed with status ${res.status}: ${text}`);
        return null;
      })
      .then(data => {
        console.log('Auth data:', data);
        setUserData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Auth check fetch error:', err);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUserData(null);
    setActiveTab('lobby');
  };

  const refillBalance = async () => {
    if (!userData || userData.balance > 0) return;
    try {
      const res = await fetch('/api/refill', { method: 'POST' });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setUserData({ ...userData, balance: data.balance });
      } else {
        const text = await res.text();
        console.error(`Refill failed: ${text}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateBalance = async (diff: number, accountDiff: number = 0, faDiff: number = 0, unitRev?: string) => {
    if (!userData) return;
    try {
      const res = await fetch('/api/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff, accountDiff, faDiff, unitRev })
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setUserData({ 
          ...userData, 
          balance: data.balance, 
          accountBalance: data.accountBalance, 
          faBalance: data.faBalance,
          unitRev: data.unitRev
        });
      } else {
        const text = await res.text();
        console.error(`Update balance failed: ${text}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500">
        <RefreshCw className="animate-spin w-10 h-10" />
      </div>
    );
  }

  if (!userData) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onLogin={setUserData} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('lobby')}>
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Coins className="text-slate-950 w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">Mocchi Casino</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">{userData?.displayName}</span>
              <span className="text-emerald-400 font-bold font-mono">
                {(() => {
                  const { value, unit } = getMocchiParts(userData?.balance || 0);
                  return `${value} ${unit}`;
                })()}
              </span>
            </div>
            <Button variant="secondary" onClick={handleLogout} className="p-2">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border-emerald-500/20">
                <div className="flex flex-col items-center py-4">
                  <span className="text-slate-400 text-sm uppercase tracking-[0.2em] mb-2">カジノ用所持金</span>
                  <div className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">
                    {(() => {
                      const { value, unit } = getMocchiParts(userData?.balance || 0);
                      return (
                        <>
                          {value} <span className="text-2xl">{unit}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-sm">
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 text-center">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">銀行預金（資産）</div>
                      <div className="text-lg font-mono font-bold text-white">
                        {(() => {
                          const { value, unit } = getMocchiParts(userData?.accountBalance || 0);
                          return `${value}${unit === 'もっち' ? '' : ' ' + unit}`;
                        })()}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 text-center">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">FX口座（資産）</div>
                      <div className="text-lg font-mono font-bold text-amber-400">
                        {(() => {
                          const { value, unit } = getMocchiParts(userData?.faBalance || 0);
                          return `${value}${unit === 'もっち' ? '' : ' ' + unit}`;
                        })()}
                      </div>
                    </div>
                  </div>
                  {userData?.balance === 0 && (
                    <Button variant="primary" onClick={refillBalance} className="mt-6">
                      <RefreshCw className="w-4 h-4" /> 10,000もっち（カジノ用）を申請
                    </Button>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <GameButton icon={<Trophy />} label="ランキング" onClick={() => setActiveTab('ranking')} color="amber" />
                <GameButton icon={<Landmark />} label="銀行" onClick={() => setActiveTab('bank')} color="emerald" />
                <GameButton icon={<Settings />} label="設定" onClick={() => setActiveTab('settings')} color="blue" />
                <GameButton icon={<Coins />} label="コイントス" onClick={() => setActiveTab('cointoss')} color="emerald" />
                <GameButton icon={<Dice5 />} label="サイコロ" onClick={() => setActiveTab('dice')} color="blue" />
                <GameButton icon={<Layers />} label="ポーカー" onClick={() => setActiveTab('poker')} color="rose" />
                <GameButton icon={<Gamepad2 />} label="ブラックジャック" onClick={() => setActiveTab('blackjack')} color="indigo" />
                <GameButton icon={<Sword />} label="ロシアンルーレット" onClick={() => setActiveTab('russian')} color="orange" />
                <GameButton icon={<CircleDot />} label="スロット" onClick={() => setActiveTab('slot')} color="purple" />
                <GameButton icon={<Layers />} label="パチンコ" onClick={() => setActiveTab('pachinko')} color="cyan" />
                <GameButton icon={<CircleDot />} label="ルーレット" onClick={() => setActiveTab('roulette')} color="red" />
                <GameButton icon={<ArrowRightLeft />} label="FX" onClick={() => setActiveTab('fx')} color="yellow" disabled={userData ? userData.balance < 1000000 : true} />
              </div>
            </motion.div>
          )}

          {activeTab === 'ranking' && <RankingView onBack={() => setActiveTab('lobby')} />}
          {activeTab === 'cointoss' && <CoinTossGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'dice' && <DiceGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'poker' && <PokerGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'blackjack' && <BlackjackGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'russian' && <RussianRouletteGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'slot' && <SlotGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'pachinko' && <PachinkoGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'roulette' && <RouletteGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'fx' && <FXGame userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={updateBalance} />}
          {activeTab === 'bank' && <BankView userData={userData!} onBack={() => setActiveTab('lobby')} onUpdate={(data) => setUserData({ ...userData!, ...data })} />}
          {activeTab === 'settings' && <SettingsView userData={userData!} onBack={() => setActiveTab('lobby')} onLogout={handleLogout} onUpdate={(data) => setUserData({ ...userData!, ...data })} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Components ---

function GameButton({ icon, label, onClick, color, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; color: string; disabled?: boolean }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500/20',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500 hover:bg-purple-500/20',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/20',
    red: 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20',
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-2xl border transition-all active:scale-95 disabled:opacity-30 disabled:grayscale',
        colors[color]
      )}
    >
      <div className="mb-3 scale-125">{icon}</div>
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </button>
  );
}

function AuthScreen({ mode, setMode, onLogin }: { mode: 'login' | 'register'; setMode: (m: 'login' | 'register') => void; onLogin: (u: UserData) => void }) {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, password, displayName })
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }

      if (res.ok) {
        if (mode === 'login') {
          onLogin(data);
        } else {
          setMsg(data.message);
        }
      } else {
        setError(data.error || 'エラーが発生しました');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-500 p-3 rounded-2xl mb-4">
            <Coins className="text-slate-950 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase">Mocchi Casino</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">疑似通貨カジノへようこそ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ユーザーID</label>
                <input
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="mocchi_user"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">表示名</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="もっち太郎"
                />
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="mocchi@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
          {msg && <p className="text-emerald-500 text-xs font-medium">{msg}</p>}

          <Button type="submit" disabled={loading} className="w-full py-3">
            {loading ? <RefreshCw className="animate-spin" /> : mode === 'login' ? 'ログイン' : '新規登録'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-slate-400 text-sm hover:text-emerald-400 transition-colors"
          >
            {mode === 'login' ? 'アカウントをお持ちでないですか？ 新規登録' : 'すでにアカウントをお持ちですか？ ログイン'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// --- Game Views ---

function RankingView({ onBack }: { onBack: () => void }) {
  const [rankings, setRankings] = useState<{ displayName: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ranking')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRankings(data);
        } else {
          console.error('Ranking data is not an array:', data);
          setError(data.error || 'ランキングの取得に失敗しました');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Ranking fetch error:', err);
        setError('通信エラーが発生しました');
        setLoading(false);
      });
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack} className="p-2 rounded-full">
          <ChevronLeft />
        </Button>
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Ranking</h2>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">順位</th>
              <th className="px-6 py-4">プレイヤー</th>
              <th className="px-6 py-4 text-right">カジノ所持金</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={3} className="p-10 text-center text-slate-500">読み込み中...</td></tr>
            ) : error ? (
              <tr><td colSpan={3} className="p-10 text-center text-rose-400 font-bold">{error}</td></tr>
            ) : rankings.length === 0 ? (
              <tr><td colSpan={3} className="p-10 text-center text-slate-500">データがありません</td></tr>
            ) : rankings.map((r, i) => (
              <tr key={i} className={cn(i === 0 && "bg-amber-500/5", i === 1 && "bg-slate-400/5", i === 2 && "bg-orange-500/5")}>
                <td className="px-6 py-4 font-mono font-bold">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`}
                </td>
                <td className="px-6 py-4 text-white font-medium">{r.displayName}</td>
                <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                  {(() => {
                    const { value, unit } = getMocchiParts(r.balance);
                    return `${value} ${unit}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </motion.div>
  );
}

// --- Bank View ---

function BankView({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (data: Partial<UserData>) => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'deposit' | 'withdraw', target: 'account' | 'fa') => {
    if (amount <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = action === 'deposit' ? '/api/bank/deposit' : '/api/bank/withdraw';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, [action === 'deposit' ? 'target' : 'source']: target })
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data);
        setAmount(0);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bank/loan', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!window.confirm("銀行口座の残高が0の場合のみ、100万もっちに復旧できます。申請しますか？")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bank/recover', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data);
        alert(data.message);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack} className="p-2 rounded-full">
          <ChevronLeft />
        </Button>
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Mocchi Bank</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-6">
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <Landmark className="w-5 h-5" /> 銀行口座
          </h3>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-slate-500 uppercase tracking-widest">預金残高</div>
              <div className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">日利 7.2%</div>
            </div>
            <div className="text-3xl font-mono font-bold text-white">
              {(() => {
                const { value, unit } = getMocchiParts(userData.accountBalance);
                return `${value} ${unit}`;
              })()}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">金額入力</label>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button disabled={loading || amount <= 0} onClick={() => handleAction('deposit', 'account')}>財布から預ける</Button>
              <Button variant="secondary" disabled={loading || amount <= 0} onClick={() => handleAction('withdraw', 'account')}>FX口座へ送る</Button>
            </div>
            {userData.accountBalance === 0 && (
              <Button 
                variant="outline" 
                className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                disabled={loading}
                onClick={handleRecover}
              >
                銀行口座復旧申請 (100万もっち)
              </Button>
            )}
          </div>
        </Card>

        <Card className="space-y-6">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> FX口座
          </h3>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">FX残高</div>
            <div className="text-3xl font-mono font-bold text-white">
              {(() => {
                const { value, unit } = getMocchiParts(userData.faBalance);
                return `${value} ${unit}`;
              })()}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">金額入力</label>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button disabled={loading || amount <= 0} onClick={() => handleAction('deposit', 'fa')}>財布から預ける</Button>
              <Button variant="secondary" disabled={loading || amount <= 0} onClick={() => handleAction('withdraw', 'fa')}>銀行口座へ送る</Button>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2 space-y-6 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> FXローン
            </h3>
            {userData.loanAmount > 0 && (
              <div className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                返済期限: {new Date(userData.loanDue).toLocaleString()}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                FX取引専用の特別ローンです。50万もっちを無利子で借りることができます。
                <br />
                <span className="text-rose-400 font-bold">※20時間後にFX口座から自動的に引き落とされます。</span>
              </p>
              <div className="text-2xl font-black text-white font-mono">
                借入額: {(() => {
                  const { value, unit } = getMocchiParts(userData.loanAmount);
                  return `${value} ${unit}`;
                })()}
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="primary" 
                disabled={loading || userData.loanAmount > 0} 
                onClick={handleLoan}
                className="px-8 py-4 text-lg"
              >
                {userData.loanAmount > 0 ? '借入中' : '50万もっちを借りる'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </motion.div>
  );
}

// --- Settings View ---

function SettingsView({ userData, onBack, onLogout, onUpdate }: { userData: UserData; onBack: () => void; onLogout: () => void; onUpdate: (data: Partial<UserData>) => void }) {
  const [newDisplayName, setNewDisplayName] = useState(userData.displayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const handleUpdateName = async () => {
    if (!newDisplayName || newDisplayName === userData.displayName) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch('/api/user/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newDisplayName })
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate({ displayName: newDisplayName });
        setMsg('表示名を更新しました');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('本当にアカウントを削除しますか？ この操作は取り消せません。')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' });
      if (res.ok) {
        onLogout();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack} className="p-2 rounded-full">
          <ChevronLeft />
        </Button>
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Settings</h2>
      </div>

      <div className="space-y-6">
        <Card className="space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-emerald-500" /> プロフィール設定
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">表示名</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="新しい表示名"
              />
            </div>
            <Button disabled={loading || !newDisplayName || newDisplayName === userData.displayName} onClick={handleUpdateName} className="w-full">
              表示名を変更する
            </Button>
          </div>
        </Card>

        <Card className="space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <LogOut className="w-5 h-5 text-amber-500" /> アカウント操作
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <Button variant="secondary" onClick={onLogout} className="w-full">
              ログアウト
            </Button>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-4">
                アカウントを削除すると、すべての所持金、銀行残高、FX残高、ランキングデータが完全に消去されます。
              </p>
              <Button variant="danger" disabled={loading} onClick={handleDeleteAccount} className="w-full gap-2">
                <UserX className="w-4 h-4" /> アカウントを削除する
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-500">
          <RefreshCw className="w-5 h-5" />
          <span className="text-sm font-medium">{msg}</span>
        </div>
      )}
    </motion.div>
  );
}

// --- Individual Games ---

function GameLayout({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack} className="p-2 rounded-full">
          <ChevronLeft />
        </Button>
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function BetInput({ balance, onBet }: { balance: number; onBet: (amount: number) => void }) {
  const [amount, setAmount] = useState(100);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">賭け金</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={balance}
          value={amount}
          onChange={(e) => setAmount(Math.min(balance, Math.max(0, parseInt(e.target.value) || 0)))}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <Button variant="outline" onClick={() => setAmount(Math.floor(balance / 2))}>1/2</Button>
        <Button variant="outline" onClick={() => setAmount(balance)}>ALL</Button>
      </div>
      <Button disabled={amount <= 0 || amount > balance} onClick={() => onBet(amount)} className="w-full py-3 mt-2">
        勝負する
      </Button>
    </div>
  );
}

// 1. Coin Toss
function CoinTossGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [choice, setChoice] = useState<'heads' | 'tails' | null>(null);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = async (amount: number) => {
    if (!choice) return alert('裏か表か選んでください');
    setPlaying(true);
    setResult(null);
    
    setTimeout(async () => {
      const flip = Math.random() > 0.5 ? 'heads' : 'tails';
      setResult(flip);
      const win = flip === choice;
      onUpdate(win ? amount : -amount);
      setPlaying(false);
    }, 1000);
  };

  return (
    <GameLayout title="Coin Toss" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        <div className="flex gap-4">
          <button
            onClick={() => setChoice('heads')}
            className={cn("p-8 rounded-full border-2 transition-all", choice === 'heads' ? "border-emerald-500 bg-emerald-500/20" : "border-slate-800 bg-slate-800/50")}
          >
            <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold">表</div>
          </button>
          <button
            onClick={() => setChoice('tails')}
            className={cn("p-8 rounded-full border-2 transition-all", choice === 'tails' ? "border-emerald-500 bg-emerald-500/20" : "border-slate-800 bg-slate-800/50")}
          >
            <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold">裏</div>
          </button>
        </div>

        {result && (
          <div className={cn("text-4xl font-black italic uppercase", result === choice ? "text-emerald-400" : "text-rose-500")}>
            {result === 'heads' ? '表' : '裏'} - {result === choice ? 'WIN!' : 'LOSE...'}
          </div>
        )}

        <div className="w-full max-w-xs">
          <BetInput balance={userData.balance} onBet={play} />
        </div>
      </Card>
    </GameLayout>
  );
}

// 2. Dice
function DiceGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [choice, setChoice] = useState<'odd' | 'even' | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = async (amount: number) => {
    if (!choice) return alert('奇数か偶数か選んでください');
    setPlaying(true);
    setResult(null);
    
    setTimeout(async () => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setResult(roll);
      const isOdd = roll % 2 !== 0;
      const win = (choice === 'odd' && isOdd) || (choice === 'even' && !isOdd);
      onUpdate(win ? amount : -amount);
      setPlaying(false);
    }, 1000);
  };

  return (
    <GameLayout title="Dice" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        <div className="flex gap-4">
          <Button variant={choice === 'odd' ? 'primary' : 'outline'} onClick={() => setChoice('odd')} className="px-8 py-4">奇数 (1,3,5)</Button>
          <Button variant={choice === 'even' ? 'primary' : 'outline'} onClick={() => setChoice('even')} className="px-8 py-4">偶数 (2,4,6)</Button>
        </div>

        <div className="text-8xl">
          {playing ? <RefreshCw className="animate-spin w-20 h-20 text-slate-700" /> : result || '🎲'}
        </div>

        {result && (
          <div className={cn("text-4xl font-black italic uppercase", ((result % 2 !== 0 && choice === 'odd') || (result % 2 === 0 && choice === 'even')) ? "text-emerald-400" : "text-rose-500")}>
            {result % 2 !== 0 ? '奇数' : '偶数'} - {((result % 2 !== 0 && choice === 'odd') || (result % 2 === 0 && choice === 'even')) ? 'WIN!' : 'LOSE...'}
          </div>
        )}

        <div className="w-full max-w-xs">
          <BetInput balance={userData.balance} onBet={play} />
        </div>
      </Card>
    </GameLayout>
  );
}

// 3. Poker (Video Poker Style)
type Suit = '♠' | '♣' | '♥' | '♦';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface CardData {
  suit: Suit;
  rank: Rank;
  value: number;
}

function PokerGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [hand, setHand] = useState<CardData[]>([]);
  const [cpuHand, setCpuHand] = useState<CardData[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [gameState, setGameState] = useState<'betting' | 'dealing' | 'result'>('betting');
  const [bet, setBet] = useState(0);
  const [playerResult, setPlayerResult] = useState<{ name: string; multiplier: number; rank: number } | null>(null);
  const [cpuResult, setCpuResult] = useState<{ name: string; multiplier: number; rank: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [winStatus, setWinStatus] = useState<'win' | 'lose' | 'draw' | null>(null);

  const createDeck = () => {
    const suits: Suit[] = ['♠', '♣', '♥', '♦'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: CardData[] = [];
    suits.forEach(suit => {
      ranks.forEach((rank, i) => {
        deck.push({ suit, rank, value: i + 1 });
      });
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  const evaluateHand = (hand: CardData[]) => {
    const values = hand.map(c => c.value).sort((a, b) => a - b);
    const suits = hand.map(c => c.suit);
    
    const isFlush = new Set(suits).size === 1;
    
    let isStraight = false;
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 5) {
      if (values[4] - values[0] === 4) isStraight = true;
      if (values[0] === 1 && values[1] === 10 && values[2] === 11 && values[3] === 12 && values[4] === 13) isStraight = true;
    }

    const counts: Record<number, number> = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const countValues = Object.values(counts).sort((a, b) => b - a);

    if (isFlush && isStraight && values[0] === 1 && values[4] === 13) return { name: 'Royal Flush', multiplier: 300, rank: 9 };
    if (isFlush && isStraight) return { name: 'Straight Flush', multiplier: 60, rank: 8 };
    if (countValues[0] === 4) return { name: 'Four of a Kind', multiplier: 30, rank: 7 };
    if (countValues[0] === 3 && countValues[1] === 2) return { name: 'Full House', multiplier: 10, rank: 6 };
    if (isFlush) return { name: 'Flush', multiplier: 7, rank: 5 };
    if (isStraight) return { name: 'Straight', multiplier: 5, rank: 4 };
    if (countValues[0] === 3) return { name: 'Three of a Kind', multiplier: 4, rank: 3 };
    if (countValues[0] === 2 && countValues[1] === 2) return { name: 'Two Pair', multiplier: 3, rank: 2 };
    if (countValues[0] === 2) return { name: 'One Pair', multiplier: 2, rank: 1 };
    
    return { name: 'High Card', multiplier: 1, rank: 0 };
  };

  const handleBet = (amount: number) => {
    setBet(amount);
    const deck = createDeck();
    setHand(deck.slice(0, 5));
    setCpuHand(deck.slice(5, 10));
    setHeld([false, false, false, false, false]);
    setGameState('dealing');
    setPlayerResult(null);
    setCpuResult(null);
    setWinStatus(null);
  };

  const handleDraw = () => {
    setLoading(true);
    // Filter out cards already in hands
    const usedCards = [...hand, ...cpuHand];
    const deck = createDeck().filter(c => !usedCards.some(hc => hc.suit === c.suit && hc.rank === c.rank));
    
    // Player Draw
    const newPlayerHand = [...hand];
    let deckIdx = 0;
    held.forEach((isHeld, i) => {
      if (!isHeld) {
        newPlayerHand[i] = deck[deckIdx++];
      }
    });
    setHand(newPlayerHand);

    // CPU Draw (Simple AI: hold pairs or better)
    const cpuValues = cpuHand.map(c => c.value);
    const cpuCounts: Record<number, number> = {};
    cpuValues.forEach(v => cpuCounts[v] = (cpuCounts[v] || 0) + 1);
    
    const newCpuHand = [...cpuHand];
    cpuHand.forEach((card, i) => {
      if (cpuCounts[card.value] < 2) {
        newCpuHand[i] = deck[deckIdx++];
      }
    });
    setCpuHand(newCpuHand);

    const pRes = evaluateHand(newPlayerHand);
    const cRes = evaluateHand(newCpuHand);
    
    setPlayerResult(pRes);
    setCpuResult(cRes);
    
    let status: 'win' | 'lose' | 'draw';
    if (pRes.rank > cRes.rank) {
      status = 'win';
      onUpdate(bet * (pRes.multiplier - 1));
    } else if (pRes.rank < cRes.rank) {
      status = 'lose';
      onUpdate(-bet);
    } else {
      // Tie-breaker: High card (simplified)
      const pMax = Math.max(...newPlayerHand.map(c => c.value === 1 ? 14 : c.value));
      const cMax = Math.max(...newCpuHand.map(c => c.value === 1 ? 14 : c.value));
      if (pMax > cMax) {
        status = 'win';
        onUpdate(bet * (pRes.multiplier - 1));
      } else if (pMax < cMax) {
        status = 'lose';
        onUpdate(-bet);
      } else {
        status = 'draw';
        onUpdate(0);
      }
    }
    
    setWinStatus(status);
    setGameState('result');
    setLoading(false);
  };

  const toggleHold = (i: number) => {
    if (gameState !== 'dealing') return;
    const newHeld = [...held];
    newHeld[i] = !newHeld[i];
    setHeld(newHeld);
  };

  return (
    <GameLayout title="Poker VS CPU" onBack={onBack}>
      <Card className="flex flex-col items-center gap-6">
        {/* CPU Hand */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">CPU Hand</div>
          <div className="grid grid-cols-5 gap-2 w-full max-w-md">
            {cpuHand.length > 0 ? cpuHand.map((card, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-[2/3] bg-white rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                  gameState === 'result' ? ((card.suit === '♥' || card.suit === '♦') ? "text-rose-600" : "text-slate-900") : "bg-slate-800 border-slate-700"
                )}
              >
                {gameState === 'result' ? (
                  <>
                    <div className="text-[10px] font-bold self-start ml-1">{card.rank}</div>
                    <div className="text-xl">{card.suit}</div>
                    <div className="text-[10px] font-bold self-end mr-1 rotate-180">{card.rank}</div>
                  </>
                ) : (
                  <div className="text-slate-600 text-xl">?</div>
                )}
              </div>
            )) : Array(5).fill(0).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700" />
            ))}
          </div>
          {gameState === 'result' && cpuResult && (
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cpuResult.name}</div>
          )}
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* Player Hand */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Your Hand</div>
          <div className="grid grid-cols-5 gap-2 w-full max-w-md">
            {hand.length > 0 ? hand.map((card, i) => (
              <motion.div
                key={i}
                whileHover={gameState === 'dealing' ? { y: -5 } : {}}
                onClick={() => toggleHold(i)}
                className={cn(
                  "aspect-[2/3] bg-white rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative",
                  held[i] ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-slate-200",
                  (card.suit === '♥' || card.suit === '♦') ? "text-rose-600" : "text-slate-900"
                )}
              >
                <div className="text-[10px] font-bold self-start ml-1">{card.rank}</div>
                <div className="text-xl">{card.suit}</div>
                <div className="text-[10px] font-bold self-end mr-1 rotate-180">{card.rank}</div>
                {held[i] && (
                  <div className="absolute -top-2 bg-emerald-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    HELD
                  </div>
                )}
              </motion.div>
            )) : Array(5).fill(0).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700" />
            ))}
          </div>
          {gameState === 'result' && playerResult && (
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{playerResult.name}</div>
          )}
        </div>

        {gameState === 'betting' && (
          <div className="w-full max-w-xs">
            <BetInput balance={userData.balance} onBet={handleBet} />
          </div>
        )}

        {gameState === 'dealing' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-slate-400 text-xs">残したいカードをタップしてください</p>
            <Button onClick={handleDraw} disabled={loading} className="px-12 py-4 text-xl">
              DRAW & SHOWDOWN
            </Button>
          </div>
        )}

        {gameState === 'result' && winStatus && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <div className={cn("text-5xl font-black italic uppercase", winStatus === 'win' ? "text-emerald-400" : winStatus === 'lose' ? "text-rose-500" : "text-slate-400")}>
                {winStatus === 'win' ? 'YOU WIN!' : winStatus === 'lose' ? 'YOU LOSE' : 'DRAW'}
              </div>
              {winStatus === 'win' && playerResult && (
                <div className="text-slate-400 font-mono mt-1">{playerResult.multiplier}倍の配当！</div>
              )}
            </div>
            <Button onClick={() => setGameState('betting')} variant="secondary">もう一度プレイ</Button>
          </div>
        )}

        <div className="w-full max-w-md bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[8px] font-mono text-slate-500 uppercase tracking-widest">
            <div className="flex justify-between"><span>Royal Flush</span><span className="text-emerald-500">300x</span></div>
            <div className="flex justify-between"><span>Straight Flush</span><span className="text-emerald-500">60x</span></div>
            <div className="flex justify-between"><span>Four of a Kind</span><span className="text-emerald-500">30x</span></div>
            <div className="flex justify-between"><span>Full House</span><span className="text-emerald-500">10x</span></div>
            <div className="flex justify-between"><span>Flush</span><span className="text-emerald-500">7x</span></div>
            <div className="flex justify-between"><span>Straight</span><span className="text-emerald-500">5x</span></div>
            <div className="flex justify-between"><span>Three of a Kind</span><span className="text-emerald-500">4x</span></div>
            <div className="flex justify-between"><span>Two Pair</span><span className="text-emerald-500">3x</span></div>
            <div className="flex justify-between"><span>One Pair</span><span className="text-emerald-500">2x</span></div>
            <div className="flex justify-between"><span>High Card</span><span className="text-emerald-500">1x</span></div>
          </div>
        </div>
      </Card>
    </GameLayout>
  );
}

// 4. Blackjack
function BlackjackGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [status, setStatus] = useState<'betting' | 'playing' | 'result'>('betting');
  const [bet, setBet] = useState(0);
  const [msg, setMsg] = useState('');

  const start = (amount: number) => {
    setBet(amount);
    const p = Math.floor(Math.random() * 10) + 12;
    const c = Math.floor(Math.random() * 10) + 12;
    setPlayerScore(p);
    setCpuScore(c);
    setStatus('playing');
  };

  const hit = () => {
    const card = Math.floor(Math.random() * 10) + 1;
    const newScore = playerScore + card;
    setPlayerScore(newScore);
    if (newScore > 21) {
      end(false, 'バースト！負けです');
    }
  };

  const stand = () => {
    if (playerScore > cpuScore || cpuScore > 21) {
      end(true, '勝利！');
    } else if (playerScore === cpuScore) {
      end(false, '引き分け（没収）');
    } else {
      end(false, '敗北...');
    }
  };

  const end = async (win: boolean, message: string) => {
    setMsg(message);
    setStatus('result');
    onUpdate(win ? bet : -bet);
  };

  return (
    <GameLayout title="Blackjack" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        {status !== 'betting' && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex justify-around w-full">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase mb-1">CPU</div>
                <div className="text-4xl font-mono font-bold text-white">{status === 'result' ? cpuScore : '??'}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase mb-1">YOU</div>
                <div className="text-4xl font-mono font-bold text-emerald-400">{playerScore}</div>
              </div>
            </div>
            
            {status === 'playing' && (
              <div className="flex gap-4">
                <Button onClick={hit}>HIT</Button>
                <Button variant="secondary" onClick={stand}>STAND</Button>
              </div>
            )}

            {status === 'result' && (
              <div className="text-center space-y-4">
                <div className="text-3xl font-black italic text-white uppercase">{msg}</div>
                <Button variant="outline" onClick={() => setStatus('betting')}>もう一度</Button>
              </div>
            )}
          </div>
        )}

        {status === 'betting' && (
          <div className="w-full max-w-xs">
            <BetInput balance={userData.balance} onBet={start} />
          </div>
        )}
      </Card>
    </GameLayout>
  );
}

// 5. Russian Roulette
function RussianRouletteGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [bullets, setBullets] = useState(1);
  const [cylinder, setCylinder] = useState<boolean[]>([]);
  const [turn, setTurn] = useState<'player' | 'cpu'>('player');
  const [status, setStatus] = useState<'betting' | 'playing' | 'result'>('betting');
  const [logs, setLogs] = useState<string[]>([]);
  const [bet, setBet] = useState(0);

  const start = (amount: number) => {
    const cyl = new Array(6).fill(false);
    let placed = 0;
    while (placed < bullets) {
      const idx = Math.floor(Math.random() * 6);
      if (!cyl[idx]) {
        cyl[idx] = true;
        placed++;
      }
    }
    setBet(amount);
    setCylinder(cyl);
    setTurn('player');
    setStatus('playing');
    setLogs(['ゲーム開始。シリンダーが回転した...']);
  };

  const shoot = async (target: 'self' | 'other') => {
    const isReal = cylinder[0];
    const newCyl = cylinder.slice(1);
    setCylinder(newCyl);

    if (target === 'self') {
      if (isReal) {
        setLogs(prev => [`自分を撃った... 実弾だ！`, ...prev]);
        end(false, '敗北...');
      } else {
        setLogs(prev => [`自分を撃った... 空砲だ。`, ...prev]);
        cpuTurn(newCyl);
      }
    } else {
      if (isReal) {
        setLogs(prev => [`相手を撃った... 実弾だ！`, ...prev]);
        end(true, '勝利！');
      } else {
        setLogs(prev => [`相手を撃った... 空砲だ。`, ...prev]);
        cpuTurn(newCyl);
      }
    }
  };

  const cpuTurn = (currentCyl: boolean[]) => {
    setTurn('cpu');
    setTimeout(() => {
      const realCount = currentCyl.filter(b => b).length;
      const prob = realCount / currentCyl.length;
      const target = prob > 0.5 ? 'other' : 'self';
      
      const isReal = currentCyl[0];
      const nextCyl = currentCyl.slice(1);
      setCylinder(nextCyl);

      if (target === 'self') {
        if (isReal) {
          setLogs(prev => [`CPUが自分を撃った... 実弾だ！`, ...prev]);
          end(true, '勝利！');
        } else {
          setLogs(prev => [`CPUが自分を撃った... 空砲だ。`, ...prev]);
          setTurn('player');
        }
      } else {
        if (isReal) {
          setLogs(prev => [`CPUがあなたを撃った... 実弾だ！`, ...prev]);
          end(false, '敗北...');
        } else {
          setLogs(prev => [`CPUがあなたを撃った... 空砲だ。`, ...prev]);
          setTurn('player');
        }
      }
    }, 1500);
  };

  const end = async (win: boolean, msg: string) => {
    setStatus('result');
    onUpdate(win ? bet * 4 : -bet);
  };

  return (
    <GameLayout title="Russian Roulette" onBack={onBack}>
      <Card className="space-y-6">
        {status === 'betting' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">実弾の数 (1-4)</label>
              <div className="flex gap-2">
                {[1,2,3,4].map(n => (
                  <Button key={n} variant={bullets === n ? 'primary' : 'outline'} onClick={() => setBullets(n)} className="flex-1">{n}</Button>
                ))}
              </div>
            </div>
            <BetInput balance={userData.balance} onBet={start} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className={cn("px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest", turn === 'player' ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-500")}>
                PLAYER TURN
              </div>
              <div className="text-slate-500 font-mono text-xs">残弾: {cylinder.length}</div>
            </div>

            <div className="h-32 bg-slate-950 rounded-xl p-4 overflow-y-auto font-mono text-sm space-y-1 border border-slate-800">
              {logs.map((l, i) => <div key={i} className={i === 0 ? "text-emerald-400" : "text-slate-600"}>{l}</div>)}
            </div>

            {status === 'playing' && turn === 'player' && (
              <div className="grid grid-cols-2 gap-4">
                <Button variant="danger" onClick={() => shoot('self')}>自分を撃つ</Button>
                <Button onClick={() => shoot('other')}>相手を撃つ</Button>
              </div>
            )}

            {status === 'result' && (
              <Button variant="outline" onClick={() => setStatus('betting')} className="w-full">もう一度</Button>
            )}
          </div>
        )}
      </Card>
    </GameLayout>
  );
}

// 6. Slot
function SlotGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const symbols = ['🍒', '🔔', '🍉', '⭐', '7', '💎'];
  const [reels, setReels] = useState(['?', '?', '?']);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState('');

  const play = async (amount: number) => {
    setPlaying(true);
    setMsg('');
    
    const interval = setInterval(() => {
      setReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ]);
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      const final = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];
      setReels(final);
      
      let multiplier = 0;
      if (final[0] === final[1] && final[1] === final[2]) {
        if (final[0] === '💎') multiplier = 100;
        else if (final[0] === '7') multiplier = 50;
        else if (final[0] === '⭐') multiplier = 20;
        else if (final[0] === '🍉') multiplier = 10;
        else if (final[0] === '🔔') multiplier = 5;
        else if (final[0] === '🍒') multiplier = 3;
      } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
        multiplier = 1.5;
      }

      setMsg(multiplier > 0 ? `${multiplier}倍 WIN!` : 'LOSE...');
      onUpdate(amount * (multiplier - 1));
      setPlaying(false);
    }, 2000);
  };

  return (
    <GameLayout title="Slot Machine" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        <div className="flex gap-4 bg-slate-950 p-6 rounded-3xl border-4 border-slate-800 shadow-inner">
          {reels.map((r, i) => (
            <div key={i} className="w-20 h-28 bg-white rounded-xl flex items-center justify-center text-5xl shadow-lg">{r}</div>
          ))}
        </div>

        {msg && <div className="text-3xl font-black italic text-emerald-400 uppercase">{msg}</div>}

        <div className="w-full max-w-xs">
          <BetInput balance={userData.balance} onBet={play} />
        </div>
      </Card>
    </GameLayout>
  );
}

// 7. Pachinko
function PachinkoGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  const play = async (amount: number) => {
    setPlaying(true);
    setResult(null);
    setTimeout(async () => {
      const win = Math.random() > 0.6;
      setResult(win ? 'win' : 'lose');
      onUpdate(win ? amount * 0.5 : -amount);
      setPlaying(false);
    }, 2000);
  };

  return (
    <GameLayout title="Pachinko" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        <div className="relative w-48 h-64 bg-slate-950 rounded-3xl border-4 border-slate-800 p-4 overflow-hidden">
          <div className="grid grid-cols-5 gap-4 opacity-20">
            {Array(20).fill(0).map((_, i) => <div key={i} className="w-2 h-2 bg-white rounded-full" />)}
          </div>
          <AnimatePresence>
            {playing && (
              <motion.div
                initial={{ y: -20, x: 80 }}
                animate={{ y: 240, x: [80, 40, 120, 60, 90] }}
                transition={{ duration: 2, ease: "linear" }}
                className="absolute w-4 h-4 bg-slate-300 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              />
            )}
          </AnimatePresence>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-8 border-2 border-emerald-500 rounded-t-lg bg-emerald-500/10" />
        </div>

        {result && (
          <div className={cn("text-3xl font-black italic uppercase", result === 'win' ? "text-emerald-400" : "text-rose-500")}>
            {result === 'win' ? '1.5倍 WIN!' : 'OUT...'}
          </div>
        )}

        <div className="w-full max-w-xs">
          <BetInput balance={userData.balance} onBet={play} />
        </div>
      </Card>
    </GameLayout>
  );
}

// 8. Roulette
function RouletteGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number) => void }) {
  const [choice, setChoice] = useState<'red' | 'black' | null>(null);
  const [result, setResult] = useState<{ num: number; color: string } | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = async (amount: number) => {
    if (!choice) return alert('赤か黒か選んでください');
    setPlaying(true);
    setResult(null);
    
    setTimeout(async () => {
      const num = Math.floor(Math.random() * 51);
      let color = 'green';
      if (num > 0) {
        color = num % 2 !== 0 ? 'red' : 'black';
      }
      setResult({ num, color });
      const win = choice === color;
      onUpdate(win ? amount : -amount);
      setPlaying(false);
    }, 2000);
  };

  return (
    <GameLayout title="Roulette" onBack={onBack}>
      <Card className="flex flex-col items-center gap-8">
        <div className="flex gap-4">
          <button
            onClick={() => setChoice('red')}
            className={cn("px-8 py-4 rounded-xl border-2 font-bold transition-all", choice === 'red' ? "border-red-500 bg-red-500/20 text-red-500" : "border-slate-800 text-slate-500")}
          >
            RED (奇数)
          </button>
          <button
            onClick={() => setChoice('black')}
            className={cn("px-8 py-4 rounded-xl border-2 font-bold transition-all", choice === 'black' ? "border-slate-300 bg-slate-300/20 text-slate-300" : "border-slate-800 text-slate-500")}
          >
            BLACK (偶数)
          </button>
        </div>

        <div className="relative w-40 h-40 rounded-full border-8 border-slate-800 flex items-center justify-center bg-slate-950">
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-mono font-bold transition-all duration-500",
            playing ? "animate-spin opacity-50" : "",
            result?.color === 'red' ? "bg-red-600 text-white" : result?.color === 'black' ? "bg-slate-200 text-slate-900" : "bg-emerald-600 text-white"
          )}>
            {playing ? '?' : result?.num ?? '0'}
          </div>
        </div>

        {result && (
          <div className={cn("text-3xl font-black italic uppercase", result.color === choice ? "text-emerald-400" : "text-rose-500")}>
            {result.color === 'green' ? '0 (GREEN)' : result.color.toUpperCase()} - {result.color === choice ? 'WIN!' : 'LOSE...'}
          </div>
        )}

        <div className="w-full max-w-xs">
          <BetInput balance={userData.balance} onBet={play} />
        </div>
      </Card>
    </GameLayout>
  );
}

// 9. FX
interface Position {
  id: string;
  type: 'buy' | 'sell';
  entryRate: number;
  units: number;
  leverage: number;
  timestamp: number;
}

function FXGame({ userData, onBack, onUpdate }: { userData: UserData; onBack: () => void; onUpdate: (diff: number, accountDiff?: number, faDiff?: number, unitRev?: string) => void }) {
  const [rate, setRate] = useState(150);
  const [history, setHistory] = useState<number[]>([]);
  const [units, setUnits] = useState(1000);
  const [leverage, setLeverage] = useState(25);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  // Rate calculation based on time for 1-hour cycle
  const calculateRate = () => {
    const now = Date.now() / 1000;
    const cycle = 3600; // 1 hour
    const base = 150;
    const amp = 5;
    // Sine wave + some deterministic noise based on time
    const sine = Math.sin((2 * Math.PI * now) / cycle);
    const noise = Math.sin(now / 10) * 0.2 + Math.sin(now / 2) * 0.05;
    return base + amp * sine + noise;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const currentRate = calculateRate();
      setRate(currentRate);
      setHistory(prev => [...prev.slice(-29), currentRate]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load positions from localStorage to persist them
  useEffect(() => {
    const saved = localStorage.getItem(`fx_positions_${userData.userId}`);
    if (saved) {
      try {
        setPositions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load positions", e);
      }
    }
  }, [userData.userId]);

  useEffect(() => {
    localStorage.setItem(`fx_positions_${userData.userId}`, JSON.stringify(positions));
  }, [positions, userData.userId]);

  const openPosition = (type: 'buy' | 'sell') => {
    const requiredMargin = (units * rate) / leverage;
    if (requiredMargin > userData.faBalance) {
      return alert(`証拠金が足りません。必要証拠金: ${Math.ceil(requiredMargin).toLocaleString()} もっち`);
    }

    const newPos: Position = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      entryRate: rate,
      units,
      leverage,
      timestamp: Date.now()
    };

    // Deduct margin from FX account (In this simplified model, we just check if they have it, 
    // but the actual balance only changes on settlement. 
    // However, to be more realistic, we could "lock" the margin. 
    // For now, let's just allow opening if they have the balance.)
    setPositions(prev => [newPos, ...prev]);
  };

  const settlePosition = (pos: Position) => {
    const pl = pos.type === 'buy' 
      ? (rate - pos.entryRate) * pos.units 
      : (pos.entryRate - rate) * pos.units;
    
    setLoading(true);
    onUpdate(0, 0, Math.floor(pl));
    setPositions(prev => prev.filter(p => p.id !== pos.id));
    setLoading(false);
  };

  return (
    <GameLayout title="FX Trading" onBack={onBack}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Info */}
        <Card className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">USD / MOCCHI</div>
              <div className="text-5xl font-mono font-black text-white">{rate.toFixed(3)}</div>
            </div>
            <div className={cn("text-xl font-mono font-bold px-3 py-1 rounded-lg", rate > (history[history.length-2] || rate) ? "text-emerald-400 bg-emerald-400/10" : "text-rose-500 bg-rose-500/10")}>
              {rate > (history[history.length-2] || rate) ? '▲' : '▼'} {(Math.abs(rate - (history[history.length-2] || rate))).toFixed(3)}
            </div>
          </div>

          <div className="h-48 bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {(() => {
                if (history.length < 2) return null;
                const min = Math.min(...history);
                const max = Math.max(...history);
                const range = (max - min) || 0.001;
                
                const points = history.map((h, i) => {
                  const x = (i / (history.length - 1)) * 100;
                  const y = 100 - ((h - min) / range) * 90 - 5; // 5% padding
                  return `${x},${y}`;
                }).join(' ');

                const isUp = rate >= (history[history.length - 2] || rate);

                return (
                  <>
                    <defs>
                      <linearGradient id="fx-gradient-up" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="fx-gradient-down" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M 0,100 L ${points} L 100,100 Z`}
                      fill={isUp ? "url(#fx-gradient-up)" : "url(#fx-gradient-down)"}
                      className="transition-all duration-500"
                    />
                    <polyline
                      fill="none"
                      stroke={isUp ? "#10b981" : "#f43f5e"}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={points}
                      className="transition-all duration-500"
                    />
                    {/* Current Price Dot */}
                    <circle
                      cx="100"
                      cy={100 - ((rate - min) / range) * 90 - 5}
                      r="3"
                      fill={isUp ? "#10b981" : "#f43f5e"}
                      className="transition-all duration-500"
                    />
                  </>
                );
              })()}
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">注文数量 (Units)</label>
                <input
                  type="number"
                  value={units}
                  onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">レバレッジ (Max 25x)</label>
                <select
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={1}>1x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                  <option value={25}>25x</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <div className="text-right text-xs text-slate-500 uppercase tracking-widest mb-1">
                必要証拠金: <span className="text-white font-mono">
                  {(() => {
                    const { value, unit } = getMocchiParts((units * rate) / leverage);
                    return `${value} ${unit}`;
                  })()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => openPosition('buy')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black italic text-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                >
                  BUY
                </button>
                <button
                  onClick={() => openPosition('sell')}
                  className="bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-black italic text-xl transition-all active:scale-95 shadow-lg shadow-rose-900/20"
                >
                  SELL
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Positions List */}
        <Card className="space-y-4 flex flex-col h-full">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> 保有ポジション
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {positions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs uppercase tracking-widest">ポジションはありません</p>
              </div>
            ) : (
              positions.map(pos => {
                const pl = pos.type === 'buy' 
                  ? (rate - pos.entryRate) * pos.units 
                  : (pos.entryRate - rate) * pos.units;
                return (
                  <div key={pos.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase", pos.type === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                          {pos.type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{pos.units.toLocaleString()} units @ {pos.entryRate.toFixed(3)}</span>
                      </div>
                      <div className={cn("text-sm font-mono font-bold", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {(() => {
                          const { value, unit } = getMocchiParts(Math.floor(pl));
                          return `${pl >= 0 ? '+' : ''}${value} ${unit}`;
                        })()}
                      </div>
                    </div>
                    <Button 
                      variant="secondary" 
                      className="w-full py-1 text-xs" 
                      onClick={() => settlePosition(pos)}
                      disabled={loading}
                    >
                      決済する
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest">
              <span>合計損益</span>
              <span className={cn("font-bold", positions.reduce((acc, pos) => acc + (pos.type === 'buy' ? (rate - pos.entryRate) * pos.units : (pos.entryRate - rate) * pos.units), 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {(() => {
                  const totalPl = positions.reduce((acc, pos) => acc + (pos.type === 'buy' ? (rate - pos.entryRate) * pos.units : (pos.entryRate - rate) * pos.units), 0);
                  const { value, unit } = getMocchiParts(Math.floor(totalPl));
                  return `${value} ${unit}`;
                })()}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </GameLayout>
  );
}
