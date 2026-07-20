"""Erros de processamento com estágio + mensagem segura em pt-BR.

O upload é tratado como um fluxo de estágios nomeados. Quando algo falha,
lançamos `ProcessingError(stage, ...)` para que a API possa:
- logar o erro técnico + estágio no servidor;
- devolver ao frontend uma mensagem pt-BR segura (sem traceback do Python)
  junto do estágio, para o detalhe técnico recolhível da UI.
"""
from __future__ import annotations


class Stage:
    """Estágios de processamento (rótulos pt-BR mostrados ao usuário)."""
    READING = "Lendo estrutura da planilha"
    IDENTIFYING = "Identificando abas relevantes"
    VALIDATING_BASE = "Validando Base Unificada"
    PARSING_FISCAL = "Processando dados fiscais"
    BUSINESS_RULES = "Aplicando regras de negócio"
    SAVING = "Salvando sessão"
    DASHBOARD = "Preparando dashboard"

    ORDER = [READING, IDENTIFYING, VALIDATING_BASE, PARSING_FISCAL,
             BUSINESS_RULES, SAVING, DASHBOARD]


class ProcessingError(Exception):
    """Falha em um estágio do processamento do upload.

    `message` é seguro para exibir ao usuário (pt-BR, sem detalhes internos).
    `technical` guarda o detalhe técnico para o log do servidor.
    """

    def __init__(self, stage: str, message: str, technical: str | None = None,
                 code: str = "processing_error"):
        super().__init__(message)
        self.stage = stage
        self.message = message
        self.technical = technical or message
        self.code = code

    def to_payload(self) -> dict:
        """Corpo JSON seguro para o frontend (nunca inclui `technical` cru)."""
        return {"detail": self.message, "stage": self.stage, "code": self.code}
