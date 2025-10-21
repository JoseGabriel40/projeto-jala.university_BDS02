// server.js: Servidor Express com APIs RESTful para o Sistema de Biblioteca
// Refatorado para usar MySQL local com o pacote mysql2.

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Usado para carregar .env, embora a conexão seja local
const path = require('path'); // Adiciona o módulo path para resolver caminhos
// CORREÇÃO: Usando o nome do arquivo 'database' (como na imagem) e removendo a pasta 'database'.
const db = require('./database');

const app = express();
const PORT = 3000;

// === Middlewares Globais ===
app.use(express.json());
app.use(cors());

// Serve a página de login na raiz e arquivos estáticos do frontend
app.use(express.static('../frontend'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../frontend/login.html');
});

// === Variável de Sessão Simples em Memória ===
const fake_sessions = {};

// === FUNÇÕES DE MIDDLEWARE ===

// Middleware para verificar se o usuário está autenticado
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  const session = fake_sessions[token];
  if (!token || !session) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
  req.user = session.user;
  next();
}

// Middleware para verificar se o usuário é administrador
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador.' });
  }
  next();
}

// === FUNÇÕES AUXILIARES DE BACKEND ===

// Função para lidar com erros do servidor e responder ao cliente
function handleServerError(res, err, message) {
  console.error(message, err.message);
  // O MySQL usa 'ER_DUP_ENTRY' para chave duplicada (ex: email)
  if (err.code === 'ER_DUP_ENTRY') {
    // Retorna 409 Conflict para email/ISBN já cadastrado
    return res.status(409).json({ error: 'Este recurso (email ou ISBN) já está cadastrado.' });
  }
  res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
}

// Função de lógica de negócio: Calcula o valor da multa por atraso
async function calculateFine(returnDate, loanStatus) {
  if (loanStatus === 'Devolvido' || loanStatus === 'Em andamento') {
    return 0;
  }

  try {
    const settings = await db.query('SELECT fine_per_day FROM settings WHERE id = 1');
    if (settings.length === 0) return 0;

    const finePerDay = parseFloat(settings[0].fine_per_day);
    const today = new Date();
    const dueDate = new Date(returnDate);

    // Limpa as horas para comparação correta
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today > dueDate) {
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Dias de atraso
      return (diffDays * finePerDay).toFixed(2);
    }

    return 0;
  } catch (err) {
    console.error('Erro ao calcular multa:', err);
    return 0;
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
    // Busca credenciais e dados do usuário em uma única consulta (JOIN)
    const query = `
      SELECT
        u.id,
        u.name,
        c.email,
        c.role
      FROM credentials c
             JOIN users u ON c.user_id = u.id
      WHERE c.email = ? AND c.password = ?
    `;
    const result = await db.query(query, [email, password]);

    if (result.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = result[0];
    const token = Math.random().toString(36).substring(2);

    fake_sessions[token] = { user, timestamp: Date.now() };

    // Retorna os dados necessários para a sessão do frontend
    res.json({
      token,
      message: 'Login bem-sucedido!',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    handleServerError(res, err, 'ERRO CRÍTICO NO LOGIN:');
  }
});

// POST /api/register: Rota pública para cadastro de novos usuários COMUNS
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios para cadastro.' });
  }

  const role = 'common';
  const placeholderName = email.split('@')[0];
  const defaultYear = 0;
  const defaultClass = 'Aguardando Cadastro';
  const defaultCourse = 'Aguardando Cadastro';

  let connection;
  try {
    connection = await db.getConnection(); // Obtém conexão para transação
    await connection.beginTransaction(); // Inicia transação

    // 1. Insere dados MÍNIMOS na tabela users
    const userInsertQuery = `
      INSERT INTO users (name, year, class, course)
      VALUES (?, ?, ?, ?)
    `;
    const [userInsertResult] = await connection.query(userInsertQuery, [placeholderName, defaultYear, defaultClass, defaultCourse]);
    const newUserId = userInsertResult.insertId;

    // 2. Insere dados de login na tabela credentials
    const credentialsInsertQuery = `
      INSERT INTO credentials (user_id, email, password, role)
      VALUES (?, ?, ?, ?)
    `;
    await connection.query(credentialsInsertQuery, [newUserId, email, password, role]);

    await connection.commit(); // Confirma transação
    connection.release(); // Libera a conexão

    res.json({ message: 'Cadastro realizado com sucesso! Você pode fazer login.', user: { id: newUserId, name: placeholderName, email, role } });

  } catch (err) {
    if (connection) await connection.rollback(); // Desfaz em caso de erro
    if (connection) connection.release();

    handleServerError(res, err, 'ERRO CRÍTICO NO CADASTRO:');
  }
});

