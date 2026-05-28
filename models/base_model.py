"""
BaseModel — Classe abstrata para todos os modelos de análise.

Cada modelo (Comissão, Vendas, Compras, etc.) herda dessa classe
e sobrescreve métodos específicos sem reimplementar lógica comum.
"""

from abc import ABC, abstractmethod
import pandas as pd
from utils import (
    normalize_columns,
    validate_required_columns,
    add_dedup_flags,
    get_dedup_subset,
)


class BaseModel(ABC):
    """
    Classe abstrata que define a interface comum para todos os modelos.
    
    Attributes (sobrescrever nas subclasses):
        MODEL_NAME: str                 Ex: "COMISSAO", "VENDAS"
        MODEL_ICON: str                 Ex: "💰", "📈"
        COL_MAP: dict                   Ex: {"SlpName": ["Vendedor", ...]}
        REQUIRED_COLS: list             Ex: ["SlpName", "LineTotal"]
        NUMERIC_COLS: list              Ex: ["LineTotal", "Quantity"]
        TEXT_COLS: list                 Ex: ["SlpName", "CardName"]
        DATE_COLS: list                 Ex: ["ReceiveDate", "SaleDate"]
        DEDUP_ENABLED: bool             Se True, adiciona flags _lt_first, _ar_first
        DEDUP_LT_COLS: list             Colunas para LineTotal dedup
        DEDUP_AR_COLS: list             Colunas para AmountReceived dedup
        TABS: list[str]                 Ex: ["📊 Dashboard", "👤 Vendedores"]
        FILTER_COLS: list[str]          Ex: ["SlpName", "BranchName", "ReceiveMonth"]
    """
    
    # ── Defaults (sobrescrever nas subclasses) ──
    MODEL_NAME: str = "BASE"
    MODEL_ICON: str = "📊"
    COL_MAP: dict = {}
    REQUIRED_COLS: list = []
    NUMERIC_COLS: list = []
    TEXT_COLS: list = []
    DATE_COLS: list = []
    DEDUP_ENABLED: bool = False
    DEDUP_LT_COLS: list = None      # Se None, não há dedup LT
    DEDUP_AR_COLS: list = None      # Se None, não há dedup AR
    TABS: list = []
    FILTER_COLS: list = []
    
    def __init__(self, df_raw: pd.DataFrame):
        """
        Inicializa modelo com dados brutos.
        
        Args:
            df_raw: DataFrame com dados do upload
        """
        self.df_raw = df_raw.copy()
        self.df = None              # será normalizado após .load()
        self._lt = None             # subset LineTotal dedup (se habilitado)
        self._ar = None             # subset AmountReceived dedup (se habilitado)
        self._validated = False     # flag de validação
    
    # ══════════════════════════════════════════════════════════
    # PIPELINE PRINCIPAL: load() → normalize → dedup → ready to render
    # ══════════════════════════════════════════════════════════
    
    def load(self) -> "BaseModel":
        """
        Pipeline: normalize → (opcional) dedup → pronto.
        Valida após normalize antes de tentar dedup.
        """
        from utils.normalizers import normalize_columns
        
        # Step 1: Normalizar colunas
        self.df = normalize_columns(
            self.df_raw,
            col_map=self.COL_MAP,
            numeric_cols=self.NUMERIC_COLS,
            text_cols=self.TEXT_COLS,
            date_cols=self.DATE_COLS,
        )
        
        # ✅ Step 1.5: Verificar se normalizou minimamente (pelo menos 1 required)
        found_required = [c for c in self.REQUIRED_COLS if c in self.df.columns]
        if not found_required:
            # Normalização falhou completamente — não tenta dedup
            # Sinaliza mas não quebra, validate() vai reportar depois
            return self
        
        # Step 2: Dedup apenas se habilitado E colunas existem
        if self.DEDUP_ENABLED and self.DEDUP_LT_COLS:
            from utils.deduplicators import add_dedup_flags, get_dedup_subset
            self.df = add_dedup_flags(
                self.df,
                lt_key_cols=self.DEDUP_LT_COLS,  # guard interno no add_dedup_flags
                ar_key_cols=self.DEDUP_AR_COLS,
            )
            if self.DEDUP_LT_COLS and all(c in self.df.columns for c in self.DEDUP_LT_COLS):
                self._lt = self.df[self.df["_lt_first"]].copy()
            if self.DEDUP_AR_COLS and all(c in self.df.columns for c in self.DEDUP_AR_COLS):
                self._ar = self.df[self.df["_ar_first"]].copy()
        
        return self
    
    def validate(self) -> tuple[bool, list]:
        """
        Valida se todas as colunas obrigatórias estão presentes.
        
        Returns:
            (is_valid: bool, missing_cols: list)
            
        Example:
            is_ok, missing = model.validate()
            if not is_ok:
                print(f"Faltam: {missing}")
        """
        if self.df is None:
            return False, ["DataFrame não foi carregado (chame .load() primeiro)"]
        
        missing = validate_required_columns(self.df, self.REQUIRED_COLS)
        self._validated = len(missing) == 0
        return self._validated, missing
    
    # ══════════════════════════════════════════════════════════
    # MÉTODOS ABSTRATOS (cada modelo DEVE implementar)
    # ══════════════════════════════════════════════════════════
    
    @abstractmethod
    def get_kpis(self, df: pd.DataFrame = None) -> list[tuple]:
        """
        Calcula KPIs do modelo.
        
        Args:
            df: DataFrame filtrado (se None, usa self.df)
            
        Returns:
            list de tuplas (label, value, color, sub)
            
        Example:
            [
                ("💼 Vendas", "R$ 100.000,00", "indigo", "8 NFs"),
                ("💰 Comissão", "R$ 15.000,00", "green", "15% da vendas"),
            ]
        """
        pass
    
    @abstractmethod
    def get_aggregations(self, df: pd.DataFrame = None) -> dict:
        """
        Gera agregações (resumos por perspectiva).
        
        Args:
            df: DataFrame filtrado (se None, usa self.df)
            
        Returns:
            dict {perspectiva: pd.DataFrame, ...}
            
        Example:
            {
                "por_vendedor": df_agg_1,
                "por_filial": df_agg_2,
                "por_item": df_agg_3,
            }
        """
        pass
    
    @abstractmethod
    def get_charts_config(self) -> list[dict]:
        """
        Retorna configuração dos gráficos do modelo.
        
        Returns:
            list de dicts com config (tipo, cores, labels, etc.)
            
        Example:
            [
                {
                    "name": "Top Vendedores",
                    "type": "bar",
                    "x": "Vendedor",
                    "y": "Comissao",
                    "color": "#3b82f6",
                },
                ...
            ]
        """
        pass
    
    @abstractmethod
    def render_tabs(self, aggs: dict, filters: dict) -> None:
        """
        Renderiza as tabs Streamlit específicas do modelo.
        
        Args:
            aggs: dict de agregações retornado por .get_aggregations()
            filters: dict de filtros aplicados {coluna: [valores]}
            
        Note:
            Deve estar dentro de um st.tabs() context manager.
            Chama funções de templates/dashboard_template.py.
        """
        pass
    
    # ══════════════════════════════════════════════════════════
    # MÉTODOS COM DEFAULTS (podem ser sobrescritos se necessário)
    # ══════════════════════════════════════════════════════════
    
    def get_export_sheets(self, df: pd.DataFrame = None) -> dict:
        """
        Define quais sheets exibir na exportação Excel.
        
        Args:
            df: DataFrame filtrado
            
        Returns:
            dict {sheet_name: pd.DataFrame, ...}
            
        Default: retorna apenas o DataFrame detalhado.
        Sobrescrever para incluir agregações.
        """
        if df is None:
            df = self.df
        return {
            "Detalhado": df,
        }
    
    def apply_filters(self, filters_dict: dict) -> pd.DataFrame:
        """
        Aplica filtros ao DataFrame.
        
        Args:
            filters_dict: dict {coluna: [valores_selecionados], ...}
            
        Returns:
            DataFrame filtrado
        """
        filtered = self.df.copy()
        
        for col, values in filters_dict.items():
            if col in filtered.columns and values:
                filtered = filtered[filtered[col].isin(values)]
        
        return filtered
    
    # ══════════════════════════════════════════════════════════
    # UTILITIES
    # ══════════════════════════════════════════════════════════
    
    def info(self) -> dict:
        """
        Retorna informações do modelo.
        
        Returns:
            dict com metadados
        """
        return {
            "model": self.MODEL_NAME,
            "icon": self.MODEL_ICON,
            "rows": len(self.df) if self.df is not None else 0,
            "cols": len(self.df.columns) if self.df is not None else 0,
            "validated": self._validated,
        }
