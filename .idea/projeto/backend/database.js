// database/connection.js: Configuração e Exportação da Conexão MySQL

const mysql = require('mysql2/promise');

// Configurações conforme solicitado
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'biblioteca',
};

/**
 * Cria um pool de conexões MySQL para gerenciar a concorrência de forma eficiente.
 * Usamos 'promise' para ter suporte nativo a async/await.
 */
const pool = mysql.createPool(dbConfig);

// Exporta a função para executar queries
module.exports = {
  query: async (sql, params = []) => {
    // Usar 'try/finally' para liberar a conexão é mais seguro,
    // mas o 'pool.query' já lida com a liberação automaticamente.
    try {
      // O pool.query retorna [results, fields]
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error) {
      console.error('ERRO DE QUERY MySQL:', error.message);
      // Rejeita a promessa para que o server.js possa capturar e tratar
      throw error;
    }
  },

  // Método para iniciar uma transação, obtendo uma conexão
  getConnection: async () => {
    return pool.getConnection();
  }
};