// POST /api/logout: Encerra a sessão
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  delete fake_sessions[token];
  res.json({ message: 'Logout realizado com sucesso.' });
});


// === APLICAÇÃO DO MIDDLEWARE DE AUTENTICAÇÃO (PROTEGE TODAS AS ROTAS ABAIXO) ===
app.use('/api', authMiddleware);


// --- Configurações ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.query('SELECT days_for_return, fine_per_day, notification_days FROM settings WHERE id = 1');
    if (settings.length === 0) {
      return res.json({ days_for_return: 14, fine_per_day: 2.00, notification_days: 2 });
    }
    res.json(settings[0]);
  } catch (err) {
    handleServerError(res, err, 'Erro ao buscar configurações:');
  }
});

app.post('/api/settings', adminMiddleware, async (req, res) => {
  const { days_for_return, fine_per_day, notification_days } = req.body;

  if (days_for_return === undefined || fine_per_day === undefined || notification_days === undefined) {
    return res.status(400).json({ error: 'Todos os campos de configuração são obrigatórios.' });
  }

  try {
    const query = `
      INSERT INTO settings (id, days_for_return, fine_per_day, notification_days)
      VALUES (1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE days_for_return = VALUES(days_for_return), fine_per_day = VALUES(fine_per_day), notification_days = VALUES(notification_days)
    `;
    await db.query(query, [days_for_return, fine_per_day, notification_days]);
    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (err) {
    handleServerError(res, err, 'Erro ao salvar configurações:');
  }
});


// --- Livros (CRUD) ---
app.get('/api/books', async (req, res) => {
  try {
    const books = await db.query('SELECT * FROM books ORDER BY id');
    // Converte o campo 'available' para booleano, pois o MySQL pode retornar 0/1
    const processedBooks = books.map(book => ({
      ...book,
      available: !!book.available
    }));
    res.json(processedBooks);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar livros:');
  }
});

app.post('/api/books', adminMiddleware, async (req, res) => {
  const { title, author, publisher, year, isbn, category, quantity } = req.body;
  if (!title || !author || !quantity) {
    return res.status(400).json({ error: 'Título, autor e quantidade são obrigatórios' });
  }

  const available = quantity > 0;

  try {
    const query = `
      INSERT INTO books (title, author, publisher, year, isbn, category, quantity, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [title, author, publisher, year, isbn, category, quantity, available]);

    // Busca o livro inserido para retorno padronizado
    const newBook = await db.query('SELECT * FROM books WHERE id = ?', [result.insertId]);
    res.json({
      ...newBook[0],
      available: !!newBook[0].available
    });
  } catch (err) {
    handleServerError(res, err, 'Erro ao criar livro:');
  }
});

app.put('/api/books/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, author, publisher, year, isbn, category, quantity } = req.body;

  if (!title || !author || !quantity) {
    return res.status(400).json({ error: 'Título, autor e quantidade são obrigatórios' });
  }

  const available = quantity > 0;

  try {
    const query = `
      UPDATE books
      SET title = ?,
          author = ?,
          publisher = ?,
          year = ?,
          isbn = ?,
          category = ?,
          quantity = ?,
          available = ?
      WHERE id = ?
    `;
    const result = await db.query(query, [title, author, publisher, year, isbn, category, quantity, available, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }

    // Retorna o livro atualizado
    const updatedBook = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    res.json({
      ...updatedBook[0],
      available: !!updatedBook[0].available
    });

  } catch (err) {
    handleServerError(res, err, 'Erro ao atualizar livro:');
  }
});

app.delete('/api/books/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const activeLoans = await db.query(`SELECT COUNT(*) as count FROM loans WHERE book_id = ? AND status != 'Devolvido'`, [id]);
    if (activeLoans[0].count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir livro com empréstimos ativos.' });
    }

    const result = await db.query('DELETE FROM books WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }
    res.json({ message: 'Livro excluído com sucesso!' });
  } catch (err) {
    handleServerError(res, err, 'Erro ao excluir livro:');
  }
});


// --- Usuários (CRUD) ---
// GET /api/users: (Usa JOIN)
app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.year, u.class, u.course, c.email, c.role
      FROM users u
             JOIN credentials c ON u.id = c.user_id
      ORDER BY u.id
    `;
    const users = await db.query(query);
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar usuários:');
  }
});

// POST /api/users: (Usa transação)
app.post('/api/users', adminMiddleware, async (req, res) => {
  const { name, email, password, year, class: turma, course, role } = req.body;
  if (!name || !email || !password || !turma || !course || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const finalRole = role || 'common';

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Insere na tabela users
    const userInsertQuery = `
      INSERT INTO users (name, year, class, course)
      VALUES (?, ?, ?, ?)
    `;
    const [userInsertResult] = await connection.query(userInsertQuery, [name, year, turma, course]);
    const newUserId = userInsertResult.insertId;

    // 2. Insere na tabela credentials
    const credentialsInsertQuery = `
      INSERT INTO credentials (user_id, email, password, role)
      VALUES (?, ?, ?, ?)
    `;
    const [credentialsInsertResult] = await connection.query(credentialsInsertQuery, [newUserId, email, password, finalRole]);

    await connection.commit();
    connection.release();

    const newUser = {
      id: newUserId,
      name, year, class: turma, course, email, role: finalRole
    };

    res.json(newUser);

  } catch (err) {
    if (connection) await connection.rollback();
    if (connection) connection.release();

    handleServerError(res, err, 'Erro ao criar usuário:');
  }
});

// PUT /api/users/:id: (Usa transação)
app.put('/api/users/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, email, year, class: turma, course, password, role } = req.body;

  if (!name || !email || !turma || !course || !password || !role) {
    return res.status(400).json({ error: 'Nome, email, senha, turma, curso e papel são obrigatórios' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Atualiza a tabela users
    const userUpdateQuery = `
      UPDATE users
      SET name = ?, year = ?, class = ?, course = ?
      WHERE id = ?
    `;
    const [userUpdateResult] = await connection.query(userUpdateQuery, [name, year, turma, course, id]);

    if (userUpdateResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // 2. Atualiza a tabela credentials
    const credentialsUpdateQuery = `
      UPDATE credentials
      SET email = ?, password = ?, role = ?
      WHERE user_id = ?
    `;
    const [credentialsUpdateResult] = await connection.query(credentialsUpdateQuery, [email, password, role, id]);

    await connection.commit();
    connection.release();

    const updatedUser = {
      id: parseInt(id), name, year, class: turma, course, email, role
    };

    res.json(updatedUser);
  } catch (err) {
    if (connection) await connection.rollback();
    if (connection) connection.release();

    handleServerError(res, err, 'Erro ao atualizar usuário:');
  }
});

app.delete('/api/users/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    const activeLoans = await db.query(`SELECT COUNT(*) as count FROM loans WHERE user_id = ? AND status != 'Devolvido'`, [id]);
    if (activeLoans[0].count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir usuário com empréstimos ativos.' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Deleta de credentials primeiro (ou confia no ON DELETE CASCADE, mas é mais seguro deletar diretamente)
    await connection.query('DELETE FROM credentials WHERE user_id = ?', [id]);

    // Deleta de users
    const result = await connection.query('DELETE FROM users WHERE id = ?', [id]);

    if (result[0].affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await connection.commit();
    connection.release();

    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (err) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    handleServerError(res, err, 'Erro ao excluir usuário:');
  }
});

app.get('/api/users/search-by-name', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'O parâmetro de busca (query) é obrigatório.' });
  }

  try {
    const searchQuery = `%${query}%`;
    const sqlQuery = `
      SELECT u.id, u.name, c.email, u.class, u.course
      FROM users u
             JOIN credentials c ON u.id = c.user_id
      WHERE u.name LIKE ?
        LIMIT 10
    `;
    const users = await db.query(sqlQuery, [searchQuery]);
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao buscar usuários por nome:');
  }
});


