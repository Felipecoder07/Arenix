(function() {
  const publicPages = ['login.html', 'index.html', 'landing-cadastro.html', 'esqueci-senha.html', 'portal-cliente.html', 'portal-nova-reserva.html', 'cadastro.html'];
  const path = window.location.pathname.split('/').pop() || 'dashboard.html';
  if (!publicPages.includes(path)) {
    const token = localStorage.getItem('courtmanager_token');
    console.log('AuthGuard:', {path, token: !!token});
    if (!token) {
      window.location.replace('login.html');
    }
  }
})();
