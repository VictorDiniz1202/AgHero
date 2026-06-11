"""
Motor de Detecção de Anomalias Diárias - Agtech

Analisa o histórico recente de registros diários de uma fazenda (lote) e
identifica desvios sanitários, de consumo e climáticos. Para cada anomalia
encontrada, gera um alerta em português, curto e acionável, pronto para ser
enviado ao produtor via WhatsApp (XAI - IA Explicável).

Entrada esperada (payload JSON):
{
    "id_lote": "LOTE123",
    "historico": [
        {
            "data_registro_str": "2026-06-04",
            "agua_litros": 10000,
            "racao_kg": 5000,
            "temp_max": 28.5,
            "temp_min": 18.0
        },
        ...
    ]
}

O "historico" deve estar ordenado (ou ser ordenável) por data, com o último
registro representando o dia atual a ser avaliado.
"""

import pandas as pd


# ---------------------------------------------------------------------------
# Parâmetros de negócio (limiares definidos junto à equipe zootécnica)
# ---------------------------------------------------------------------------
JANELA_MEDIA_MOVEL = 3          # dias usados na média móvel de consumo
DIAS_MINIMOS_ANALISE = 3        # mínimo de registros para tentar a análise
LIMIAR_QUEDA_AGUA = 0.10        # queda > 10% no consumo de água sinaliza alerta
RATIO_AGUA_RACAO_MIN = 1.6      # abaixo disso, conversão fora do esperado
RATIO_AGUA_RACAO_MAX = 2.5      # acima disso, conversão fora do esperado
TEMP_MAX_CRITICA = 32.0         # °C - acima disso, risco de estresse térmico


def _construir_dataframe(historico):
    """Converte a lista de registros diários em um DataFrame indexado por data."""
    df = pd.DataFrame(historico)
    df["data_registro_str"] = pd.to_datetime(df["data_registro_str"])
    df = df.sort_values("data_registro_str").reset_index(drop=True)
    df = df.set_index("data_registro_str")
    return df


def _calcular_medias_moveis(df):
    """
    Calcula a média móvel de 3 dias para água e ração.

    Usamos `.shift(1)` para que a média móvel represente o comportamento
    dos dias ANTERIORES ao dia avaliado (a "linha de base"), evitando que o
    próprio valor do dia atual "dilua" a comparação e mascare uma queda.
    """
    df["media_movel_agua"] = (
        df["agua_litros"].rolling(window=JANELA_MEDIA_MOVEL).mean().shift(1)
    )
    df["media_movel_racao"] = (
        df["racao_kg"].rolling(window=JANELA_MEDIA_MOVEL).mean().shift(1)
    )
    return df


def _detectar_anomalias(registro_atual, id_lote):
    """Aplica as regras de negócio sobre o registro do dia atual e retorna
    uma lista de mensagens de alerta (XAI) em português."""
    alertas = []

    agua_hoje = registro_atual["agua_litros"]
    racao_hoje = registro_atual["racao_kg"]
    temp_max_hoje = registro_atual["temp_max"]
    media_movel_agua = registro_atual["media_movel_agua"]

    # --- Anomalia sanitária / queda de consumo de água ---------------------
    if pd.notna(media_movel_agua) and media_movel_agua > 0:
        queda_percentual = (media_movel_agua - agua_hoje) / media_movel_agua
        if queda_percentual > LIMIAR_QUEDA_AGUA:
            percentual = round(queda_percentual * 100)
            alertas.append(
                f"⚠️ **Atenção:** O consumo de água caiu {percentual}% no Lote {id_lote}. "
                "Isso é um sinal clássico de início de infecção ou entupimento de "
                "bebedouro. Verifique os bebedouros e as aves imediatamente."
            )

    # --- Desvio crítico na conversão Água/Ração -----------------------------
    if pd.notna(racao_hoje) and racao_hoje > 0:
        ratio_agua_racao = agua_hoje / racao_hoje
        if ratio_agua_racao < RATIO_AGUA_RACAO_MIN or ratio_agua_racao > RATIO_AGUA_RACAO_MAX:
            alertas.append(
                f"⚠️ **Atenção:** A relação Água/Ração do Lote {id_lote} está em "
                f"{ratio_agua_racao:.2f}, fora da faixa normal (1.6 a 2.5). Isso pode "
                "indicar problema de apetite, doença ou falha no fornecimento de "
                "ração ou água. Verifique comedouros, bebedouros e o comportamento das aves."
            )

    # --- Estresse térmico -----------------------------------------------------
    if pd.notna(temp_max_hoje) and temp_max_hoje > TEMP_MAX_CRITICA:
        alertas.append(
            f"⚠️ **Alerta Térmico:** Temperatura crítica de {temp_max_hoje}°C detectada "
            f"no Lote {id_lote}. Perigo de mortalidade por calor. Acione os exaustores "
            "e a nebulização agora."
        )

    return alertas