// --- Empréstimos, Devolução, Relatórios ---
app.get('/api/loans', async (req, res) => {
  const query = `
    SELECT
      l.id,
      u.name as user,
      b.title as book,
      DATE_FORMAT(l.loan_date, '%Y-%m-%d') as loan_date,
      DATE_FORMAT(l.return_date, '%Y-%m-%d') as return_date_db, -- Data original do DB
      l.status
    FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
    ORDER BY l.loan_date DESC
  `;
  try {
    const loans = await db.query(query);
    const today = new Date().toISOString().split('T')[0];

    const loansWithFine = await Promise.all(loans.map(async (row) => {
      let currentStatus = row.status;
      const returnDate = row.return_date_db;

      // Se o status for 'Em andamento' e a data prevista de devolução já passou, marca como 'Atrasado'
      if (currentStatus === 'Em andamento' && returnDate && returnDate < today) {
        currentStatus = 'Atrasado';
      }

      const fineAmount = await calculateFine(returnDate, currentStatus);

      return {
        ...row,
        status: currentStatus,
        fine: fineAmount,
        return_date: returnDate,
        return_date_db: undefined // Remove a coluna auxiliar
      };
    }));

    res.json(loansWithFine);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar empréstimos:');
  }
});

app.post('/api/loans', adminMiddleware, async (req, res) => {
  const { user_id, book_id, return_date } = req.body;
  if (!user_id || !book_id) {
    return res.status(400).json({ error: 'ID de Usuário e ID de Livro são obrigatórios' });
  }

  let finalReturnDate = return_date;

  if (!finalReturnDate) {
    try {
      const settings = await db.query(`SELECT days_for_return FROM settings WHERE id = 1`);
      const days = settings.length > 0 ? settings[0].days_for_return : 14;

      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + days);

      // Formato MySQL 'YYYY-MM-DD'
      finalReturnDate = dueDate.toISOString().split('T')[0];
    } catch(err) {
      console.error('Erro ao buscar dias padrão:', err);
      finalReturnDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Verifica e bloqueia o livro (SELECT ... FOR UPDATE)
    const bookResult = await connection.query(`SELECT quantity FROM books WHERE id = ? FOR UPDATE`, [book_id]);
    const bookData = bookResult[0];

    if (bookData.length === 0 || bookData[0].quantity < 1) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Livro indisponível ou não encontrado' });
    }

    // 2. Registra o empréstimo
    const loanInsertQuery = `
      INSERT INTO loans (user_id, book_id, return_date, status)
      VALUES (?, ?, ?, 'Em andamento')
    `;
    const [loanResult] = await connection.query(loanInsertQuery, [user_id, book_id, finalReturnDate]);
    const newLoanId = loanResult.insertId;

    // 3. Atualiza a quantidade do livro
    const updateBookQuery = `
      UPDATE books
      SET quantity = quantity - 1,
          available = (CASE WHEN quantity - 1 > 0 THEN TRUE ELSE FALSE END)
      WHERE id = ?
    `;
    await connection.query(updateBookQuery, [book_id]);

    await connection.commit();
    connection.release();
    res.json({ id: newLoanId, message: 'Empréstimo registrado com sucesso!' });

  } catch (err) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    handleServerError(res, err, 'Erro ao registrar empréstimo (Transação desfeita):');
  }
});

