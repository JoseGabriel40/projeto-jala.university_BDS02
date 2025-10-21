// server.js: Servidor Express com APIs RESTful para o Sistema de Biblioteca
// Contém a lógica do servidor, middlewares de autenticação, CRUD e inicialização do DB.

// Importa o framework web Express para criar o servidor e rotas
const express = require('express');
// Importa o CORS para permitir requisições do frontend
const cors = require('cors');
// Importa o objeto de conexão Neon
const { sql } = require('./database');

// Inicializa o aplicativo Express
const app = express();
const PORT = 3000;

// === Middlewares Globais ===
// Middleware para processar corpos de requisição no formato JSON
app.use(express.json());
// Middleware para habilitar o CORS
app.use(cors());

// Serve a página de login na raiz e arquivos estáticos do frontend
app.use(express.static('../frontend'));
app.get('/', (req, res) => {
  // Redireciona a requisição raiz para a página de login
  res.sendFile(__dirname + '/../frontend/login.html');
});

// === Variável de Sessão Simples em Memória ===
// Armazena tokens de sessão de usuários logados (simulação de sessão)
const fake_sessions = {};

// === FUNÇÕES DE MIDDLEWARE ===

// Middleware para verificar se o usuário está autenticado
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token']; // Obtém o token do cabeçalho
  const session = fake_sessions[token]; // Busca a sessão
  if (!token || !session) {
    // Se falhar, retorna 401 (Não Autorizado)
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
  // Adiciona os dados do usuário logado à requisição
  req.user = session.user;
  next(); // Continua
}

// Middleware para verificar se o usuário é administrador (permissão de escrita/config)
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    // Se falhar, retorna 403 (Acesso Negado)
    return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador.' });
  }
  next(); // Continua
}

// === FUNÇÕES AUXILIARES DE BACKEND ===

// Função para lidar com erros do servidor e responder ao cliente
function handleServerError(res, err, message) {
  console.error(message, err.message);
  res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
}

// Função de lógica de negócio: Calcula o valor da multa por atraso
async function calculateFine(returnDate, loanStatus) {
  if (loanStatus === 'Devolvido' || loanStatus === 'Em andamento') {
    return 0;
  }

  const settings = await sql`SELECT fine_per_day FROM settings WHERE id = 1`;
  if (settings.length === 0) return 0;

  const finePerDay = parseFloat(settings[0].fine_per_day);
  const today = new Date();
  const dueDate = new Date(returnDate);

  if (today > dueDate) {
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Dias de atraso
    return (diffDays * finePerDay).toFixed(2);
  }

  return 0;
}

// Função de inicialização: Cria tabelas e insere dados iniciais no banco
async function initializeDatabaseAndData() {
  try {
    console.log('⏳ Inicializando estrutura do banco...');

    // --- Criação de tabelas (PostgreSQL DDL) ---
    await sql.query(`
            CREATE TABLE IF NOT EXISTS books (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                publisher TEXT,
                year INTEGER,
                isbn TEXT,
                category TEXT,
                quantity INTEGER DEFAULT 1,
                available BOOLEAN DEFAULT TRUE
            );
        `);

    await sql.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'common',
                year INTEGER,
                class TEXT,
                course TEXT
            );
        `);

    // Lógica de migração: Adiciona colunas se estiverem faltando (Corrige o erro de login 42703)
    try {
      await sql.query(`ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT '123'`);
      await sql.query(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'common'`);
      console.log('🔄 Colunas de autenticação (password, role) reforçadas.');
    } catch (e) { /* Ignora o erro se as colunas já existirem */ }


    await sql.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                book_id INTEGER NOT NULL REFERENCES books(id),
                loan_date DATE DEFAULT CURRENT_DATE,
                return_date DATE,
                status TEXT DEFAULT 'Em andamento'
            );
        `);

    await sql.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                days_for_return INTEGER DEFAULT 14,
                fine_per_day NUMERIC(10, 2) DEFAULT 2.00,
                notification_days INTEGER DEFAULT 2
            );
        `);

    console.log('🗂️ Estrutura do banco verificada/criada.');

    // === Inserção de Dados Iniciais (Para Logins e Conteúdo) ===
    const countUsers = await sql.query('SELECT COUNT(*) AS count FROM users');

    if (parseInt(countUsers[0].count) < 2) {
      console.log('📚 Inserindo usuários iniciais (Admin e Comum)...');

      await sql`
                INSERT INTO users (name, email, password, role, year, class, course) VALUES
                ('Admin Master', 'admin@bib.com', 'admin123', 'admin', 2024, '0A', 'Administracao') ON CONFLICT (email) DO NOTHING,
                ('João Silva', 'joao.silva@teste.com', '123', 'common', 2023, '3A', 'Desenvolvimento') ON CONFLICT (email) DO NOTHING
            `;
    }

    const countBooks = await sql`SELECT COUNT(*) AS count FROM books`;
    if (parseInt(countBooks[0].count) === 0) {
      console.log('📚 Inserindo livros de exemplo...');
      await sql`
                INSERT INTO books (title, author, publisher, year, isbn, category, quantity) VALUES
                ('Dom Casmurro', 'Machado de Assis', 'Editora Globo', 1899, '978-8525406552', 'Literatura', 3),
                ('O Cortiço', 'Aluísio Azevedo', 'Editora Ática', 1890, '978-8508117346', 'Literatura', 2),
                ('Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'Editora Nova Fronteira', 1881, '978-8520925683', 'Literatura', 2)
            `;
    }

    const countSettings = await sql`SELECT COUNT(*) AS count FROM settings`;
    if (parseInt(countSettings[0].count) === 0) {
      await sql`
                INSERT INTO settings (id, days_for_return, fine_per_day, notification_days)
                VALUES (1, 14, 2.00, 2);
            `;
    }

    console.log('✅ Estrutura e dados iniciais prontos.');
  } catch (err) {
    console.error('❌ Erro na inicialização do banco de dados:', err.message);
  }
}


