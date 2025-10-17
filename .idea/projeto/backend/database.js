// database.js - Configuração do banco de dados SQLite

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cria/conecta ao banco de dados
const db = new sqlite3.Database(path.join(__dirname, 'biblioteca.db'), (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    initDatabase();
  }
});

// Inicializa as tabelas do banco
function initDatabase() {
  // Tabela de livros
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      publisher TEXT,
      year INTEGER,
      isbn TEXT,
      category TEXT,
      quantity INTEGER DEFAULT 1,
      available BOOLEAN DEFAULT 1
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela books:', err.message);
    else console.log('Tabela books verificada/criada');
  });

  // Tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year INTEGER,
      class TEXT,
      course TEXT
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela users:', err.message);
    else console.log('Tabela users verificada/criada');
  });

  // Tabela de empréstimos
  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      loan_date TEXT DEFAULT (date('now')),
      return_date TEXT,
      status TEXT DEFAULT 'Em andamento',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela loans:', err.message);
    else console.log('Tabela loans verificada/criada');
  });

  // Insere dados de exemplo (apenas se as tabelas estiverem vazias)
  db.get('SELECT COUNT(*) as count FROM books', (err, row) => {
    if (!err && row.count === 0) {
      console.log('Inserindo dados de exemplo...');

      // Livros de exemplo
      const books = [
        ['Dom Casmurro', 'Machado de Assis', 'Editora Globo', 1899, '978-8525406552', 'Literatura', 3],
        ['O Cortiço', 'Aluísio Azevedo', 'Editora Ática', 1890, '978-8508117346', 'Literatura', 2],
        ['Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'Editora Nova Fronteira', 1881, '978-8520925683', 'Literatura', 2]
      ];

      books.forEach(book => {
        db.run(
          'INSERT INTO books (title, author, publisher, year, isbn, category, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          book
        );
      });

      // Usuários de exemplo
      const users = [
        ['João Silva', 2023, '3A', 'Desenvolvimento'],
        ['Maria Santos', 2023, '2B', 'Redes'],
        ['Pedro Costa', 2023, '1C', 'Enfermagem']
      ];

      users.forEach(user => {
        db.run(
          'INSERT INTO users (name, year, class, course) VALUES (?, ?, ?, ?)',
          user
        );
      });

      console.log('Dados de exemplo inseridos!');
    }
  });
}

module.exports = db;
