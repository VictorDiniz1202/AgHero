export function traduzirErroAuth(error) {
  if (!error) return 'Ocorreu um erro desconhecido.';
  
  // Extrai o código de erro real
  // O erro pode vir como error.code, ou dentro de error.message (ex: "Firebase: Error (auth/api-key-not-valid...).")
  let codigoErro = error.code || '';
  
  // Se não tem error.code, tenta extrair da mensagem via regex
  if (!codigoErro && typeof error.message === 'string') {
    const match = error.message.match(/\((auth\/[^\)]+)\)/);
    if (match && match[1]) {
      codigoErro = match[1];
    }
  }

  switch (codigoErro) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou senha incorretos. Verifique seus dados e tente novamente.';
    
    case 'auth/invalid-email':
      return 'O formato do e-mail é inválido.';
    
    case 'auth/email-already-in-use':
      return 'Este e-mail já está sendo usado por outra conta.';
      
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha mais forte (mínimo de 6 caracteres).';

    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente novamente.';

    case 'auth/too-many-requests':
      return 'Muitas tentativas falhas. Aguarde um momento e tente novamente.';

    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/api-key-not-valid':
      return 'Erro de configuração no servidor (API Key inválida). Por favor, contate o suporte ou verifique as configurações do sistema.';

    default:
      // Retorna a mensagem original se não houver tradução, ou uma genérica
      return error.message || 'Erro na autenticação. Tente novamente mais tarde.';
  }
}
