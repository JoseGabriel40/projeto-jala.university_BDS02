// database.js - Configuração do banco de dados PostgreSQL (Supabase)
const { Pool } = require('pg');



require('dotenv').config();
const pool = new Pool({
  host: process.env.SUPABASE_HOST,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  database: process.env.SUPABASE_DB,
  port: 5432,
  ssl: { rejectUnauthorized: false },
  family: 4 // ⚠️ força IPv4
});

pool.connect()
  .then(() => {
    console.log('✅ Conectado ao banco de dados Supabase (PostgreSQL)');
    initDatabase();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao banco:', err.message);
  });

// Cria tabelas e insere dados iniciais (só na primeira execução)
async function initDatabase() {
  try {
    // Cria tabelas se não existirem
    await pool.query(`
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER,
        class TEXT,
        course TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        book_id INTEGER NOT NULL REFERENCES books(id),
        loan_date DATE DEFAULT CURRENT_DATE,
        return_date DATE,
        status TEXT DEFAULT 'Em andamento'
      );
    `);

    console.log('🗂️ Tabelas verificadas/criadas com sucesso');

    // Verifica se há dados
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM books');
    if (parseInt(rows[0].count) === 0) {
      console.log('📚 Inserindo dados de exemplo...');

      const books = [
        ['Dom Casmurro', 'Machado de Assis', 'Editora Globo', 1899, '978-8525406552', 'Literatura', 3],
        ['O Cortiço', 'Aluísio Azevedo', 'Editora Ática', 1890, '978-8508117346', 'Literatura', 2],
        ['Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'Editora Nova Fronteira', 1881, '978-8520925683', 'Literatura', 2]
      ];

      for (const book of books) {
        await pool.query(`
          INSERT INTO books (title, author, publisher, year, isbn, category, quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, book);
      }

      const users = [
        ['João Silva', 2023, '3A', 'Desenvolvimento'],
        ['Maria Santos', 2023, '2B', 'Redes'],
        ['Pedro Costa', 2023, '1C', 'Enfermagem']
      ];

      for (const user of users) {
        await pool.query(`
          INSERT INTO users (name, year, class, course)
          VALUES ($1, $2, $3, $4)
        `, user);
      }

      console.log('✅ Dados de exemplo inseridos com sucesso!');
    }
  } catch (err) {
    console.error('Erro na inicialização do banco:', err.message);
  }
}

module.exports = pool;