def formatar_saida_xai(alertas, id_lote, log=None):
    """Monta o JSON de saída padronizado com o resultado da análise (IA Explicável)."""
    saida = {
        "anomalia_detectada": bool(alertas),
        "id_lote": id_lote,
        "alertas": alertas,
        "mensagem_whatsapp": "\n\n".join(alertas) if alertas else None,
    }
    if log:
        saida["log"] = log
    return saida


def detectar_anomalias_diarias(payload):
    """
    Função principal do motor preditivo.

    Recebe o payload JSON (já desserializado em dict) com o histórico recente
    de registros diários de um lote e retorna o resultado da análise de
    anomalias no formato XAI (IA Explicável).
    """
    id_lote = payload.get("id_lote", "desconhecido")
    historico = payload.get("historico", [])

    # Tratamento de erro: histórico insuficiente para qualquer análise confiável
    if len(historico) < DIAS_MINIMOS_ANALISE:
        log = (
            f"Histórico insuficiente para análise: {len(historico)} dia(s) recebido(s), "
            f"mínimo de {DIAS_MINIMOS_ANALISE} dias necessário."
        )
        return formatar_saida_xai(alertas=[], id_lote=id_lote, log=log)

    df = _construir_dataframe(historico)
    df = _calcular_medias_moveis(df)

    registro_atual = df.iloc[-1]
    alertas = _detectar_anomalias(registro_atual, id_lote)

    return formatar_saida_xai(alertas, id_lote)


if __name__ == "__main__":
    import json
    import sys

    # Garante saída UTF-8 no console (necessário no Windows para emojis/acentos)
    sys.stdout.reconfigure(encoding="utf-8")

    # ------------------------------------------------------------------
    # Cenário 1: histórico estável de 7 dias, água sempre em 10.000L
    # Esperado: anomalia_detectada = false
    # ------------------------------------------------------------------
    historico_estavel = [
        {
            "data_registro_str": f"2026-06-{dia:02d}",
            "agua_litros": 10000,
            "racao_kg": 5000,
            "temp_max": 28.0,
            "temp_min": 18.0,
        }
        for dia in range(1, 8)
    ]

    payload_1 = {"id_lote": "LOTE123", "historico": historico_estavel}
    resultado_1 = detectar_anomalias_diarias(payload_1)
    print("Cenário 1 - histórico estável:")
    print(json.dumps(resultado_1, indent=2, ensure_ascii=False))
    print()

    # ------------------------------------------------------------------
    # Cenário 2: igual ao anterior, mas o 7º dia cai para 8.800L de água
    # Esperado: anomalia_detectada = true, queda de 12%
    # ------------------------------------------------------------------
    historico_queda_agua = [dict(registro) for registro in historico_estavel]
    historico_queda_agua[-1]["agua_litros"] = 8800

    payload_2 = {"id_lote": "LOTE123", "historico": historico_queda_agua}
    resultado_2 = detectar_anomalias_diarias(payload_2)
    print("Cenário 2 - queda de 12% no consumo de água:")
    print(json.dumps(resultado_2, indent=2, ensure_ascii=False))
