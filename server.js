import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'MIT';
const SPREADSHEET_ID = '1WiroZKCMbpYO4MK9bVJsQK2HY3Rm6pZibJu5uuqMACg';
const SERVICE_ACCOUNT_EMAIL = 'mit-admin@motch-casino.iam.gserviceaccount.com';
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('Server starting with config:', {
  PORT,
  SPREADSHEET_ID,
  SERVICE_ACCOUNT_EMAIL,
  HAS_PRIVATE_KEY: !!PRIVATE_KEY,
  HAS_GMAIL_PASS: !!process.env.GMAIL_APP_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mitsuba.login.authentication@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD, // This must be an App Password
  },
});

let cachedSheet: any = null;
let lastSheetLoad = 0;
const SHEET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSheet() {
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    throw new Error('Google Sheets credentials are not set in environment variables.');
  }

  const now = Date.now();
  if (cachedSheet && (now - lastSheetLoad < SHEET_CACHE_TTL)) {
    return cachedSheet;
  }

  const auth = new JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['Users'];
  if (!sheet) throw new Error('Sheet "Users" not found.');
  
  cachedSheet = sheet;
  lastSheetLoad = now;
  return sheet;
}

async function checkLoanRepayment(userRow: any) {
  const loanAmount = parseInt(userRow.get('LoanAmount') || '0');
  const loanDue = userRow.get('LoanDue');

  if (loanAmount > 0 && loanDue) {
    const dueDate = new Date(loanDue);
    if (new Date() >= dueDate) {
      let currentFA = parseInt(userRow.get('FA') || '0');
      let currentAccount = parseInt(userRow.get('Account') || '0');
      let remainingLoan = loanAmount;

      // 1. Try to deduct from FX account
      if (currentFA >= remainingLoan) {
        currentFA -= remainingLoan;
        remainingLoan = 0;
      } else {
        remainingLoan -= currentFA;
        currentFA = 0;
      }

      // 2. If still remaining, try to deduct from Bank account
      if (remainingLoan > 0) {
        if (currentAccount >= remainingLoan) {
          currentAccount -= remainingLoan;
          remainingLoan = 0;
        } else {
          // Both combined are not enough
          currentAccount = 0;
          remainingLoan = 0; // Loan is cleared regardless (as per request: "どちらも0にして")
        }
      }

      userRow.set('FA', currentFA.toString());
      userRow.set('Account', currentAccount.toString());
      userRow.set('LoanAmount', '0');
      userRow.set('LoanDue', '');
      await userRow.save();
      console.log(`Loan settled for user ${userRow.get('ID')}. FA: ${currentFA}, Account: ${currentAccount}`);
    }
  }
}

