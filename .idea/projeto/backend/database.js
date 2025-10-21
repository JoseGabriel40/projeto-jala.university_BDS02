// database.js: Configuração e Exportação da Conexão com o Banco de Dados Neon (PostgreSQL)

// Importa o módulo para carregar variáveis de ambiente (ex: DATABASE_URL) do arquivo .env
require('dotenv').config();

// Importa o driver serverless do Neon para conexões PostgreSQL baseadas em HTTP/WS
const { neon } = require('@neondatabase/serverless');

// 1. Inicializa a Conexão Neon
// A função neon() recebe a URL de conexão do ambiente (process.env.DATABASE_URL)
const sql = neon(process.env.DATABASE_URL);

// 2. Exporta o objeto de conexão
// A lógica de inicialização de tabelas e dados foi movida para server.js.
module.exports = {
  sql,
};