// === ROTAS DE AUTENTICAÇÃO E CADASTRO (PÚBLICAS) ===

// POST /api/login: Processa o login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const result = await sql`
            SELECT id, name, email, role
            FROM users
            WHERE email = ${email} AND password = ${password}
        `;

    if (result.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = result[0];
    const token = Math.random().toString(36).substring(2);

    fake_sessions[token] = { user, timestamp: Date.now() };

    res.json({
      token,
      message: 'Login bem-sucedido!',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    handleServerError(res, err, 'ERRO CRÍTICO NO LOGIN:');
  }
});

// POST /api/register: Rota pública para cadastro de novos usuários COMUNS (NOVO)
app.post('/api/register', async (req, res) => {
  const { name, email, password, year, class: turma, course } = req.body;

  // Validação mínima: impede cadastro sem dados essenciais
  if (!name || !email || !password || !turma || !course) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  // A role é SEMPRE 'common' nesta rota pública
  const role = 'common';

  try {
    const result = await sql`
            INSERT INTO users (name, email, password, role, year, class, course)
            VALUES (${name}, ${email}, ${password}, ${role}, ${year}, ${turma}, ${course})
            RETURNING id, name, email, role
        `;
    res.json({ message: 'Cadastro realizado com sucesso! Você pode fazer login.', user: result[0] });
  } catch (err) {
    // Erro 23505 (duplicate key) é para e-mail já cadastrado
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }
    handleServerError(res, err, 'ERRO CRÍTICO NO CADASTRO:');
  }
});

// POST /api/logout: Encerra a sessão
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  delete fake_sessions[token]; // Remove o token da lista de sessões ativas
  res.json({ message: 'Logout realizado com sucesso.' });
});


// === APLICAÇÃO DO MIDDLEWARE DE AUTENTICAÇÃO (PROTEGE TODAS AS ROTAS ABAIXO) ===
app.use('/api', authMiddleware);


// --- ROTAS PROTEGIDAS (CRUD, Empréstimos, Relatórios, Configurações) ---

app.get('/api/settings', async (req, res) => {
  // ... (restante do código da rota /api/settings - GET)
  try {
    const settings = await sql.query('SELECT days_for_return, fine_per_day, notification_days FROM settings WHERE id = 1');
    if (settings.length === 0) {
      return res.json({ days_for_return: 14, fine_per_day: 2.00, notification_days: 2 });
    }
    res.json(settings[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao buscar configurações:');
  }
});

app.post('/api/settings', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/settings - POST)
  const { days_for_return, fine_per_day, notification_days } = req.body;

  if (days_for_return === undefined || fine_per_day === undefined || notification_days === undefined) {
    return res.status(400).json({ error: 'Todos os campos de configuração são obrigatórios.' });
  }

  try {
    await sql`
            UPDATE settings
            SET days_for_return = ${days_for_return},
                fine_per_day = ${fine_per_day},
                notification_days = ${notification_days}
            WHERE id = 1
        `;
    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (err) {
    handleServerError(res, err, 'Erro ao salvar configurações:');
  }
});


// --- Livros (CRUD) ---
app.get('/api/books', async (req, res) => {
  // ... (restante do código da rota /api/books - GET)
  try {
    const books = await sql.query('SELECT * FROM books ORDER BY id');
    res.json(books);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar livros:');
  }
});

app.post('/api/books', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/books - POST)
  const { title, author, publisher, year, isbn, category, quantity } = req.body;
  if (!title || !author || !quantity) {
    return res.status(400).json({ error: 'Título, autor e quantidade são obrigatórios' });
  }

  try {
    const result = await sql`
        INSERT INTO books (title, author, publisher, year, isbn, category, quantity, available)
        VALUES (${title}, ${author}, ${publisher}, ${year}, ${isbn}, ${category}, ${quantity}, ${quantity > 0})
        RETURNING *
        `;
    res.json(result[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao criar livro:');
  }
});

app.put('/api/books/:id', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/books - PUT)
  const { id } = req.params;
  const { title, author, publisher, year, isbn, category, quantity } = req.body;

  if (!title || !author || !quantity) {
    return res.status(400).json({ error: 'Título, autor e quantidade são obrigatórios' });
  }

  try {
    const result = await sql`
            UPDATE books
            SET title = ${title},
                author = ${author},
                publisher = ${publisher},
                year = ${year},
                isbn = ${isbn},
                category = ${category},
                quantity = ${quantity},
                available = ${quantity > 0}
            WHERE id = ${id}
            RETURNING *
        `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }
    res.json(result[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao atualizar livro:');
  }
});

app.delete('/api/books/:id', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/books - DELETE)
  const { id } = req.params;
  try {
    const activeLoans = await sql`SELECT COUNT(*) FROM loans WHERE book_id = ${id} AND status != 'Devolvido'`;
    if (parseInt(activeLoans[0].count) > 0) {
      return res.status(400).json({ error: 'Não é possível excluir livro com empréstimos ativos.' });
    }

    await sql`DELETE FROM books WHERE id = ${id}`;
    res.json({ message: 'Livro excluído com sucesso!' });
  } catch (err) {
    handleServerError(res, err, 'Erro ao excluir livro:');
  }
});


// --- Usuários (CRUD) ---
app.get('/api/users', async (req, res) => {
  // ... (restante do código da rota /api/users - GET)
  try {
    const users = await sql.query('SELECT id, name, email, year, class, course, role FROM users ORDER BY id');
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar usuários:');
  }
});

app.post('/api/users', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/users - POST)
  const { name, email, password, year, class: turma, course, role } = req.body;
  if (!name || !email || !password || !turma || !course) {
    return res.status(400).json({ error: 'Nome, email, senha, turma e curso são obrigatórios' });
  }

  if (role === 'admin') {
    const adminCount = await sql`SELECT COUNT(*) FROM users WHERE role = 'admin'`;
    if (parseInt(adminCount[0].count) > 0) {
      return res.status(400).json({ error: 'Já existe um administrador. Apenas 1 administrador principal é permitido.' });
    }
  }

  const finalRole = role || 'common';

  try {
    const result = await sql`
      INSERT INTO users (name, email, password, year, class, course, role)
      VALUES (${name}, ${email}, ${password}, ${year}, ${turma}, ${course}, ${finalRole})
      RETURNING id, name, email, role
    `;
    res.json(result[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao criar usuário:');
  }
});

app.put('/api/users/:id', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/users - PUT)
  const { id } = req.params;
  const { name, email, year, class: turma, course, password, role } = req.body;

  if (!name || !email || !turma || !course) {
    return res.status(400).json({ error: 'Nome, email, turma e curso são obrigatórios' });
  }

  try {
    const result = await sql`
            UPDATE users
            SET name = ${name},
                email = ${email},
                year = ${year},
                class = ${turma},
                course = ${course},
                password = ${password},
                role = ${role}
            WHERE id = ${id}
            RETURNING id, name, email, role
        `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json(result[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao atualizar usuário:');
  }
});

app.delete('/api/users/:id', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/users - DELETE)
  const { id } = req.params;
  try {
    const activeLoans = await sql`SELECT COUNT(*) FROM loans WHERE user_id = ${id} AND status != 'Devolvido'`;
    if (parseInt(activeLoans[0].count) > 0) {
      return res.status(400).json({ error: 'Não é possível excluir usuário com empréstimos ativos.' });
    }

    await sql`DELETE FROM users WHERE id = ${id}`;
    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (err) {
    handleServerError(res, err, 'Erro ao excluir usuário:');
  }
});

app.get('/api/users/search-by-name', async (req, res) => {
  // ... (restante do código da rota /api/users/search-by-name)
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'O parâmetro de busca (query) é obrigatório.' });
  }

  try {
    const searchQuery = `%${query}%`;
    const users = await sql`
            SELECT id, name, email, class, course
            FROM users
            WHERE name ILIKE ${searchQuery}
            LIMIT 10
        `;
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao buscar usuários por nome:');
  }
});


// --- Empréstimos, Devolução, Relatórios ---
app.get('/api/loans', async (req, res) => {
  // ... (restante do código da rota /api/loans - GET)
  const query = `
        SELECT l.id, u.name as user, b.title as book, l.loan_date, l.return_date, l.status
        FROM loans l
          JOIN users u ON l.user_id = u.id
          JOIN books b ON l.book_id = b.id
        ORDER BY l.loan_date DESC
    `;
  try {
    const loans = await sql.query(query);

    const today = new Date().toISOString().split('T')[0];

    const loansWithFine = await Promise.all(loans.map(async (row) => {
      const currentStatus = (row.return_date && row.return_date < today && row.status === 'Em andamento')
        ? 'Atrasado'
        : row.status;

      const fineAmount = await calculateFine(row.return_date, currentStatus);

      return {
        ...row,
        status: currentStatus,
        fine: fineAmount,
        return_date: row.return_date instanceof Date ? row.return_date.toISOString().split('T')[0] : row.return_date
      };
    }));

    res.json(loansWithFine);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar empréstimos:');
  }
});

app.post('/api/loans', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/loans - POST)
  const { user_id, book_id, return_date } = req.body;
  if (!user_id || !book_id) {
    return res.status(400).json({ error: 'ID de Usuário e ID de Livro são obrigatórios' });
  }

  let finalReturnDate = return_date;

  if (!finalReturnDate) {
    try {
      const settings = await sql`SELECT days_for_return FROM settings WHERE id = 1`;
      const days = settings.length > 0 ? settings[0].days_for_return : 14;

      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + days);

      finalReturnDate = dueDate.toISOString().split('T')[0];
    } catch(err) {
      finalReturnDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  }

  try {
    await sql.query('BEGIN');

    const bookResult = await sql`
        SELECT quantity FROM books WHERE id = ${book_id} FOR UPDATE
        `;

    if (bookResult.length === 0 || bookResult[0].quantity < 1) {
      await sql.query('ROLLBACK');
      return res.status(400).json({ error: 'Livro indisponível ou não encontrado' });
    }

    const loanResult = await sql`
        INSERT INTO loans (user_id, book_id, return_date, status)
        VALUES (${user_id}, ${book_id}, ${finalReturnDate}, 'Em andamento')
        RETURNING id
        `;

    await sql`
        UPDATE books
        SET quantity = quantity - 1,
            available = (CASE WHEN quantity - 1 > 0 THEN TRUE ELSE FALSE END)
        WHERE id = ${book_id}
        `;

    await sql.query('COMMIT');
    res.json({ id: loanResult[0].id, message: 'Empréstimo registrado com sucesso!' });

  } catch (err) {
    try {
      await sql.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK:', rollbackErr.message);
    }
    handleServerError(res, err, 'Erro ao registrar empréstimo (Transação desfeita):');
  }
});

app.put('/api/loans/return/:id', adminMiddleware, async (req, res) => {
  // ... (restante do código da rota /api/loans/return/:id - PUT)
  const { id } = req.params;

  try {
    await sql.query('BEGIN');

    const loanResult = await sql`
            SELECT book_id, status FROM loans WHERE id = ${id} FOR UPDATE
        `;

    if (loanResult.length === 0) {
      await sql.query('ROLLBACK');
      return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    }

    const { book_id, status } = loanResult[0];

    if (status === 'Devolvido') {
      await sql.query('ROLLBACK');
      return res.status(400).json({ error: 'Empréstimo já foi devolvido.' });
    }

    await sql`
            UPDATE loans
            SET status = 'Devolvido',
                return_date = NOW()::DATE
            WHERE id = ${id}
        `;

    await sql`
            UPDATE books
            SET quantity = quantity + 1,
                available = TRUE
            WHERE id = ${book_id}
        `;

    await sql.query('COMMIT');
    res.json({ message: 'Devolução registrada com sucesso!' });
  } catch (err) {
    try {
      await sql.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erro ao tentar ROLLBACK na devolução:', rollbackErr.message);
    }
    handleServerError(res, err, 'Erro ao registrar devolução:');
  }
});


app.get('/api/reports/returned-loans', async (req, res) => {
  // ... (restante do código da rota /api/reports/returned-loans - GET)
  const { start_date, end_date } = req.query;

  let query = `
        SELECT l.id, u.name AS user, b.title AS book, l.loan_date, l.return_date
        FROM loans l
        JOIN users u ON l.user_id = u.id
        JOIN books b ON l.book_id = b.id
        WHERE l.status = 'Devolvido'
    `;
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    query += ` AND l.return_date >= $${paramIndex++}`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND l.return_date <= $${paramIndex++}`;
    params.push(end_date);
  }

  query += ` ORDER BY l.return_date DESC`;

  try {
    const reports = await sql.query(query, params);
    res.json(reports);
  } catch (err) {
    handleServerError(res, err, 'Erro ao gerar relatório de devoluções com filtros:');
  }
});


// === Início do Servidor ===
// 1. Inicializa a estrutura do banco de dados e os dados iniciais
initializeDatabaseAndData().then(() => {
  // 2. Inicia o servidor Express na porta definida
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
});
