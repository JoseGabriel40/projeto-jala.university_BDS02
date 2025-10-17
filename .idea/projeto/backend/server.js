// server.js - Servidor Express com APIs para o sistema de biblioteca

// Importa dependências
const express = require('express'); // Framework para criar servidor e rotas
const cors = require('cors'); // Permite requisições do frontend (CORS)
const db = require('./database'); // Conexão com o banco SQLite

// Inicializa o aplicativo Express
const app = express();
const PORT = 3000; // Porta do servidor

// Middleware: Processa JSON e habilita CORS
app.use(express.json()); // Permite parsing de corpos JSON em requisições
app.use(cors()); // Permite acesso do frontend em http://localhost:3000

// Serve arquivos estáticos do frontend (HTML, CSS, JS)
app.use(express.static('../frontend'));

// === API: Livros ===
// GET: Retorna todos os livros
app.get('/api/books', (req, res) => {
  db.all('SELECT * FROM books', [], (err, rows) => {
    if (err) {
      console.error('Erro ao listar livros:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows); // Retorna lista de livros como JSON
  });
});

// POST: Cria um novo livro
app.post('/api/books', (req, res) => {
  const { title, author, publisher, year, isbn, category, quantity } = req.body;
  // Validação básica
  if (!title || !author) {
    res.status(400).json({ error: 'Título e autor são obrigatórios' });
    return;
  }
  // Insere livro no banco
  db.run(
    `INSERT INTO books (title, author, publisher, year, isbn, category, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, author, publisher, year, isbn, category, quantity],
    function(err) {
      if (err) {
        console.error('Erro ao criar livro:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Livro criado com sucesso!' });
    }
  );
});

// === API: Usuários ===
// GET: Retorna todos os usuários
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      console.error('Erro ao listar usuários:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows); // Retorna lista de usuários como JSON
  });
});

// POST: Cria um novo usuário
app.post('/api/users', (req, res) => {
  const { name, year, class: turma, course } = req.body; // Renomeia 'class' para evitar palavra reservada
  // Validação básica
  if (!name) {
    res.status(400).json({ error: 'Nome é obrigatório' });
    return;
  }
  // Insere usuário no banco
  db.run(
    `INSERT INTO users (name, year, class, course)
         VALUES (?, ?, ?, ?)`,
    [name, year, turma, course],
    function(err) {
      if (err) {
        console.error('Erro ao criar usuário:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Usuário criado com sucesso!' });
    }
  );
});

// === API: Empréstimos ===
// GET: Retorna todos os empréstimos com dados de usuário e livro
app.get('/api/loans', (req, res) => {
  const query = `
    SELECT l.id, u.name as user, b.title as book, l.loan_date, l.return_date, l.status
    FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN books b ON l.book_id = b.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Erro ao listar empréstimos:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    // Ajusta status com base na data de devolução (lógica simples)
    const today = new Date().toISOString().split('T')[0];
    rows = rows.map(row => ({
      ...row,
      status: row.return_date && row.return_date < today && row.status !== 'Devolvido'
        ? 'Atrasado'
        : row.status
    }));
    res.json(rows); // Retorna lista de empréstimos como JSON
  });
});

// POST: Cria um novo empréstimo
app.post('/api/loans', (req, res) => {
  const { user_id, book_id, return_date } = req.body;
  // Validação básica
  if (!user_id || !book_id || !return_date) {
    res.status(400).json({ error: 'Usuário, livro e data de devolução são obrigatórios' });
    return;
  }
  // Verifica se o livro está disponível
  db.get('SELECT available FROM books WHERE id = ?', [book_id], (err, row) => {
    if (err || !row) {
      res.status(500).json({ error: err ? err.message : 'Livro não encontrado' });
      return;
    }
    if (!row.available) {
      res.status(400).json({ error: 'Livro indisponível' });
      return;
    }
    // Insere empréstimo no banco
    db.run(
      `INSERT INTO loans (user_id, book_id, return_date)
             VALUES (?, ?, ?)`,
      [user_id, book_id, return_date],
      function(err) {
        if (err) {
          console.error('Erro ao criar empréstimo:', err.message);
          res.status(500).json({ error: err.message });
          return;
        }
        // Marca livro como indisponível
        db.run('UPDATE books SET available = false WHERE id = ?', [book_id], (err) => {
          if (err) console.error('Erro ao atualizar livro:', err.message);
        });
        res.json({ id: this.lastID, message: 'Empréstimo criado com sucesso!' });
      }
    );
  });
});

// Inicia o servidor na porta definida
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
