// script.js - Lógica do frontend com integração ao backend via API

// Aguarda o carregamento completo do DOM antes de executar o código
document.addEventListener('DOMContentLoaded', function() {
  // === Navegação entre abas ===
  // Seleciona todos os itens de navegação e conteúdos de abas
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const sectionTitle = document.getElementById('section-title');

  // Adiciona evento de clique para cada item de navegação
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab'); // Obtém o ID da aba

      // Remove a classe 'active' de todos os itens e conteúdos
      navItems.forEach(i => i.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      // Adiciona 'active' ao item clicado e ao conteúdo correspondente
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');

      // Atualiza o título da seção com o texto do item clicado
      sectionTitle.textContent = this.querySelector('span').textContent;

      // Carrega dados específicos da aba
      if (tabId === 'dashboard') {
        loadDashboardData(); // Carrega estatísticas e empréstimos
      } else if (tabId === 'books') {
        loadBooks(); // Carrega livros para busca
      } else if (tabId === 'users') {
        loadUsers(); // Carrega usuários para busca
      }
    });
  });

  // === Função genérica para chamadas à API ===
  // Faz requisições HTTP ao backend e retorna dados ou erro
  async function fetchData(endpoint, method = 'GET', body = null) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(`http://localhost:3000${endpoint}`, options);
      if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error(`Erro ao acessar ${endpoint}:`, error);
      alert(`Erro de conexão: ${error.message}`);
      return null;
    }
  }

  // === Carrega dados do dashboard ===
  // Atualiza estatísticas (cards) e tabela de empréstimos
  async function loadDashboardData() {
    // Carrega número de livros
    const books = await fetchData('/api/books');
    if (books) document.getElementById('booksCount').textContent = books.length;

    // Carrega número de usuários
    const users = await fetchData('/api/users');
    if (users) document.getElementById('usersCount').textContent = users.length;

    // Carrega empréstimos e atualiza tabela
    const loans = await fetchData('/api/loans');
    if (loans) {
      document.getElementById('loansCount').textContent = loans.filter(l => l.status === 'Em andamento').length;
      document.getElementById('pendingReturns').textContent = loans.filter(l => l.status === 'Atrasado').length;
      updateLoanTable(loans);
    }
  }

  // === Função para atualizar a tabela de empréstimos ===
  // Preenche a tabela com dados vindos da API
  function updateLoanTable(data) {
    const tbody = document.getElementById('loanTableBody');
    tbody.innerHTML = ''; // Limpa tabela
    data.forEach(loan => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${loan.id}</td>
                <td>${loan.user}</td>
                <td>${loan.book}</td>
                <td>${loan.loan_date}</td>
                <td>${loan.return_date || '-'}</td>
                <td><span class="badge ${loan.status === 'Devolvido' ? 'badge-success' : loan.status === 'Em andamento' ? 'badge-warning' : 'badge-danger'}">${loan.status}</span></td>
            `;
      tbody.appendChild(row);
    });
  }

  // === Busca de livros ===
  let books = []; // Armazena livros carregados para busca local
  async function loadBooks() {
    books = await fetchData('/api/books') || [];
    // Limpa resultados de busca ao carregar
    const bookSearchResults = document.getElementById('searchResults');
    bookSearchResults.innerHTML = '';
    bookSearchResults.classList.remove('active');
  }

  const bookSearchInput = document.getElementById('bookSearch');
  const bookSearchResults = document.getElementById('searchResults');

  bookSearchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase(); // Converte busca para minúsculas
    bookSearchResults.innerHTML = ''; // Limpa resultados
    bookSearchResults.classList.remove('active'); // Esconde resultados

    if (query.length > 0) {
      // Filtra livros por título ou autor
      const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query)
      );

      if (filteredBooks.length > 0) {
        // Exibe livros encontrados
        filteredBooks.forEach(book => {
          const resultItem = document.createElement('div');
          resultItem.className = 'search-result-item';
          resultItem.textContent = `${book.title} - ${book.author} (${book.available ? 'Disponível' : 'Indisponível'})`;
          resultItem.addEventListener('click', function() {
            alert(`Livro: ${book.title}\nAutor: ${book.author}\nStatus: ${book.available ? 'Disponível' : 'Indisponível'}`);
            bookSearchInput.value = ''; // Limpa campo
            bookSearchResults.classList.remove('active'); // Esconde resultados
          });
          bookSearchResults.appendChild(resultItem);
        });
        bookSearchResults.classList.add('active'); // Exibe resultados
      } else {
        // Exibe mensagem se nada for encontrado
        const noResult = document.createElement('div');
        noResult.className = 'search-result-item';
        noResult.textContent = 'Nenhum livro encontrado';
        bookSearchResults.appendChild(noResult);
        bookSearchResults.classList.add('active');
      }
    }
  });

  // === Busca de usuários ===
  let users = []; // Armazena usuários carregados para busca local
  async function loadUsers() {
    users = await fetchData('/api/users') || [];
    // Limpa resultados de busca ao carregar
    const userSearchResults = document.getElementById('userSearchResults');
    userSearchResults.innerHTML = '';
    userSearchResults.classList.remove('active');
  }

  const userSearchInput = document.getElementById('userSearch');
  const userSearchResults = document.getElementById('userSearchResults');

  userSearchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase(); // Converte busca para minúsculas
    userSearchResults.innerHTML = ''; // Limpa resultados
    userSearchResults.classList.remove('active'); // Esconde resultados

    if (query.length > 0) {
      // Filtra usuários por nome ou curso
      const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(query) || user.course.toLowerCase().includes(query)
      );

      if (filteredUsers.length > 0) {
        // Exibe usuários encontrados
        filteredUsers.forEach(user => {
          const resultItem = document.createElement('div');
          resultItem.className = 'search-result-item';
          resultItem.textContent = `${user.name} - Ano: ${user.year}, Turma: ${user.class}, Curso: ${user.course}`;
          resultItem.addEventListener('click', function() {
            alert(`Usuário: ${user.name}\nAno: ${user.year}\nTurma: ${user.class}\nCurso: ${user.course}`);
            userSearchInput.value = ''; // Limpa campo
            userSearchResults.classList.remove('active'); // Esconde resultados
          });
          userSearchResults.appendChild(resultItem);
        });
        userSearchResults.classList.add('active'); // Exibe resultados
      } else {
        // Exibe mensagem se nada for encontrado
        const noResult = document.createElement('div');
        noResult.className = 'search-result-item';
        noResult.textContent = 'Nenhum usuário encontrado';
        userSearchResults.appendChild(noResult);
        userSearchResults.classList.add('active');
      }
    }
  });

  // === Fecha resultados de busca ao clicar fora ===
  document.addEventListener('click', function(e) {
    if (!bookSearchInput.contains(e.target) && !bookSearchResults.contains(e.target)) {
      bookSearchResults.classList.remove('active'); // Esconde resultados de livros
    }
    if (!userSearchInput.contains(e.target) && !userSearchResults.contains(e.target)) {
      userSearchResults.classList.remove('active'); // Esconde resultados de usuários
    }
  });

  // === Formulário de cadastro de livro ===
  document.getElementById('bookForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // Impede recarregamento da página
    const inputs = this.querySelectorAll('.form-control'); // Seleciona campos
    let isValid = true;

    // Valida se todos os campos estão preenchidos
    inputs.forEach(input => {
      if (!input.value) {
        isValid = false;
        input.style.borderColor = 'red'; // Destaca campos vazios
      } else {
        input.style.borderColor = '#ced4da'; // Restaura borda padrão
      }
    });

    if (isValid) {
      // Monta objeto com dados do formulário
      const formData = {
        title: inputs[0].value,
        author: inputs[1].value,
        publisher: inputs[2].value,
        year: parseInt(inputs[3].value),
        isbn: inputs[4].value,
        category: inputs[5].value,
        quantity: parseInt(inputs[6].value)
      };

      // Envia dados ao backend
      const result = await fetchData('/api/books', 'POST', formData);
      if (result) {
        this.reset(); // Limpa formulário
        alert('Livro cadastrado com sucesso!');
        loadBooks(); // Recarrega lista de livros
      } else {
        alert('Erro ao cadastrar livro!');
      }
    } else {
      alert('Preencha todos os campos!');
    }
  });

  // === Formulário de cadastro de usuário ===
  document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // Impede recarregamento da página
    const inputs = this.querySelectorAll('.form-control'); // Seleciona campos
    let isValid = true;

    // Valida se todos os campos estão preenchidos
    inputs.forEach(input => {
      if (!input.value) {
        isValid = false;
        input.style.borderColor = 'red'; // Destaca campos vazios
      } else {
        input.style.borderColor = '#ced4da'; // Restaura borda padrão
      }
    });

    if (isValid) {
      // Monta objeto com dados do formulário
      const formData = {
        name: inputs[0].value,
        year: parseInt(inputs[1].value),
        class: inputs[2].value,
        course: inputs[3].value
      };

      // Envia dados ao backend
      const result = await fetchData('/api/users', 'POST', formData);
      if (result) {
        this.reset(); // Limpa formulário
        alert('Usuário cadastrado com sucesso!');
        loadUsers(); // Recarrega lista de usuários
      } else {
        alert('Erro ao cadastrar usuário!');
      }
    } else {

      alert('Preencha todos os campos!');
    }
  });

  // === Modal de novo empréstimo ===
  // Abre o modal ao clicar no botão
  document.getElementById('newLoanBtn').addEventListener('click', function() {
    document.getElementById('loanModal').style.display = 'flex'; // Exibe modal
  });

  // Fecha o modal ao clicar no botão de fechar
  document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('loanModal').style.display = 'none'; // Esconde modal
  });

  // Salva novo empréstimo
  document.getElementById('loanForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // Impede recarregamento da página
    const formData = {
      user_id: this.querySelector('input[placeholder="Digite o ID do usuário"]').value,
      book_id: this.querySelector('input[placeholder="Digite o ID do livro"]').value,
      return_date: this.querySelector('input[type="date"]').value
    };

    // Envia dados ao backend
    const result = await fetchData('/api/loans', 'POST', formData);
    if (result) {
      this.reset(); // Limpa formulário
      document.getElementById('loanModal').style.display = 'none'; // Esconde modal
      alert('Empréstimo registrado com sucesso!');
      loadDashboardData(); // Recarrega dados do dashboard
    } else {
      alert('Erro ao registrar empréstimo!');
    }
  });

  // === Logout ===
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Deseja realmente sair?')) {
      console.log('Logout realizado'); // Log para depuração
      // Simula redirecionamento para login (ajuste para sua rota real)
      window.location.href = '/login';
    }
  });

  // Inicializa o dashboard ao carregar a página
  loadDashboardData();
});
