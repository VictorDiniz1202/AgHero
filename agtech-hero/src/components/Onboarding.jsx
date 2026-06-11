import React, { useState } from "react";
import { concluirOnboarding } from "../firebase/services";
import { auth } from "../firebase/config";

export default function Onboarding({ onFechar }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bem-vindo ao AgTech Hero! 🚀",
      description: "O sistema de gestão inteligente feito para a realidade do campo. Gerencie seus lotes mesmo sem internet (Offline-First) e conte com nossa IA para prever problemas antes que aconteçam.",
      icon: "📶"
    },
    {
      title: "Gestão na Prática 📝",
      description: "No seu dia a dia, crie lotes e registre manejos (ração, água, mortalidade) usando o botão flutuante '+' no menu ou no painel. É rápido e feito para ser usado com luvas, debaixo de sol forte.",
      icon: "🐓"
    },
    {
      title: "Alertas Inteligentes 🚨",
      description: "Fique tranquilo. Nossa inteligência analisa o consumo diário e te avisa via alertas meteorológicos e zootécnicos se houver risco de estresse térmico ou doenças.",
      icon: "🧠"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handleFinish = async () => {
    const user = auth.currentUser;
    if (user) {
      await concluirOnboarding(user.uid);
    }
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="glass-panel w-[90%] max-w-md p-6 sm:p-8 rounded-[2rem] shadow-2xl transform scale-100 transition-transform duration-300 border border-white/20 bg-white/70 relative">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-vivid-emerald/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-vivid-lime/20 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 text-center flex flex-col items-center">
          <div className="text-5xl mb-4 p-4 bg-gradient-to-br from-white to-offwhite rounded-full shadow-inner border border-white/50">
            {steps[step].icon}
          </div>
          
          <h2 className="text-2xl font-heading font-bold text-forest-dark mb-3">
            {steps[step].title}
          </h2>
          
          <p className="text-sm text-forest-light font-medium leading-relaxed min-h-[80px]">
            {steps[step].description}
          </p>
        </div>

        <div className="flex justify-center gap-2 mt-8 mb-6 relative z-10">
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-2 rounded-full transition-all duration-300 ${idx === step ? "w-8 bg-vivid-emerald" : "w-2 bg-forest-light/30"}`} 
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col gap-3">
          {step < steps.length - 1 ? (
            <button 
              onClick={handleNext}
              className="w-full py-3.5 rounded-xl bg-forest-dark text-white font-bold text-sm shadow-md hover:bg-forest transition-colors"
            >
              Próximo
            </button>
          ) : (
            <button 
              onClick={handleFinish}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 text-white font-bold text-sm shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:scale-105 transition-transform duration-300"
            >
              Vamos começar!
            </button>
          )}
          
          {step < steps.length - 1 && (
            <button 
              onClick={handleFinish}
              className="w-full py-2 text-xs font-bold text-forest-light hover:text-forest-dark transition-colors"
            >
              Pular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
