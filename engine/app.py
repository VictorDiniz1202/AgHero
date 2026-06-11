from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List

# Importar o motor preditivo construído anteriormente
# (Assumindo que o app.py e detector.py estão na mesma pasta 'engine' e sendo executados como módulo)
from detector import detectar_anomalias_diarias

app = FastAPI(title="AgTech Predictive Engine API", version="1.0.0")

# Configuração de CORS Middleware (permitir todas origens para testes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Modelos de Validação (Pydantic v2) ---

class RegistroDiarioInput(BaseModel):
    data_registro_str: str = Field(..., description="Data do registro no formato YYYY-MM-DD")
    agua_litros: float = Field(..., description="Consumo de água em litros")
    racao_kg: float = Field(..., description="Consumo de ração em kg")
    temp_max: float = Field(..., description="Temperatura máxima registrada (°C)")
    temp_min: float = Field(..., description="Temperatura mínima registrada (°C)")

class AnalisePayload(BaseModel):
    id_lote: str = Field(..., description="Identificador único do lote da fazenda")
    historico: List[RegistroDiarioInput] = Field(..., min_length=3, description="Histórico de registros diários ordenado por data (mínimo de 3 dias)")

# --- Endpoints ---

@app.get("/health")
def health_check():
    """Endpoint simples para monitoramento de saúde do microsserviço."""
    return {"status": "healthy"}

@app.post("/analisar")
def analisar(payload: AnalisePayload):
    """
    Recebe o payload validado pelo Pydantic, repassa para o motor preditivo do Pandas
    e retorna as detecções e alertas em formato XAI.
    """
    try:
        # Pydantic v2 usa model_dump() em vez de dict()
        payload_dict = payload.model_dump()
        
        # A função em detector.py processará o histórico em lote usando a lógica de Média Móvel
        resultado = detectar_anomalias_diarias(payload_dict)
        return resultado
        
    except Exception as e:
        # Se houver uma falha de conversão no Pandas ou algum tipo inesperado, retorna 500 amigável
        raise HTTPException(status_code=500, detail=f"Erro interno ao processar a análise: {str(e)}")
