import React, { useState } from 'react';
import { loginComEmail, criarConta, obterFazendaDoUsuario } from '../firebase/services';
import { auth } from '../firebase/config';

export default function Login({ onLoginSuccess, onVoltar }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [tipoProducao, setTipoProducao] = useState('Corte');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      let user;
      if (isLogin) {
        user = await loginComEmail(email, senha);
      } else {
        user = await criarConta(email, senha, nomeFazenda, tipoProducao);
      }
      
      // Look up farm ID
      const fazenda = await obterFazendaDoUsuario(user.uid);
      if (fazenda) {
        onLoginSuccess(fazenda.id);
      } else {
        // Fallback for demo
        if (user.uid === 'dono_demo_123') {
           onLoginSuccess('fazenda_demo_123');
        } else {
           setErrorMsg('Nenhuma fazenda vinculada a este usuário.');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-offwhite flex flex-col justify-center items-center relative overflow-hidden font-sans p-4">
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-vivid-emerald/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-vivid-teal/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Voltar Button */}
      <button 
        onClick={onVoltar} 
        className="absolute top-6 left-6 p-2 rounded-full glass-panel border border-white/60 text-forest-dark hover:bg-white/50 transition-colors z-20"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Main Glass Panel */}
      <div className="w-full max-w-md glass-panel rounded-3xl border border-white/80 p-8 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)] relative z-10 transition-all duration-300">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-lg mb-4">
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.34A1 1 0 0 0 5.18 20.5C7 17 9 14 15 13" />
              <path d="M12 8a4 4 0 0 1 4-4c0 4-3 6-4 6" />
            </svg>
          </div>
          <h2 className="text-2xl font-heading font-bold text-forest-dark tracking-tight">
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h2>
          <p className="text-sm font-medium text-forest-light mt-1">
            {isLogin ? 'Acesse os dados da sua granja' : 'Dê o primeiro passo para o futuro da avicultura'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-agriAlert-red/10 border border-agriAlert-red/30 text-agriAlert-red text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-forest-dark uppercase tracking-wider mb-1">Nome da Granja</label>
                <input 
                  type="text" 
                  required
                  value={nomeFazenda}
                  onChange={e => setNomeFazenda(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 focus:border-vivid-emerald/50 rounded-xl px-4 py-3 text-sm font-medium text-forest-dark outline-none transition-colors"
                  placeholder="Ex: Fazenda Progresso"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-forest-dark uppercase tracking-wider mb-1">Tipo de Produção</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoProducao('Corte')}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${tipoProducao === 'Corte' ? 'bg-vivid-emerald text-white border-vivid-emerald' : 'bg-white/50 border-white/60 text-forest-light hover:bg-white/80'}`}
                  >
                    Frango de Corte
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoProducao('Postura')}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${tipoProducao === 'Postura' ? 'bg-vivid-emerald text-white border-vivid-emerald' : 'bg-white/50 border-white/60 text-forest-light hover:bg-white/80'}`}
                  >
                    Galinha de Postura
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-forest-dark uppercase tracking-wider mb-1">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/50 border border-white/60 focus:border-vivid-emerald/50 rounded-xl px-4 py-3 text-sm font-medium text-forest-dark outline-none transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-forest-dark uppercase tracking-wider mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full bg-white/50 border border-white/60 focus:border-vivid-emerald/50 rounded-xl px-4 py-3 text-sm font-medium text-forest-dark outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white font-bold text-sm shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(132,204,22,0.6)] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              isLogin ? 'Entrar no Sistema' : 'Criar Conta e Granja'
            )}
          </button>
        </form>



        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
            className="text-xs font-bold text-vivid-emerald hover:text-vivid-teal transition-colors"
          >
            {isLogin ? 'Ainda não tem conta? Crie uma aqui' : 'Já tem uma granja? Faça login'}
          </button>
        </div>
      </div>
    </div>
  );
}
