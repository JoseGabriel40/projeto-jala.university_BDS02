// Simulação de funcionalidades JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Navegação
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const sectionTitle = document.getElementById('section-title');

  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      // Remove active de todos os itens
      navItems.forEach(i => i.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      // Adiciona active ao item clicado e ao conteúdo correspondente
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');

      // Atualiza o título da seção
      sectionTitle.textContent = this.querySelector('span').textContent;
    });
  });

  // Simulação de dados (em uma aplicação real, viria de uma API)
  console.log('Sistema de Biblioteca Web carregado com sucesso!');

  // Lista simulada de livros
  const books = [
    { id: '1', title: 'Dom Casmurro', author: 'Machado de Assis', available: true },
    { id: '2', title: 'O Cortiço', author: 'Aluísio Azevedo', available: false },
    { id: '3', title: 'Memórias Póstumas', author: 'Machado de Assis', available: true },
    { id: '4', title: 'A Cidade e as Serras', author: 'Eça de Queirós', available: true },
    { id: '5', title: 'Capitães da Areia', author: 'Jorge Amado', available: false }
  ];

  // Função de busca em tempo real para livros
  const bookSearchInput = document.getElementById('bookSearch');
  const bookSearchResults = document.getElementById('searchResults');

  bookSearchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    bookSearchResults.innerHTML = '';
    bookSearchResults.classList.remove('active');

    if (query.length > 0) {
      const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query)
      );

      if (filteredBooks.length > 0) {
        filteredBooks.forEach(book => {
          const resultItem = document.createElement('div');
          resultItem.className = 'search-result-item';
          resultItem.textContent = `${book.title} - ${book.author} (${book.available ? 'Disponível' : 'Indisponível'})`;
          resultItem.addEventListener('click', function() {
            alert(`Livro: ${book.title}\nAutor: ${book.author}\nStatus: ${book.available ? 'Disponível' : 'Indisponível'}`);
            bookSearchInput.value = '';
            bookSearchResults.classList.remove('active');
          });
          bookSearchResults.appendChild(resultItem);
        });
        bookSearchResults.classList.add('active');
      } else {
        const noResult = document.createElement('div');
        noResult.className = 'search-result-item';
        noResult.textContent = 'Nenhum livro encontrado';
        bookSearchResults.appendChild(noResult);
        bookSearchResults.classList.add('active');
      }
    }
  });

  // Lista simulada de usuários
  const users = [
    { id: '1', name: 'João Silva', year: 2023, class: 'A1', course: 'Redes' },
    { id: '2', name: 'Maria Santos', year: 2022, class: 'B2', course: 'Desenvolvimento' },
    { id: '3', name: 'Pedro Costa', year: 2024, class: 'C3', course: 'Zootecnia' },
    { id: '4', name: 'Ana Oliveira', year: 2023, class: 'D4', course: 'Enfermagem' }
  ];

  // Função de busca em tempo real para usuários
  const userSearchInput = document.getElementById('userSearch');
  const userSearchResults = document.getElementById('userSearchResults');

  userSearchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    userSearchResults.innerHTML = '';
    userSearchResults.classList.remove('active');

    if (query.length > 0) {
      const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(query) || user.course.toLowerCase().includes(query)
      );

      if (filteredUsers.length > 0) {
        filteredUsers.forEach(user => {
          const resultItem = document.createElement('div');
          resultItem.className = 'search-result-item';
          resultItem.textContent = `${user.name} - Ano: ${user.year}, Turma: ${user.class}, Curso: ${user.course}`;
          resultItem.addEventListener('click', function() {
            alert(`Usuário: ${user.name}\nAno: ${user.year}\nTurma: ${user.class}\nCurso: ${user.course}`);
            userSearchInput.value = '';
            userSearchResults.classList.remove('active');
          });
          userSearchResults.appendChild(resultItem);
        });
        userSearchResults.classList.add('active');
      } else {
        const noResult = document.createElement('div');
        noResult.className = 'search-result-item';
        noResult.textContent = 'Nenhum usuário encontrado';
        userSearchResults.appendChild(noResult);
        userSearchResults.classList.add('active');
      }
    }
  });

  // Fechar resultados ao clicar fora (para livros e usuários)
  document.addEventListener('click', function(e) {
    if (!bookSearchInput.contains(e.target) && !bookSearchResults.contains(e.target)) {
      bookSearchResults.classList.remove('active');
    }
    if (!userSearchInput.contains(e.target) && !userSearchResults.contains(e.target)) {
      userSearchResults.classList.remove('active');
    }
  });

  // Atualização dinâmica da tabela (simulação)
  function updateLoanTable(data) {
    const tbody = document.getElementById('loanTableBody');
    tbody.innerHTML = '';
    data.forEach(loan => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${loan.id}</td>
                <td>${loan.user}</td>
                <td>${loan.book}</td>
                <td>${loan.loanDate}</td>
                <td>${loan.returnDate}</td>
                <td><span class="badge ${loan.status === 'Devolvido' ? 'badge-success' : loan.status === 'Em andamento' ? 'badge-warning' : 'badge-danger'}">${loan.status}</span></td>
            `;
      tbody.appendChild(row);
    });
  }

  // Dados simulados para tabela
  const sampleLoans = [
    { id: '#123', user: 'João Silva', book: 'Dom Casmurro', loanDate: '10/05/2023', returnDate: '20/05/2023', status: 'Devolvido' },
    { id: '#124', user: 'Maria Santos', book: 'O Cortiço', loanDate: '15/05/2023', returnDate: '25/05/2023', status: 'Em andamento' },
    { id: '#125', user: 'Pedro Costa', book: 'Memórias Póstumas', loanDate: '18/05/2023', returnDate: '28/05/2023', status: 'Atrasado' }
  ];
  updateLoanTable(sampleLoans);

  // Validação e salvamento do formulário de livro
  document.getElementById('bookForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('.form-control');
    let isValid = true;

    inputs.forEach(input => {
      if (!input.value) {
        isValid = false;
        input.style.borderColor = 'red';
      } else {
        input.style.borderColor = '#ced4da';
      }
    });

    if (isValid) {
      // Simulação de envio
      const newBook = {
        title: inputs[0].value,
        author: inputs[1].value,
        publisher: inputs[2].value,
        year: inputs[3].value,
        isbn: inputs[4].value,
        category: inputs[5].value,
        quantity: inputs[6].value,
        available: true
      };
      books.push(newBook);
      console.log('Livro salvo:', newBook);
      this.reset();
      alert('Livro cadastrado com sucesso!');
    } else {
      alert('Preencha todos os campos!');
    }
  });

  // Validação e salvamento do formulário de usuário
  document.getElementById('userForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('.form-control');
    let isValid = true;

    inputs.forEach(input => {
      if (!input.value) {
        isValid = false;
        input.style.borderColor = 'red';
      } else {
        input.style.borderColor = '#ced4da';
      }
    });

    if (isValid) {
      // Simulação de envio
      const newUser = {
        name: inputs[0].value,
        year: inputs[1].value,
        class: inputs[2].value,
        course: inputs[3].value
      };
      users.push(newUser);
      console.log('Usuário salvo:', newUser);
      this.reset();
      alert('Usuário cadastrado com sucesso!');
    } else {
      alert('Preencha todos os campos!');
    }
  });

  // Modal para novo empréstimo
  document.getElementById('newLoanBtn').addEventListener('click', function() {
    document.getElementById('loanModal').style.display = 'flex';
  });

  document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('loanModal').style.display = 'none';
  });

  document.getElementById('loanForm').addEventListener('submit', function(e) {
    e.preventDefault();
    // Simulação de salvamento
    console.log('Empréstimo salvo');
    this.reset();
    document.getElementById('loanModal').style.display = 'none';
    alert('Empréstimo registrado com sucesso!');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Deseja realmente sair?')) {
      // Redirecionar ou limpar sessão (simulado)
      console.log('Logout realizado');
      window.location.href = '/login'; // Ajuste para sua rota real
    }
  });
});
