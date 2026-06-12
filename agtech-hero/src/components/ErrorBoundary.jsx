import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Você também pode registrar o erro em um serviço de relatórios de erro
    console.error("ErrorBoundary capturou um erro:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReload = () => {
    // Limpa caches e recarrega a página
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    window.location.reload(true);
  }

  render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI de fallback customizada
      return (
        <div className="min-h-screen bg-offwhite flex items-center justify-center p-4">
          <div className="bg-white/80 backdrop-blur-md border border-agriAlert-red/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-agriAlert-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-agriAlert-red">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-forest-dark mb-2">Ops! Algo deu errado.</h2>
            <p className="text-sm text-forest-light mb-6">
              Ocorreu um erro inesperado e a tela não pôde ser carregada. Mas não se preocupe, seus dados locais estão a salvo.
            </p>
            
            <button 
              onClick={this.handleReload}
              className="w-full bg-vivid-emerald hover:bg-vivid-lime text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg"
            >
              Recarregar Aplicativo
            </button>
            
            {this.state.error && (
              <details className="mt-6 text-left p-3 bg-red-50 text-red-800 rounded-lg text-xs overflow-auto max-h-40 border border-red-200 shadow-inner">
                <summary className="font-bold cursor-pointer">Detalhes Técnicos do Erro</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px]">
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
