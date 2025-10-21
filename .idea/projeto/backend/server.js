// server.js: Servidor Express com APIs RESTful para o Sistema de Biblioteca
// Contém a lógica do servidor, middlewares de autenticação e rotas.

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

  // Assume que a tabela settings já existe e está populada
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


// A função initializeDatabaseAndData foi removida.
// O servidor assume que a estrutura do banco de dados (DDL) já foi aplicada.


// === ROTAS DE AUTENTICAÇÃO E CADASTRO (PÚBLICAS) ===

// POST /api/login: Processa o login (Usa JOIN na nova estrutura)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    // Busca credenciais e dados do usuário em uma única consulta (JOIN)
    const result = await sql`
      SELECT
        u.id,
        u.name,
        c.email,
        c.role
      FROM credentials c
             JOIN users u ON c.user_id = u.id
      WHERE c.email = ${email} AND c.password = ${password}
    `;

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

// POST /api/register: Rota pública para cadastro de novos usuários COMUNS (Insere somente o essencial e credenciais)
app.post('/api/register', async (req, res) => {
  // Apenas email e senha são necessários para o cadastro público simplificado
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios para cadastro.' });
  }

  const role = 'common';

  // Define valores mínimos ou placeholders para os campos da tabela 'users'
  // Nota: O campo 'name' no login/frontend é importante, por isso usamos o prefixo do email.
  const placeholderName = email.split('@')[0];
  const defaultYear = 0; // Usar 0 ou NULL, dependendo do schema da DB. 0 é seguro para int.
  const defaultClass = 'Aguardando Cadastro';
  const defaultCourse = 'Aguardando Cadastro';

  try {
    await sql.query('BEGIN'); // Inicia transação

    // 1. Insere dados MÍNIMOS na tabela users para obter um ID válido
    const userResult = await sql`
      INSERT INTO users (name, year, class, course)
      VALUES (${placeholderName}, ${defaultYear}, ${defaultClass}, ${defaultCourse})
        RETURNING id, name
    `;
    const newUserId = userResult[0].id;

    // 2. Insere dados de login na tabela credentials
    const credentialsResult = await sql`
      INSERT INTO credentials (user_id, email, password, role)
      VALUES (${newUserId}, ${email}, ${password}, ${role})
        RETURNING email, role
    `;

    await sql.query('COMMIT'); // Confirma transação

    const newUser = {
      id: newUserId,
      name: userResult[0].name,
      email: credentialsResult[0].email,
      role: credentialsResult[0].role
    };

    res.json({ message: 'Cadastro realizado com sucesso! Você pode fazer login.', user: newUser });
  } catch (err) {
    await sql.query('ROLLBACK'); // Desfaz em caso de erro
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
  try {
    const books = await sql.query('SELECT * FROM books ORDER BY id');
    res.json(books);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar livros:');
  }
});

app.post('/api/books', adminMiddleware, async (req, res) => {
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
// GET /api/users: (Usa JOIN na nova estrutura)
app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.year, u.class, u.course, c.email, c.role
      FROM users u
             JOIN credentials c ON u.id = c.user_id
      ORDER BY u.id
    `;
    const users = await sql.query(query);
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao listar usuários:');
  }
});

// POST /api/users: (Usa transação em 2 tabelas)
app.post('/api/users', adminMiddleware, async (req, res) => {
  const { name, email, password, year, class: turma, course, role } = req.body;
  if (!name || !email || !password || !turma || !course || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const finalRole = role || 'common';

  try {
    await sql.query('BEGIN'); // Inicia transação

    // 1. Insere na tabela users
    const userResult = await sql`
      INSERT INTO users (name, year, class, course)
      VALUES (${name}, ${year}, ${turma}, ${course})
        RETURNING id, name, year, class, course
    `;
    const newUserId = userResult[0].id;

    // 2. Insere na tabela credentials
    const credentialsResult = await sql`
      INSERT INTO credentials (user_id, email, password, role)
      VALUES (${newUserId}, ${email}, ${password}, ${finalRole})
        RETURNING email, role
    `;

    await sql.query('COMMIT'); // Confirma transação

    const newUser = {
      ...userResult[0],
      email: credentialsResult[0].email,
      role: credentialsResult[0].role
    };

    res.json(newUser);

  } catch (err) {
    await sql.query('ROLLBACK'); // Desfaz em caso de erro
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }
    handleServerError(res, err, 'Erro ao criar usuário:');
  }
});

// PUT /api/users/:id: (Usa transação em 2 tabelas)
app.put('/api/users/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, email, year, class: turma, course, password, role } = req.body;

  if (!name || !email || !turma || !course || !password || !role) {
    return res.status(400).json({ error: 'Nome, email, senha, turma, curso e papel são obrigatórios' });
  }

  try {
    await sql.query('BEGIN'); // Inicia transação

    // 1. Atualiza a tabela users
    const userUpdateResult = await sql`
      UPDATE users
      SET name = ${name},
          year = ${year},
          class = ${turma},
          course = ${course}
      WHERE id = ${id}
        RETURNING id, name, year, class, course
    `;

    if (userUpdateResult.length === 0) {
      await sql.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // 2. Atualiza a tabela credentials
    const credentialsUpdateResult = await sql`
      UPDATE credentials
      SET email = ${email},
          password = ${password},
          role = ${role}
      WHERE user_id = ${id}
        RETURNING email, role
    `;

    await sql.query('COMMIT'); // Confirma transação

    const updatedUser = {
      ...userUpdateResult[0],
      email: credentialsUpdateResult[0].email,
      role: credentialsUpdateResult[0].role
    };

    res.json(updatedUser);
  } catch (err) {
    await sql.query('ROLLBACK'); // Desfaz em caso de erro
    // Adiciona checagem de email duplicado em caso de update
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado em outro usuário.' });
    }
    handleServerError(res, err, 'Erro ao atualizar usuário:');
  }
});

app.delete('/api/users/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const activeLoans = await sql`SELECT COUNT(*) FROM loans WHERE user_id = ${id} AND status != 'Devolvido'`;
    if (parseInt(activeLoans[0].count) > 0) {
      return res.status(400).json({ error: 'Não é possível excluir usuário com empréstimos ativos.' });
    }

    // Deleta de users. ON DELETE CASCADE em credentials garante a exclusão das credenciais.
    await sql.query('BEGIN');
    await sql`DELETE FROM users WHERE id = ${id}`;
    await sql.query('COMMIT');

    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (err) {
    await sql.query('ROLLBACK');
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
    // Usa JOIN com credentials para obter email
    const users = await sql`
      SELECT u.id, u.name, c.email, u.class, u.course
      FROM users u
             JOIN credentials c ON u.id = c.user_id
      WHERE u.name ILIKE ${searchQuery}
        LIMIT 10
    `;
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 'Erro ao buscar usuários por nome:');
  }
});


// --- Empréstimos, Devolução, Relatórios ---
app.get('/api/loans', async (req, res) => {
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
// O servidor Express é iniciado diretamente.
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
