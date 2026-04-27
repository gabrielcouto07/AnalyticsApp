"""
Parser for Materiais/Mapa de Concorrência files.

Handles multi-table Excel files where:
- Row 2 contains "MAPA DE CONCORRÊNCIA" or similar
- Multiple supplier sections (FORNECEDOR 1, FORNECEDOR 2, etc.)
- Each supplier has: Name, Contact, Phone, Email, followed by pricing
- Data table with: Item, Description, Quantity, Unit, Prices

Key features:
- Extracts multiple supplier blocks from single table
- Flattens hierarchical data into rows
- Handles multiple sheets
- Normalizes column names
"""

from typing import Dict, List, Any, Tuple, Optional
import pandas as pd
from datetime import datetime
import re


class MateriaisParser:
    """Parser for Materiais/Mapa de Concorrência Excel files."""
    
    # Detection patterns
    HEADER_KEYWORDS = ["MAPA DE CONCORRÊNCIA", "MAPA DE MATERIAIS", "MATERIAIS"]
    SUPPLIER_PATTERN = r"FORNECEDOR\s*(\d+)"
    OBRA_KEYWORDS = ["OBRA:", "PROJETO:", "SERVIÇO:", "ASSUNTO:"]
    DATA_START_MARKERS = ["ITEM", "DESCRIÇÃO"]
    
    @classmethod
    def can_parse(cls, df: pd.DataFrame, sheet_name: str = "", filename: str = "") -> bool:
        """
        Check if this parser can handle the given DataFrame/file.
        
        Returns True if:
        - File has "MAPA" or supplier detection patterns
        - Columns contain: Item, Descrição, Quant, Preço
        """
        # Check columns
        cols_lower = [c.lower().strip() for c in df.columns]
        required = any(
            all(any(r in c for r in reqs) for c in cols_lower)
            for reqs in [
                ["item"],
                ["descrição", "descricao"],
                ["quant"],
                ["preço", "preco", "valor"],
            ]
        )
        
        # Check filename
        filename_match = any(kw.lower() in filename.lower() for kw in ["15.2", "mapa", "mp-"])
        
        # Check sheet name
        sheet_match = sheet_name.upper() in ["MP", "MATERIALS", "MATERIAIS"]
        
        return required or filename_match or sheet_match
    
    @classmethod
    def parse(cls, df: pd.DataFrame, filename: str = "", sheet_name: str = "") -> pd.DataFrame:
        """
        Parse a Mapa de Concorrência/Materiais file.
        
        Steps:
        1. Detect work/project info (Obra, Assunto)
        2. Find supplier blocks (FORNECEDOR N)
        3. Extract data table
        4. Flatten and normalize
        """
        
        # Make a copy to avoid modifying original
        df = df.copy()
        
        # Extract metadata from filename and first rows
        metadata = cls._extract_metadata(df, filename)
        
        # Find data table (starts after headers)
        table_start = cls._find_table_start(df)
        if table_start < len(df):
            df_data = df.iloc[table_start:].copy()
        else:
            df_data = df.copy()
        
        # Extract suppliers if present
        suppliers_data = cls._extract_suppliers(df, table_start)
        
        # Normalize column names
        df_data = cls._normalize_columns(df_data)
        
        # If we have supplier data, merge it
        if suppliers_data:
            df_data = cls._merge_supplier_data(df_data, suppliers_data)
        
        # Add metadata columns
        for col, value in metadata.items():
            if value:
                df_data[col] = value
        
        # Filter out empty rows
        df_data = df_data.dropna(how='all', axis=0)
        
        # Ensure numeric columns
        numeric_cols = ["Item", "Quant", "ValorUnitario", "ValorNegociado", "ValorTotal"]
        for col in numeric_cols:
            if col in df_data.columns:
                df_data[col] = pd.to_numeric(df_data[col], errors='coerce')
        
        return df_data.reset_index(drop=True)
    
    @classmethod
    def _extract_metadata(cls, df: pd.DataFrame, filename: str) -> Dict[str, Any]:
        """Extract metadata like Obra, Assunto, Data from first rows."""
        metadata = {
            "Obra": None,
            "Assunto": None,
            "Data": None,
            "NumeroObra": None,
        }
        
        # Search first 30 rows for metadata
        df_head = df.head(30).fillna("")
        
        for idx, row in df_head.iterrows():
            row_str = str(row.values).lower()
            row_vals = [str(v).strip() for v in row.values if pd.notna(v)]
            
            # Look for OBRA
            if any("obra" in str(v).lower() for v in row_vals):
                for i, v in enumerate(row_vals):
                    if "obra" in str(v).lower() and i + 1 < len(row_vals):
                        metadata["Obra"] = str(row_vals[i + 1]).strip()
                        break
            
            # Look for ASSUNTO/PROJETO
            if any("assunto" in str(v).lower() or "projeto" in str(v).lower() for v in row_vals):
                for i, v in enumerate(row_vals):
                    if any(kw in str(v).lower() for kw in ["assunto", "projeto", "serviço"]):
                        if i + 1 < len(row_vals):
                            metadata["Assunto"] = str(row_vals[i + 1]).strip()
                            break
            
            # Look for DATA
            if any("data" in str(v).lower() for v in row_vals):
                for i, v in enumerate(row_vals):
                    if "data" in str(v).lower() and i + 1 < len(row_vals):
                        try:
                            date_str = str(row_vals[i + 1]).strip()
                            # Try to parse date
                            if len(date_str) > 5:
                                metadata["Data"] = date_str[:10]
                        except:
                            pass
                        break
        
        return metadata
    
    @classmethod
    def _find_table_start(cls, df: pd.DataFrame) -> int:
        """Find the row where the data table starts."""
        for idx, row in df.iterrows():
            row_vals = [str(v).lower().strip() for v in row.values]
            row_str = " ".join(row_vals)
            
            # Look for common header keywords
            if any(kw in row_str for kw in ["item", "descrição", "descricao", "quant"]):
                return idx + 1
        
        # Default: assume data starts after row 15
        return 15
    
    @classmethod
    def _extract_suppliers(cls, df: pd.DataFrame, table_start: int) -> List[Dict[str, Any]]:
        """
        Extract supplier information from the file.
        
        Looks for patterns like:
        - FORNECEDOR 1
        - NOME: ...
        - CONTATO: ...
        - TELEFONE: ...
        - EMAIL: ...
        - VALOR UNITÁRIO
        - VALOR NEGOCIADO
        """
        suppliers = []
        current_supplier = None
        
        for idx in range(table_start):
            row_vals = [str(v).strip() if pd.notna(v) else "" for v in df.iloc[idx].values]
            row_str = " ".join(row_vals).lower()
            
            # Detect new supplier block
            match = re.search(cls.SUPPLIER_PATTERN, row_str)
            if match:
                supplier_num = int(match.group(1))
                current_supplier = {
                    "numero": supplier_num,
                    "nome": None,
                    "contato": None,
                    "telefone": None,
                    "email": None,
                    "valor_col_a": None,
                    "valor_col_b": None,
                }
                suppliers.append(current_supplier)
            
            # Extract supplier details
            if current_supplier:
                for i, val in enumerate(row_vals):
                    val_lower = val.lower()
                    
                    if "nome" in val_lower and i + 1 < len(row_vals):
                        current_supplier["nome"] = row_vals[i + 1]
                    elif "contato" in val_lower and i + 1 < len(row_vals):
                        current_supplier["contato"] = row_vals[i + 1]
                    elif "telefone" in val_lower and i + 1 < len(row_vals):
                        current_supplier["telefone"] = row_vals[i + 1]
                    elif "email" in val_lower and i + 1 < len(row_vals):
                        current_supplier["email"] = row_vals[i + 1]
                    elif "valor inicial" in val_lower or "valor unit" in val_lower:
                        if i + 1 < len(row_vals):
                            current_supplier["valor_col_a"] = row_vals[i + 1]
                    elif "valor negociado" in val_lower:
                        if i + 1 < len(row_vals):
                            current_supplier["valor_col_b"] = row_vals[i + 1]
        
        return suppliers
    
    @classmethod
    def _normalize_columns(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize column names to standard names."""
        rename_map = {
            # Item columns
            "item": "Item",
            "nitem": "Item",
            "n.º": "Item",
            
            # Description
            "descrição": "Descricao",
            "descricao": "Descricao",
            "desc": "Descricao",
            "description": "Descricao",
            "descrição do serviço": "Descricao",
            "descrição do material": "Descricao",
            
            # Quantity
            "quantidade": "Quant",
            "quant.": "Quant",
            "qty": "Quant",
            "quant": "Quant",
            
            # Unit
            "unidade": "Unid",
            "unid.": "Unid",
            "unit": "Unid",
            "unid": "Unid",
            
            # Code
            "código": "Codigo",
            "cod.item / insu.": "Codigo",
            "cod": "Codigo",
            
            # Prices
            "valor unitário": "ValorUnitario",
            "valor unit.": "ValorUnitario",
            "valor unit": "ValorUnitario",
            "preço unitário": "ValorUnitario",
            "preço unit": "ValorUnitario",
            
            "valor negociado": "ValorNegociado",
            "preço negociado": "ValorNegociado",
            "saldo total (r$)": "ValorTotal",
            "valor total": "ValorTotal",
            "total": "ValorTotal",
        }
        
        # Create a mapping of current columns to standard names
        current_cols = {col.lower().strip(): col for col in df.columns}
        rename_actual = {}
        
        for standard, col in current_cols.items():
            for src, dst in rename_map.items():
                if src in standard:
                    rename_actual[col] = dst
                    break
        
        df = df.rename(columns=rename_actual)
        
        return df
    
    @classmethod
    def _merge_supplier_data(
        cls,
        df_data: pd.DataFrame,
        suppliers: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """
        Merge supplier information into data rows.
        
        Creates one row per combination of (item, supplier).
        """
        if not suppliers:
            return df_data
        
        # For each supplier, create a copy of the data with supplier info
        dfs = []
        
        for supplier in suppliers:
            df_copy = df_data.copy()
            
            if supplier.get("nome"):
                df_copy["FornecedorNome"] = supplier["nome"]
            if supplier.get("numero"):
                df_copy["FornecedorNumero"] = supplier["numero"]
            if supplier.get("contato"):
                df_copy["Contato"] = supplier["contato"]
            if supplier.get("telefone"):
                df_copy["Telefone"] = supplier["telefone"]
            if supplier.get("email"):
                df_copy["Email"] = supplier["email"]
            
            dfs.append(df_copy)
        
        # Combine all
        return pd.concat(dfs, ignore_index=True)
