// login-script.js: Gerencia o fluxo de autenticação e sessão no frontend

const API_BASE_URL = 'http://localhost:3000';
const LOGIN_PAGE_URL = 'login.html';

// Função para checar o status de login e gerenciar redirecionamentos
function checkLogin() {
  const token = localStorage.getItem('authToken');
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const currentPageIsLogin = window.location.pathname.endsWith(LOGIN_PAGE_URL) || window.location.pathname.endsWith('/');

  if (!token || !user) {
    if (!currentPageIsLogin) {
      window.location.href = LOGIN_PAGE_URL;
    }
    return false;
  }

  if (currentPageIsLogin && token) {
    window.location.href = 'index.html';
    return true;
  }

  return { token, user };
}

// Lógica de Login: Só é executada na página de login
const currentPageIsLogin = window.location.pathname.endsWith(LOGIN_PAGE_URL) || window.location.pathname.endsWith('/');

if (currentPageIsLogin) {
  if (checkLogin()) {
    // Já logado
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      const loginForm = document.getElementById('loginForm');
      const loginMessage = document.getElementById('loginMessage');
      const registerModal = document.getElementById('registerModal');

      // --- Lógica de Login ---
      if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
          e.preventDefault();
          loginMessage.textContent = '';

          const email = document.getElementById('loginEmail').value;
          const password = document.getElementById('loginPassword').value;

          try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
              localStorage.setItem('authToken', data.token);
              localStorage.setItem('currentUser', JSON.stringify(data.user));
              window.location.href = 'index.html';
            } else {
              loginMessage.textContent = data.error || 'Erro ao tentar fazer login.';
            }
          } catch (error) {
            loginMessage.textContent = 'Erro de conexão com o servidor.';
          }
        });
      }

      // --- Lógica de Cadastro Público (Simplificada) ---

      // Abertura e Fechamento do Modal
      const openModalBtn = document.getElementById('openRegisterModal');
      const closeModalBtn = document.getElementById('closeRegisterModal');

      if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
          registerModal.style.display = 'flex';
        });
      }

      if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
          registerModal.style.display = 'none';
        });
      }

      if (registerModal) {
        registerModal.addEventListener('click', (e) => {
          if (e.target.id === 'registerModal') registerModal.style.display = 'none';
        });
      }

      // Submissão do Formulário de Cadastro (agora envia apenas email e password)
      const registerForm = document.getElementById('registerForm');
      if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
          e.preventDefault();

          // Captura apenas email e password
          const email = registerForm.elements['email'].value;
          const password = registerForm.elements['password'].value;

          const formData = { email, password };

          try {
            const response = await fetch(`${API_BASE_URL}/api/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
              // Substituído alert() por console.log, conforme regras de usabilidade
              console.log(data.message);
              registerModal.style.display = 'none';
              document.getElementById('loginForm').reset();

              // Opcional: pré-preencher o login com o novo email
              document.getElementById('loginEmail').value = email;
            } else {
              console.error(data.error || 'Falha ao cadastrar usuário.');
              // Usar um feedback visual em vez de alert() em um app real
              alert(data.error || 'Falha ao cadastrar usuário. Verifique se o e-mail já está em uso.');
            }
          } catch (error) {
            console.error('Erro de conexão ao tentar cadastrar:', error);
            alert('Erro de conexão ao tentar cadastrar.');
          }
        });
      }
    });
  }
} else {
  // Lógica para a página principal (index.html)
  const session = checkLogin();
  if (session) {
    window.USER_SESSION = session.user;
    window.AUTH_TOKEN = session.token;
  }
}


// Função global de Logout
window.logout = async function() {
  const token = localStorage.getItem('authToken');

  try {
    await fetch(`${API_BASE_URL}/api/logout`, {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
  } catch(e) {
    console.error('Erro ao notificar o servidor sobre o logout:', e);
  } finally {
    localStorage.clear();
    window.location.href = LOGIN_PAGE_URL;
  }
}
