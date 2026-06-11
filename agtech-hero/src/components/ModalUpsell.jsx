/**
 * src/components/ModalUpsell.jsx
 *
 * Modal de conversão comercial (Plano Essencial -> Plano Inteligente).
 * Extraído de Configuracoes.jsx para ser reutilizado pelos gatilhos de
 * upsell do CentralBI (badge de alerta bloqueado) e do DashboardReal
 * (banner de anomalia crítica).
 */
export default function ModalUpsell({ onFechar }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-forest-dark/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-[1px] bg-gradient-to-br from-vivid-emerald/60 via-vivid-teal/40 to-vivid-lime/30 shadow-2xl">
        <div className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl bg-gradient-to-br from-forest-dark to-forest p-6 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-vivid-emerald text-2xl">✨</span>
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-white">Plano Inteligente</h3>
              <p className="mt-2 text-sm font-medium text-white/75 leading-relaxed">
                Fale com nosso consultor comercial para ativar a IA preditiva, alertas explicativos e disparos diretos no WhatsApp do veterinário.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onFechar}
                className="w-full rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime py-3 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-transform"
              >
                Falar com Consultor Comercial
              </button>
              <button
                type="button"
                onClick={onFechar}
                className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white/80 hover:bg-white/15 transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