app.put('/api/loans/return/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Seleciona o empréstimo para atualização (e bloqueio)
    const loanResult = await connection.query(`SELECT book_id, status FROM loans WHERE id = ? FOR UPDATE`, [id]);
    const loanData = loanResult[0];

    if (loanData.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    }

    const { book_id, status } = loanData[0];

    if (status === 'Devolvido') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Empréstimo já foi devolvido.' });
    }

    // 2. Atualiza o status do empréstimo para 'Devolvido'
    const updateLoanQuery = `
      UPDATE loans
      SET status = 'Devolvido',
          return_date = CURRENT_DATE()
      WHERE id = ?
    `;
    await connection.query(updateLoanQuery, [id]);

    // 3. Atualiza a quantidade do livro
    const updateBookQuery = `
      UPDATE books
      SET quantity = quantity + 1,
          available = TRUE
      WHERE id = ?
    `;
    await connection.query(updateBookQuery, [book_id]);

    await connection.commit();
    connection.release();
    res.json({ message: 'Devolução registrada com sucesso!' });
  } catch (err) {
    if (connection) await connection.rollback();
    if (connection) connection.release();
    handleServerError(res, err, 'Erro ao registrar devolução:');
  }
});


app.get('/api/reports/returned-loans', async (req, res) => {
  const { start_date, end_date } = req.query;

  let query = `
    SELECT
      l.id,
      u.name AS user,
      b.title AS book,
      DATE_FORMAT(l.loan_date, '%Y-%m-%d') AS loan_date,
      DATE_FORMAT(l.return_date, '%Y-%m-%d') AS return_date
    FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
    WHERE l.status = 'Devolvido'
  `;
  const params = [];

  if (start_date) {
    query += ` AND l.return_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND l.return_date <= ?`;
    params.push(end_date);
  }

  query += ` ORDER BY l.return_date DESC`;

  try {
    const reports = await db.query(query, params);
    res.json(reports);
  } catch (err) {
    handleServerError(res, err, 'Erro ao gerar relatório de devoluções com filtros:');
  }
});


// === Início do Servidor ===
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
