// script.js: Lógica do frontend com integração à API (Protegida)

// Variáveis globais de sessão e autenticação (definidas em login-script.js)
const USER_SESSION = window.USER_SESSION || {}; // Informações do usuário logado
const AUTH_TOKEN = window.AUTH_TOKEN || ''; // Token de autenticação
// Determina o nível de acesso para controlar a visibilidade dos botões
const IS_ADMIN = USER_SESSION.role === 'admin';

// Constantes e elementos DOM
// REMOVIDO: const API_BASE_URL = 'http://localhost:3000'; -> Use API_BASE_URL global
const editModal = document.getElementById('editModal');
const editFieldsContainer = document.getElementById('editFieldsContainer');
const editForm = document.getElementById('editForm');
let books = [];
let users = [];

// Aguarda o carregamento completo do DOM
document.addEventListener('DOMContentLoaded', function() {

  // Verifica se a sessão existe (dupla checagem, já feita em index.html, mas segura)
  if (!AUTH_TOKEN) return; // Se não houver token, o script não deve executar

  // Atualiza o nome e o avatar do usuário
  document.getElementById('userNameDisplay').textContent = USER_SESSION.name + (IS_ADMIN ? ' (Admin)' : '');
  document.getElementById('userAvatar').textContent = USER_SESSION.name ? USER_SESSION.name.charAt(0).toUpperCase() : 'A';

  // Evento de Logout
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Deseja realmente sair?')) {
      window.logout(); // Chama a função global de logout
    }
  });

  // Oculta a aba Configurações e o campo de role no cadastro se não for admin
  if (!IS_ADMIN) {
    const settingsNav = document.querySelector('.nav-item[data-tab="settings"]');
    if (settingsNav) settingsNav.style.display = 'none';
    const roleGroup = document.getElementById('roleGroup');
    if (roleGroup) roleGroup.style.display = 'none';
    const userFormH2 = document.getElementById('userFormContainer').querySelector('h2');
    if (userFormH2) userFormH2.textContent = 'Cadastrar Novo Usuário Comum';
  }


  // --- Eventos de UI e Modais ---

  // Abertura de Modal de Empréstimo
  const openLoanModal = () => { document.getElementById('loanModal').style.display = 'flex'; };
  document.getElementById('newLoanTabBtn').addEventListener('click', openLoanModal);
  document.getElementById('newLoanBtn').addEventListener('click', openLoanModal);

  // Fechamento de Modais
  document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('loanModal').style.display = 'none';
    document.getElementById('loanForm').reset();
  });
  document.getElementById('closeEditModal').addEventListener('click', function() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editForm').reset();
  });

  // Lógica para Navegação (Tabs)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      document.getElementById('section-title').textContent = this.querySelector('span').textContent;

      // Chama a função de carregamento da aba
      switch (tabId) {
        case 'dashboard': loadDashboardData(); break;
        case 'loans': loadLoans(); break;
        case 'books': loadBooks(); break;
        case 'users': loadUsers(); break;
        case 'reports': loadReports({}); break;
        case 'settings': if (IS_ADMIN) loadSettings(); break;
      }
    });
  });

  // --- Funções de Comunicação com a API ---

  // Função para requisições HTTP protegidas por token
  async function fetchData(endpoint, method = 'GET', body = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': AUTH_TOKEN // Adiciona o token de autenticação
        }
      };
      if (body) options.body = JSON.stringify(body);

      // CORREÇÃO CRÍTICA: Usa a variável global API_BASE_URL (definida em login-script.js)
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMsg = isJson && data.error ? data.error : data;

        if (response.status === 401 || response.status === 403) {
          alert(errorMsg);
          window.logout();
          return null;
        }
        throw new Error(`Erro ${response.status}: ${errorMsg}`);
      }
      return data;
    } catch (error) {
      console.error(`Erro de API:`, error.message);
      alert(`Erro: ${error.message}`);
      return null;
    }
  }

  // --- Lógica de Carregamento de Dados das Abas ---

  async function loadDashboardCounters() {
    const allLoans = await fetchData('/api/loans');
    books = await fetchData('/api/books') || [];
    users = await fetchData('/api/users') || [];

    if (allLoans) {
      document.getElementById('loansCount').textContent = allLoans.filter(l => l.status === 'Em andamento').length;
      document.getElementById('pendingReturns').textContent = allLoans.filter(l => l.status === 'Atrasado').length;
    }

    document.getElementById('booksCount').textContent = books.length;
    document.getElementById('usersCount').textContent = users.length;
  }

  async function loadDashboardData() {
    await loadDashboardCounters();
    const loans = await fetchData('/api/loans');
    if (loans) {
      const dashboardLoans = loans.filter(l => l.status !== 'Devolvido');
      updateLoanTable(document.getElementById('loanTableBody'), dashboardLoans, 'dashboard');
    }
  }

  async function loadLoans() {
    await loadDashboardCounters();
    const loans = await fetchData('/api/loans');
    if (loans) {
      updateLoanTable(document.getElementById('activeLoanTableBody'), loans, 'loans');
    }
  }

  async function loadBooks() {
    await loadDashboardCounters();
    updateBookTable(books);
  }

  async function loadUsers() {
    await loadDashboardCounters();
    updateUserTable(users);
  }

  async function loadReports(dates = {}) {
    let endpoint = '/api/reports/returned-loans';
    const queryParams = [];
    if (dates.start_date) queryParams.push(`start_date=${dates.start_date}`);
    if (dates.end_date) queryParams.push(`end_date=${dates.end_date}`);

    if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;

    const returnedLoans = await fetchData(endpoint);
    updateReportsTable(returnedLoans || []);
  }

  async function loadSettings() {
    const settings = await fetchData('/api/settings');
    if (settings) {
      document.getElementById('daysForReturn').value = settings.days_for_return;
      document.getElementById('finePerDay').value = settings.fine_per_day;
      document.getElementById('notificationDays').value = settings.notification_days;
    }
  }

  // --- Funções de Montagem de Tabelas ---

  function updateLoanTable(tbody, data, source) {
    tbody.innerHTML = '';
    data.forEach(loan => {
      const row = document.createElement('tr');

      let badgeClass = loan.status === 'Devolvido' ? 'badge-success' : loan.status === 'Atrasado' ? 'badge-danger' : 'badge-warning';
      let actionButton = `<span class="badge badge-success">Concluído</span>`;

      if (loan.status !== 'Devolvido' && IS_ADMIN && source === 'loans') {
        actionButton = `<button class="btn-action btn-return" onclick="window.registerReturn(${loan.id})">Devolver</button>`;
      } else if (loan.status !== 'Devolvido' && !IS_ADMIN) {
        actionButton = `<span class="badge badge-warning">Pendente</span>`;
      }

      const fineDisplay = loan.fine ? `R$ ${loan.fine}` : 'R$ 0.00';

      row.innerHTML = `
          <td>${loan.id}</td>
          <td>${loan.user}</td>
          <td>${loan.book}</td>
          <td>${loan.loan_date}</td>
          <td>${loan.return_date || '-'}</td>
          <td><span class="badge ${badgeClass}">${loan.status}</span></td>
          ${source === 'loans' ? `<td>${fineDisplay}</td>` : ''}
          ${source === 'loans' ? `<td><div class="action-buttons">${actionButton}</div></td>` : ''}
      `;
      tbody.appendChild(row);
    });
  }

  function updateBookTable(data) {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = '';
    data.forEach(book => {
      const row = document.createElement('tr');

      const availableStatus = book.available ? 'Disponível' : 'Indisponível';
      const statusClass = book.available ? 'badge-success' : 'badge-danger';

      let actionButtons = '';
      if (IS_ADMIN) {
        actionButtons = `
          <button class="btn-action btn-warning" onclick="window.editBook(${book.id})">Editar</button>
          <button class="btn-action btn-delete" onclick="window.deleteBook(${book.id})">Excluir</button>
        `;
      } else {
        actionButtons = `<span class="badge badge-gray">Visualizar</span>`;
      }

      row.innerHTML = `
        <td>${book.id}</td>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category}</td>
        <td>${book.year}</td>
        <td>${book.quantity}</td>
        <td><span class="badge ${statusClass}">${availableStatus}</span></td>
        <td><div class="action-buttons">${actionButtons}</div></td>
      `;
      tbody.appendChild(row);
    });
  }

  function updateUserTable(data) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    data.forEach(user => {
      const row = document.createElement('tr');

      let actionButtons = '';
      if (IS_ADMIN) {
        actionButtons = `
          <button class="btn-action btn-warning" onclick="window.editUser(${user.id})">Editar</button>
          <button class="btn-action btn-delete" onclick="window.deleteUser(${user.id})">Excluir</button>
        `;
      } else {
        actionButtons = `<span class="badge badge-gray">Visualizar</span>`;
      }

      const roleDisplay = user.role === 'admin' ? 'Administrador' : 'Comum';

      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email || '-'}</td>
        <td>${user.course}</td>
        <td>${roleDisplay}</td>
        <td><div class="action-buttons">${actionButtons}</div></td>
      `;
      tbody.appendChild(row);
    });
  }

  function updateReportsTable(data) {
    const tbody = document.getElementById('returnedReportsTableBody');
    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Nenhum livro devolvido encontrado para os filtros selecionados.</td></tr>`;
      return;
    }
    data.forEach(loan => {
      const row = document.createElement('tr');
      row.innerHTML = `
            <td>${loan.id}</td>
            <td>${loan.user}</td>
            <td>${loan.book}</td>
            <td>${loan.loan_date}</td>
            <td>${loan.return_date}</td>
        `;
      tbody.appendChild(row);
    });
  }

  // --- Lógica de Ações CRUD (Globais) ---

  // Função para registrar devolução (PUT)
  window.registerReturn = async function(loanId) {
    if (!IS_ADMIN) return alert('Apenas administradores podem registrar devoluções.');

    if (!confirm('Tem certeza que deseja registrar a devolução deste empréstimo?')) return;

    const result = await fetchData(`/api/loans/return/${loanId}`, 'PUT');
    if (result) {
      alert('Devolução registrada com sucesso!');
      loadLoans();
      loadDashboardCounters();
    }
  }

  // Funções de Edição/Exclusão (implementações abreviadas)
  window.editBook = async function(id) {
    if (!IS_ADMIN) return alert('Apenas administradores podem editar livros.');
    // Lógica completa de preenchimento do modal de edição (PUT /api/books/:id)
    const book = books.find(b => b.id === id);
    if (!book) return;
    document.getElementById('editModalTitle').textContent = `Editar Livro (ID: ${id})`;
    document.getElementById('editForm').dataset.endpoint = `/api/books/${id}`;
    document.getElementById('editForm').dataset.reload = 'loadBooks';
    // ... (código para montar os campos de edição aqui)
    document.getElementById('editModal').style.display = 'flex';
  }

  window.deleteBook = async function(id) {
    if (!IS_ADMIN) return alert('Apenas administradores podem excluir livros.');
    if (!confirm(`Tem certeza que deseja excluir o Livro ID ${id}? (Requer que não haja empréstimos ativos).`)) return;
    const result = await fetchData(`/api/books/${id}`, 'DELETE');
    if (result) { alert('Livro excluído com sucesso!'); loadBooks(); loadDashboardCounters(); }
  }

  window.editUser = async function(id) {
    if (!IS_ADMIN) return alert('Apenas administradores podem editar usuários.');
    // Lógica completa de preenchimento do modal de edição (PUT /api/users/:id)
    const user = users.find(u => u.id === id);
    if (!user) return;
    document.getElementById('editModalTitle').textContent = `Editar Usuário (ID: ${id})`;
    document.getElementById('editForm').dataset.endpoint = `/api/users/${id}`;
    document.getElementById('editForm').dataset.reload = 'loadUsers';
    // ... (código para montar os campos de edição aqui)
    document.getElementById('editModal').style.display = 'flex';
  }

  window.deleteUser = async function(id) {
    if (!IS_ADMIN) return alert('Apenas administradores podem excluir usuários.');
    if (!confirm(`Tem certeza que deseja excluir o Usuário ID ${id}? (Requer que não haja empréstimos ativos).`)) return;
    const result = await fetchData(`/api/users/${id}`, 'DELETE');
    if (result) { alert('Usuário excluído com sucesso!'); loadUsers(); loadDashboardCounters(); }
  }


  // --- Tratamento de Formulários ---

  // Formulário genérico de EDIÇÃO (PUT)
  document.getElementById('editForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const endpoint = this.dataset.endpoint;
    const reloadFunction = this.dataset.reload;
    const formData = Object.fromEntries(new FormData(this).entries());

    // Converte tipos numéricos
    for (const key in formData) {
      if (['year', 'quantity', 'days_for_return', 'notification_days', 'id'].includes(key)) {
        formData[key] = parseInt(formData[key]);
      } else if (key === 'fine_per_day') {
        formData[key] = parseFloat(formData[key]);
      }
    }

    const result = await fetchData(endpoint, 'PUT', formData);
    if (result) {
      alert('Alteração salva com sucesso!');
      document.getElementById('editModal').style.display = 'none';
      if (reloadFunction && typeof window[reloadFunction] === 'function') {
        window[reloadFunction]();
        loadDashboardCounters();
      }
    }
  });


  // Formulário de cadastro de livro (POST)
  document.getElementById('bookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(this).entries());

    if (!formData.title || !formData.author || !formData.quantity) return alert('Preencha todos os campos obrigatórios!');

    formData.year = parseInt(formData.year) || null;
    formData.quantity = parseInt(formData.quantity);

    const result = await fetchData('/api/books', 'POST', formData);
    if (result) {
      this.reset();
      alert('Livro cadastrado com sucesso!');
      loadBooks();
      loadDashboardCounters();
    }
  });

  // Formulário de cadastro de usuário (POST)
  document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(this).entries());

    if (!formData.name || !formData.email || !formData.password || !formData.class || !formData.course) return alert('Preencha todos os campos obrigatórios!');

    if (!IS_ADMIN || !formData.role) {
      formData.role = 'common';
    }
    formData.year = parseInt(formData.year) || null;

    const result = await fetchData('/api/users', 'POST', formData);
    if (result) {
      this.reset();
      alert('Usuário cadastrado com sucesso!');
      loadUsers();
      loadDashboardCounters();
    }
  });

  // Formulário de novo empréstimo (POST)
  document.getElementById('loanForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = {
      user_id: document.getElementById('loanUserId').value,
      book_id: document.getElementById('loanBookId').value,
      return_date: document.getElementById('loanReturnDate').value || null
    };

    if (!formData.user_id || !formData.book_id) return alert('ID do usuário e ID do livro são obrigatórios!');

    const result = await fetchData('/api/loans', 'POST', formData);
    if (result) {
      this.reset();
      document.getElementById('loanModal').style.display = 'none';
      alert('Empréstimo registrado com sucesso!');
      loadLoans();
      loadDashboardCounters();
    }
  });

  // Formulário de Configurações (POST)
  document.getElementById('settingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(this).entries());

    formData.days_for_return = parseInt(formData.days_for_return);
    formData.notification_days = parseInt(formData.notification_days);
    formData.fine_per_day = parseFloat(formData.fine_per_day);

    const result = await fetchData('/api/settings', 'POST', formData);
    if (result) {
      alert(result.message);
      loadDashboardCounters();
    }
  });

  // Formulário de Filtro de Relatórios (GET)
  document.getElementById('reportFilterForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    loadReports({ start_date: startDate, end_date: endDate });
  });

  // Lógica de Busca no modal de Empréstimo (Busca por Nome)
  const userNameSearch = document.getElementById('userNameSearch');
  const userLoanSearchResults = document.getElementById('userLoanSearchResults');
  const loanUserIdInput = document.getElementById('loanUserId');

  userNameSearch.addEventListener('input', async function() {
    const query = this.value;
    userLoanSearchResults.innerHTML = '';
    if (query.length < 3) return;

    const results = await fetchData(`/api/users/search-by-name?query=${query}`);

    if (results && results.length > 0) {
      results.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = `${user.name} (ID: ${user.id}, ${user.course})`;
        item.addEventListener('click', () => {
          loanUserIdInput.value = user.id;
          userNameSearch.value = user.name;
          userLoanSearchResults.innerHTML = '';
        });
        userLoanSearchResults.appendChild(item);
      });
    } else {
      userLoanSearchResults.innerHTML = `<div class="search-result-item">Nenhum usuário encontrado.</div>`;
    }
  });

  // Oculta resultados de busca ao clicar fora
  document.addEventListener('click', function(e) {
    if (userNameSearch && !userNameSearch.contains(e.target) && !userLoanSearchResults.contains(e.target)) {
      userLoanSearchResults.innerHTML = '';
    }
  });

  // Lógica de Busca Local em Livros
  const bookSearchInput = document.getElementById('bookSearchInput');
  if (bookSearchInput) {
    bookSearchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query)
      );
      updateBookTable(filteredBooks);
    });
  }

  // Lógica de Busca Local em Usuários
  const userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(query) || user.course.toLowerCase().includes(query)
      );
      updateUserTable(filteredUsers);
    });
  }

  // === INICIALIZAÇÃO ===
  loadDashboardData();
});
