import subprocess
import time
import httpx
import sys

# Garante a saída UTF-8 no console Windows
sys.stdout.reconfigure(encoding="utf-8")

print("🚀 Iniciando o servidor FastAPI (Microsserviço Preditivo)...")
server_process = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

# Aguarda o servidor iniciar
time.sleep(3)

try:
    print("\n==================================================")
    print("   INICIANDO SIMULAÇÃO DO WORKFLOW N8N")
    print("==================================================\n")
    
    # ---------------------------------------------------------
    # CENÁRIO 1: PLANO INTELIGENTE (XAI + FastAPI)
    # ---------------------------------------------------------
    payload_webhook_inteligente = {
      "id_fazenda": "FAZ_DEMO",
      "nome_fazenda": "Fazenda Modelo",
      "plano": "Inteligente",
      "contatos_autorizados": ["5511999990000"],
      "registro": {
        "id_registro": "LOTE123_2026-06-10",
        "id_lote": "LOTE123",
        "data_registro_str": "2026-06-10",
        "agua_litros": 8800,  # Queda brusca para disparar alerta
        "racao_kg": 5000,
        "mortalidade_qtd": 0,
        "temp_max": 28.0,
        "temp_min": 18.0,
        "observacoes": "Nenhuma"
      }
    }
    
    print("📡 [n8n] Recebeu Webhook do Firebase")
    print(f"   Fazenda: {payload_webhook_inteligente['nome_fazenda']}")
    print(f"   Plano: {payload_webhook_inteligente['plano']}")
    print("📡 [n8n] Rotear -> Caminho INTELIGENTE")
    print("📡 [n8n] Encaminhando dados para o Microsserviço Python...")
    
    # O n8n faria uma query para buscar os últimos dias (simulando aqui)
    historico_recente = [
        {
            "data_registro_str": f"2026-06-{dia:02d}",
            "agua_litros": 10000,
            "racao_kg": 5000,
            "temp_max": 28.0,
            "temp_min": 18.0
        }
        for dia in range(1, 7)
    ]
    historico_recente.append({
        "data_registro_str": "2026-06-10",
        "agua_litros": payload_webhook_inteligente["registro"]["agua_litros"],
        "racao_kg": payload_webhook_inteligente["registro"]["racao_kg"],
        "temp_max": payload_webhook_inteligente["registro"]["temp_max"],
        "temp_min": payload_webhook_inteligente["registro"]["temp_min"]
    })
    
    payload_api = {
        "id_lote": payload_webhook_inteligente["registro"]["id_lote"],
        "historico": historico_recente
    }
    
    resposta = httpx.post("http://127.0.0.1:8000/analisar", json=payload_api)
    dados = resposta.json()
    
    if dados.get("anomalia_detectada"):
        print("🤖 [API FastAPI] Anomalia Detectada com sucesso!")
        print(f"✉️ [n8n] Disparando nó de WhatsApp Twilio para: {payload_webhook_inteligente['contatos_autorizados']}")
        print("\n   --------------------------------------------------")
        print(f"   📱 MENSAGEM WHATSAPP:\n   {dados.get('mensagem_whatsapp')}")
        print("   --------------------------------------------------\n")
    
    print("==================================================\n")
    
    # ---------------------------------------------------------
    # CENÁRIO 2: PLANO ESSENCIAL (Upsell/FOMO via Regra Bruta)
    # ---------------------------------------------------------
    payload_webhook_essencial = {
      "id_fazenda": "FAZ_BASICA",
      "nome_fazenda": "Fazenda Básica",
      "plano": "Essencial",
      "contatos_autorizados": ["5511988880000"],
      "registro": {
        "id_lote": "LOTE999",
        "mortalidade_qtd": 15, # Alta mortalidade
      }
    }
    
    print("📡 [n8n] Recebeu Webhook do Firebase")
    print(f"   Fazenda: {payload_webhook_essencial['nome_fazenda']}")
    print(f"   Plano: {payload_webhook_essencial['plano']}")
    print("📡 [n8n] Rotear -> Caminho ESSENCIAL")
    
    if payload_webhook_essencial["registro"]["mortalidade_qtd"] > 10:
        print("⚠️ [n8n - Logic Node] Mortalidade alta detectada de forma bruta (sem IA).")
        print(f"✉️ [n8n] Disparando nó de WhatsApp Twilio de UPSELL para: {payload_webhook_essencial['contatos_autorizados']}")
        print("\n   --------------------------------------------------")
        print(f"   📱 MENSAGEM WHATSAPP:\n   ⚠️ Anomalia de mortalidade detectada no Lote {payload_webhook_essencial['registro']['id_lote']}. Ative o Plano Inteligente para receber a análise preditiva da causa e alertas automáticos via WhatsApp para seu veterinário.")
        print("   --------------------------------------------------\n")

finally:
    print("🛑 Encerrando o servidor FastAPI...")
    server_process.terminate()
    server_process.wait()
    print("✅ Simulação concluída com sucesso!")