async function applyInterest(userRow: any) {
  const accountBalance = parseInt(userRow.get('Account') || '0');
  const lastInterestStr = userRow.get('LastInterest');
  if (accountBalance <= 0 || !lastInterestStr) {
    userRow.set('LastInterest', new Date().toISOString());
    await userRow.save();
    return;
  }

  const lastInterest = new Date(lastInterestStr);
  const now = new Date();
  const diffMs = now.getTime() - lastInterest.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= 1) {
    const dailyRate = 0.072; // 7.2%
    const interest = Math.floor(accountBalance * dailyRate * Math.floor(diffDays));
    if (interest > 0) {
      userRow.set('Account', (accountBalance + interest).toString());
      // Update last interest date to the last full day processed
      const processedDate = new Date(lastInterest.getTime() + Math.floor(diffDays) * 24 * 60 * 60 * 1000);
      userRow.set('LastInterest', processedDate.toISOString());
      await userRow.save();
      console.log(`Interest applied for user ${userRow.get('ID')}: ${interest}`);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // --- API Routes ---

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Register
  app.post('/api/register', async (req, res) => {
    try {
      const { userId, email, password, displayName } = req.body;
      
      if (!userId || !email || !password || !displayName) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const sheet = await getSheet();
      const rows = await sheet.getRows();
      
      if (rows.find(r => r.get('ID') === userId)) {
        return res.status(400).json({ error: 'User ID already exists' });
      }

      if (rows.find(r => r.get('email') === email)) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      
      await sheet.addRow({
        ID: userId,
        Name: displayName,
        Pass: passwordHash,
        Auth: 'false',
        email: email,
        Money: '10000',
        Account: '1000000',
        FA: '0',
        UnitRev: '',
        LoanAmount: '0',
        LoanDue: '',
        LastInterest: new Date().toISOString()
      });

      // Update in-memory ranking
      if (isRankingInitialized) {
        allRankings.push({
          userId,
          displayName,
          balance: 10000
        });
      }

      // Send real verification email
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${appUrl}/api/verify?userId=${userId}`;
      await transporter.sendMail({
        from: '"Mocchi Casino" <mitsuba.login.authentication@gmail.com>',
        to: email,
        subject: '【Mocchi Casino】メールアドレスの確認',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #059669;">Mocchi Casino へようこそ！</h2>
            <p>ご登録ありがとうございます。以下のボタンをクリックして、メールアドレスの認証を完了させてください。</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">メールアドレスを認証する</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">※このメールに心当たりがない場合は、破棄してください。</p>
          </div>
        `,
      });

      res.json({ message: '登録が完了しました。認証メールを確認してください。' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Login
  app.post(['/api/login', '/api/login/'], async (req, res) => {
    console.log(`Login attempt for: ${req.body.email}`);
    try {
      const { email, password } = req.body;
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('email') === email);

      if (!userRow) {
        console.log('User not found');
        return res.status(401).json({ error: 'ユーザーが見つかりません' });
      }

      const isPasswordValid = await bcrypt.compare(password, userRow.get('Pass'));
      if (!isPasswordValid) {
        console.log('Invalid password');
        return res.status(401).json({ error: 'パスワードが正しくありません' });
      }

      // Handle both string 'true' and boolean true from Sheets
      const authStatus = String(userRow.get('Auth')).toLowerCase();
      console.log(`Auth status for ${email}: ${authStatus}`);
      
      if (authStatus !== 'true') {
        return res.status(403).json({ error: 'メール認証が完了していません。届いたメールを確認してください。' });
      }

      // Check loan and interest
      await checkLoanRepayment(userRow);
      await applyInterest(userRow);

      const token = jwt.sign({ userId: userRow.get('ID') }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      console.log('Login successful');
      res.json({
        userId: userRow.get('ID'),
        displayName: userRow.get('Name'),
        email: userRow.get('email'),
        balance: parseInt(userRow.get('Money')),
        accountBalance: parseInt(userRow.get('Account')),
        faBalance: parseInt(userRow.get('FA')),
        unitRev: userRow.get('UnitRev'),
        loanAmount: parseInt(userRow.get('LoanAmount') || '0'),
        loanDue: userRow.get('LoanDue') || '',
        lastInterest: userRow.get('LastInterest')
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
  });

  // Verify Email
  app.get('/api/verify', async (req, res) => {
    try {
      const { userId } = req.query;
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === userId);

      if (userRow) {
        userRow.set('Auth', 'true');
        await userRow.save();
        res.send('<h1>Email verified! You can now login.</h1><a href="/">Go to App</a>');
      } else {
        res.status(404).send('User not found');
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).send('Error verifying email');
    }
  });

  // Get Me
  app.get('/api/me', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      // Check loan and interest
      await checkLoanRepayment(userRow);
      await applyInterest(userRow);

      res.json({
        userId: userRow.get('ID'),
        displayName: userRow.get('Name'),
        email: userRow.get('email'),
        balance: parseInt(userRow.get('Money')),
        accountBalance: parseInt(userRow.get('Account')),
        faBalance: parseInt(userRow.get('FA')),
        unitRev: userRow.get('UnitRev'),
        loanAmount: parseInt(userRow.get('LoanAmount') || '0'),
        loanDue: userRow.get('LoanDue') || '',
        lastInterest: userRow.get('LastInterest')
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  });

  // Update Balance
  app.post('/api/update-balance', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const { diff, accountDiff = 0, faDiff = 0, unitRev } = req.body;
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      const newBalance = parseInt(userRow.get('Money')) + diff;
      const newAccountBalance = parseInt(userRow.get('Account')) + accountDiff;
      const newFaBalance = parseInt(userRow.get('FA')) + faDiff;

      if (newBalance < 0 || newAccountBalance < 0 || newFaBalance < 0) {
        return res.status(400).json({ error: 'Insufficient funds' });
      }

      userRow.set('Money', newBalance.toString());
      userRow.set('Account', newAccountBalance.toString());
      userRow.set('FA', newFaBalance.toString());
      if (unitRev !== undefined) userRow.set('UnitRev', unitRev);
      
      await userRow.save();

      // Update in-memory ranking
      const rankingIdx = allRankings.findIndex(r => r.userId === decoded.userId);
      if (rankingIdx !== -1) {
        allRankings[rankingIdx].balance = newBalance;
      } else if (isRankingInitialized) {
        // This shouldn't happen if initialized, but for safety:
        allRankings.push({
          userId: decoded.userId,
          displayName: userRow.get('Name'),
          balance: newBalance
        });
      }

      res.json({ 
        balance: newBalance, 
        accountBalance: newAccountBalance, 
        faBalance: newFaBalance,
        unitRev: userRow.get('UnitRev')
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Refill
  app.post('/api/refill', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });
      if (parseInt(userRow.get('Money')) > 0) {
        return res.status(400).json({ error: 'Balance must be 0 to refill' });
      }

      userRow.set('Money', '10000');
      await userRow.save();
      res.json({ balance: 10000 });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Bank Deposit
  app.post('/api/bank/deposit', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const { amount, target } = req.body; // target: 'account' | 'fa'
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      const currentMoney = parseInt(userRow.get('Money'));
      if (currentMoney < amount) return res.status(400).json({ error: 'Insufficient funds in wallet' });

      if (target === 'account') {
        userRow.set('Money', (currentMoney - amount).toString());
        userRow.set('Account', (parseInt(userRow.get('Account')) + amount).toString());
      } else if (target === 'fa') {
        userRow.set('Money', (currentMoney - amount).toString());
        userRow.set('FA', (parseInt(userRow.get('FA')) + amount).toString());
      } else {
        return res.status(400).json({ error: 'Invalid target' });
      }

      await userRow.save();
      res.json({
        balance: parseInt(userRow.get('Money')),
        accountBalance: parseInt(userRow.get('Account')),
        faBalance: parseInt(userRow.get('FA'))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bank Withdraw
  app.post('/api/bank/withdraw', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const { amount, source } = req.body; // source: 'account' | 'fa'
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      if (source === 'account') {
        const currentAccount = parseInt(userRow.get('Account'));
        if (currentAccount < amount) return res.status(400).json({ error: 'Insufficient funds in bank account' });
        userRow.set('Account', (currentAccount - amount).toString());
        userRow.set('FA', (parseInt(userRow.get('FA')) + amount).toString());
      } else if (source === 'fa') {
        const currentFA = parseInt(userRow.get('FA'));
        if (currentFA < amount) return res.status(400).json({ error: 'Insufficient funds in FX account' });
        userRow.set('FA', (currentFA - amount).toString());
        userRow.set('Account', (parseInt(userRow.get('Account')) + amount).toString());
      } else {
        return res.status(400).json({ error: 'Invalid source' });
      }

      await userRow.save();
      res.json({
        balance: parseInt(userRow.get('Money')),
        accountBalance: parseInt(userRow.get('Account')),
        faBalance: parseInt(userRow.get('FA'))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bank Loan
  app.post('/api/bank/loan', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      const currentLoan = parseInt(userRow.get('LoanAmount') || '0');
      if (currentLoan > 0) return res.status(400).json({ error: 'Already have an active loan' });

      const loanAmount = 500000;
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 20);

      userRow.set('FA', (parseInt(userRow.get('FA')) + loanAmount).toString());
      userRow.set('LoanAmount', loanAmount.toString());
      userRow.set('LoanDue', dueDate.toISOString());

      await userRow.save();
      res.json({
        faBalance: parseInt(userRow.get('FA')),
        loanAmount: loanAmount,
        loanDue: dueDate.toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Display Name
  app.post('/api/user/update-name', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const { displayName } = req.body;
      if (!displayName) return res.status(400).json({ error: 'Display name is required' });

      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      userRow.set('Name', displayName);
      await userRow.save();

      // Update in-memory ranking
      if (isRankingInitialized) {
        const rankingIdx = allRankings.findIndex(r => r.userId === decoded.userId);
        if (rankingIdx !== -1) {
          allRankings[rankingIdx].displayName = displayName;
        }
      }

      res.json({ message: 'Display name updated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete User Account
  app.post('/api/user/delete', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      const userIdToDelete = decoded.userId;
      await userRow.delete();

      // Update in-memory ranking
      if (isRankingInitialized) {
        allRankings = allRankings.filter(r => r.userId !== userIdToDelete);
      }

      res.clearCookie('token');
      res.json({ message: 'Account deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bank Recovery
  app.post('/api/bank/recover', async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: 'Not logged in' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      const userRow = rows.find(r => r.get('ID') === decoded.userId);

      if (!userRow) return res.status(404).json({ error: 'User not found' });

      const currentAccount = parseInt(userRow.get('Account') || '0');
      if (currentAccount > 0) {
        return res.status(400).json({ error: '銀行口座に残高がある場合は申請できません。' });
      }

      userRow.set('Account', '1000000');
      await userRow.save();

      res.json({ accountBalance: 1000000, message: '銀行口座を100万もっちに復旧しました。' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // In-Memory Ranking Store
  interface RankingEntry {
    userId: string;
    displayName: string;
    balance: number;
  }
  let allRankings: RankingEntry[] = [];
  let isRankingInitialized = false;

  async function initializeRankings() {
    try {
      const sheet = await getSheet();
      const rows = await sheet.getRows();
      allRankings = rows.map(r => ({
        userId: r.get('ID'),
        displayName: r.get('Name'),
        balance: parseInt(r.get('Money')) || 0
      }));
      isRankingInitialized = true;
      console.log(`Rankings initialized with ${allRankings.length} users.`);
    } catch (err) {
      console.error('Failed to initialize rankings:', err);
    }
  }

  // Periodic re-sync every 10 minutes
  setInterval(() => {
    if (isRankingInitialized) {
      initializeRankings();
    }
  }, 10 * 60 * 1000);

  // Ranking
  app.get('/api/ranking', async (req, res) => {
    try {
      if (!isRankingInitialized) {
        await initializeRankings();
      }

      const top10 = [...allRankings]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map(({ displayName, balance }) => ({ displayName, balance }));

      res.json(top10);
    } catch (err: any) {
      console.error('Ranking Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Error Handler
  app.use('/api/*', (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
