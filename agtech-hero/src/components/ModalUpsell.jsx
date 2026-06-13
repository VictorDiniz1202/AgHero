import { useState } from 'react';
import { criarSessaoCheckout, atualizarPlanoFazenda } from '../firebase/services';
import { auth } from '../firebase/config';

/**
 * src/components/ModalUpsell.jsx
 *
 * Modal de conversão comercial (Plano Standard -> Plano Pro).
 * Extraído de Configuracoes.jsx para ser reutilizado pelos gatilhos de
 * upsell do CentralBI (badge de alerta bloqueado) e do DashboardReal
 * (banner de anomalia crítica).
 */
export default function ModalUpsell({ id_fazenda, onFechar }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [simuladorAberto, setSimuladorAberto] = useState(false);

  const handleUpgrade = async () => {
    if (!navigator.onLine) {
      setErro("Você está offline. Conecte-se à internet para realizar o pagamento.");
      setTimeout(() => setErro(null), 4000);
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      await criarSessaoCheckout(id_fazenda, auth.currentUser?.uid);
      setSimuladorAberto(true);
    } catch (err) {
      setErro("Falha ao criar sessão de checkout.");
      setTimeout(() => setErro(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleSimularPagamento = async () => {
    try {
      await atualizarPlanoFazenda(id_fazenda, 'Inteligente');
      onFechar();
    } catch(err) {
      setErro("Falha ao atualizar o plano.");
      setTimeout(() => setErro(null), 4000);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-forest-dark/40 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-[1px] bg-gradient-to-br from-vivid-emerald/60 via-vivid-teal/40 to-vivid-lime/30 shadow-2xl relative">
          
          {erro && (
            <div className="absolute -top-14 left-0 right-0 bg-agriAlert-red text-white text-xs font-bold p-3 rounded-xl shadow-lg text-center z-20">
              {erro}
            </div>
          )}

          <div className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl bg-gradient-to-br from-forest-dark to-forest p-6 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                <span className="text-vivid-emerald text-2xl">✨</span>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-white">Plano Pro</h3>
                <p className="mt-2 text-sm font-medium text-white/75 leading-relaxed">
                  Ative a IA preditiva, alertas explicativos e disparos diretos no WhatsApp do veterinário.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={loading || !navigator.onLine}
                  className="w-full rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime py-3 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-transform disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                      Acessando Checkout Seguro...
                    </>
                  ) : (
                    "Ativar Plano Pro"
                  )}
                </button>
                
                {!navigator.onLine && (
                  <p className="text-[10px] text-agriAlert-orange bg-agriAlert-orange/10 px-2 py-1.5 rounded-lg border border-agriAlert-orange/20">
                    ⚠️ Operação indisponível offline
                  </p>
                )}

                <button
                  type="button"
                  onClick={onFechar}
                  disabled={loading}
                  className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white/80 hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {simuladorAberto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center space-y-5 shadow-2xl">
            {import.meta.env.DEV ? (
              <>
                <div>
                  <h3 className="text-lg font-heading font-bold text-forest-dark">Simulador de Gateway</h3>
                  <p className="mt-1 text-xs font-medium text-forest-light">Ambiente de testes (Sandbox) — disponível apenas em desenvolvimento.</p>
                </div>
                <button
                  onClick={handleSimularPagamento}
                  className="w-full rounded-xl bg-vivid-emerald py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
                >
                  Confirmar Pagamento Simulado
                </button>
              </>
            ) : (
              <div>
                <h3 className="text-lg font-heading font-bold text-forest-dark">Checkout em implantação</h3>
                <p className="mt-1 text-xs font-medium text-forest-light">O pagamento online estará disponível em breve. Fale com o suporte para ativar o Plano Pro.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSimuladorAberto(false)}
              className="w-full rounded-xl bg-forest-dark/5 py-3 text-sm font-bold text-forest-dark/70 active:scale-95 transition-transform"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
