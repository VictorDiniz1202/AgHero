import sys
from fastapi.testclient import TestClient

# Adicionar a pasta atual ao path para garantir importações corretas
sys.path.append(".")

# Importar o app do FastAPI
from app import app

client = TestClient(app)

def test_health():
    print("--- Testando endpoint GET /health ---")
    response = client.get("/health")
    print(f"Status Code: {response.status_code}")
    print(f"Resposta: {response.json()}")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    print("GET /health: OK\n")

def test_analisar_historico_vazio():
    print("--- Testando endpoint POST /analisar com histórico vazio ---")
    # Pydantic deve barrar (min_length=3 no historico) e retornar 422
    payload = {
        "id_lote": "LOTE_TESTE",
        "historico": []
    }
    response = client.post("/analisar", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Resposta: {response.json()}")
    assert response.status_code == 422
    print("POST /analisar (historico vazio): OK (Retornou 422 conforme esperado)\n")

def test_analisar_queda_agua():
    print("--- Testando endpoint POST /analisar com queda de 12% de água ---")
    # Histórico estável de 6 dias (10.000 L) e queda no 7º dia (8.800 L)
    historico = [
        {
            "data_registro_str": f"2026-06-{dia:02d}",
            "agua_litros": 10000,
            "racao_kg": 5000,
            "temp_max": 28.0,
            "temp_min": 18.0
        }
        for dia in range(1, 7)
    ]
    # 7º dia: queda de 12% no consumo de água
    historico.append({
        "data_registro_str": "2026-06-07",
        "agua_litros": 8800,
        "racao_kg": 5000,
        "temp_max": 28.0,
        "temp_min": 18.0
    })
    
    payload = {
        "id_lote": "LOTE_TESTE",
        "historico": historico
    }
    response = client.post("/analisar", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Resposta:")
    import json
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    assert response.status_code == 200
    assert response.json()["anomalia_detectada"] is True
    print("POST /analisar (queda de 12%): OK (Anomalia detectada com sucesso!)\n")

if __name__ == "__main__":
    # Garante saída UTF-8 no console
    sys.stdout.reconfigure(encoding="utf-8")
    
    # Executar testes
    try:
        test_health()
        test_analisar_historico_vazio()
        test_analisar_queda_agua()
        print("🎉 Todos os cenários de teste passaram com sucesso!")
    except Exception as e:
        print(f"❌ Falha nos testes: {e}")
        sys.exit(1)
