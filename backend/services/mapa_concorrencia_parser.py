"""
Specialized parser for Mapa de Concorrência files.

This module reads Mapa de Concorrência files directly from Excel bytes,
preserving metadata (Obra, Assunto, Data) while extracting data tables.

Unlike the generic parser, this DOES NOT discard rows 1-12.
"""

from typing import Dict, List, Any, Tuple, Optional
from io import BytesIO
import pandas as pd
import re
import openpyxl


class MapaConcorrenciaParser:
    """
    Specialized parser for "Mapa de Concorrência" Excel files.
    
    File structure:
    - Rows 1-12: Metadata (Obra, Assunto, Fornecedor info)
    - Row 13: Headers
    - Row 17+: Data
    
    Preserves ALL metadata and data in final output.
    """
    
    def __init__(self, file_bytes: bytes, filename: str):
        self.file_bytes = file_bytes
        self.filename = filename
        self.metadata: Dict[str, Any] = {}
        self.data: pd.DataFrame = pd.DataFrame()
        
    def parse(self) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Parse the Mapa file and return (dataframe, metadata).
        
        Returns:
            - df: DataFrame with all extracted data + metadata columns
            - metadata: Dict with Obra, Assunto, Data, etc.
        """
        
        # Step 1: Read raw Excel (all rows, no header inference)
        df_raw = self._read_raw_excel()
        
        # Step 2: Extract metadata from rows 1-15
        self.metadata = self._extract_metadata(df_raw)
        
        # Step 3: Find and read data table
        header_row = self._find_header_row(df_raw)
        data_start_row = header_row + 1
        
        # Find where data ends (suppliers sections start)
        data_end_row = self._find_data_end(df_raw, header_row)
        
        # Extract headers and data
        headers = df_raw.iloc[header_row].values
        data_rows = df_raw.iloc[data_start_row:data_end_row]
        
        # Create dataframe with proper headers
        self.data = pd.DataFrame(data_rows.values, columns=headers)
        self.data = self._clean_data(self.data)
        
        # Step 4: Extract supplier information
        suppliers_data = self._extract_suppliers(df_raw)
        
        # Step 5: Merge metadata and suppliers into data
        df_final = self._merge_all_data(self.data, suppliers_data)
        
        # Step 6: Add metadata columns
        for key, value in self.metadata.items():
            if value and key not in df_final.columns:
                df_final[key] = value
        
        return df_final, self.metadata
    
    def _read_raw_excel(self) -> pd.DataFrame:
        """Read Excel file WITHOUT header detection (preserves all rows)."""
        buf = BytesIO(self.file_bytes)
        
        # Read with no header to preserve rows 1-12
        try:
            df = pd.read_excel(buf, sheet_name=0, header=None, dtype=str)
        except Exception:
            # Try with openpyxl if pd.read_excel fails
            buf.seek(0)
            wb = openpyxl.load_workbook(buf, data_only=True)
            ws = wb.active
            
            data = []
            for row in ws.iter_rows(values_only=True):
                data.append(row)
            
            df = pd.DataFrame(data)
        
        return df
    
    def _extract_metadata(self, df_raw: pd.DataFrame) -> Dict[str, Any]:
        """
        Extract metadata from rows 1-15.
        
        Looks for:
        - OBRA: ...
        - ASSUNTO: ...
        - PROJETO: ...
        - DATA: ...
        - NUMERO OBRA: ...
        """
        metadata = {
            "Obra": None,
            "Assunto": None,
            "Data": None,
            "NumeroObra": None,
            "Endereco": None,
        }
        
        # Search first 20 rows for metadata
        for idx in range(min(20, len(df_raw))):
            row_values = [str(v).strip() if pd.notna(v) else "" for v in df_raw.iloc[idx].values]
            row_text = " ".join(row_values).lower()
            
            # Look for patterns like "OBRA:" followed by value
            for i, val in enumerate(row_values):
                val_lower = val.lower()
                
                if "obra" in val_lower and i + 1 < len(row_values):
                    next_val = row_values[i + 1].strip()
                    if next_val and not next_val.startswith("OBRA"):
                        metadata["Obra"] = next_val
                
                elif "assunto" in val_lower or "projeto" in val_lower:
                    if i + 1 < len(row_values):
                        next_val = row_values[i + 1].strip()
                        if next_val and not any(kw in next_val.lower() for kw in ["assunto", "projeto"]):
                            metadata["Assunto"] = next_val
                
                elif "data" in val_lower and i + 1 < len(row_values):
                    next_val = row_values[i + 1].strip()
                    if next_val and len(next_val) > 5:
                        metadata["Data"] = next_val[:10]
                
                elif "endereço" in val_lower or "endereco" in val_lower:
                    if i + 1 < len(row_values):
                        metadata["Endereco"] = row_values[i + 1].strip()
        
        return metadata
    
    def _find_header_row(self, df_raw: pd.DataFrame) -> int:
        """
        Find the header row (typically row 13, 0-indexed: 12).
        
        Looks for rows containing: ITEM, DESCRIÇÃO, QUANT, UNID, PREÇO, etc.
        """
        for idx in range(len(df_raw)):
            row_values = [str(v).lower().strip() if pd.notna(v) else "" for v in df_raw.iloc[idx].values]
            row_text = " ".join(row_values)
            
            # Check for ALL required header keywords
            has_item = any("item" in v for v in row_values)
            has_desc = any("descrição" in v or "descricao" in v or "serviço" in v or "servico" in v for v in row_values)
            has_quant = any("quant" in v for v in row_values)
            has_unit = any("unid" in v or "unit" in v for v in row_values)
            
            if has_item and has_desc and has_quant and has_unit:
                return idx
        
        # Fallback: return row 12 (0-indexed) for typical Mapa structure
        return 12
    
    def _find_data_end(self, df_raw: pd.DataFrame, header_row: int) -> int:
        """
        Find where data ends (where TOTAL or supplier sections begin).
        
        Looks for patterns like "TOTAL", "FORNECEDOR 2", etc.
        """
        start_search = header_row + 4  # Skip header + sub-headers
        
        for idx in range(start_search, len(df_raw)):
            row_values = [str(v).lower().strip() if pd.notna(v) else "" for v in df_raw.iloc[idx].values]
            row_text = " ".join(row_values)
            
            # Check for end markers
            if "total" in row_text or "fornecedor" in row_text or "endereço" in row_text:
                return idx
            
            # Check if entire row is empty
            if all(not v or v == "nan" or v == "none" for v in row_values):
                # Could be end of data
                # Check next rows for TOTAL or next supplier
                next_rows = [" ".join([str(v).lower().strip() if pd.notna(v) else "" for v in df_raw.iloc[j].values])
                            for j in range(idx + 1, min(idx + 4, len(df_raw)))]
                if any("total" in row or "fornecedor" in row or "endereço" in row for row in next_rows):
                    return idx
        
        # Default: return min(header_row + 15, len(df_raw))
        return min(header_row + 15, len(df_raw))
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and normalize data."""
        df = df.copy()
        
        # Remove completely empty rows
        df = df.dropna(how='all', axis=0)
        
        # Reset index after dropping
        df = df.reset_index(drop=True)
        
        # Remove rows where all numeric columns are NaN
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        if numeric_cols:
            df = df[~df[numeric_cols].isna().all(axis=1)]
        
        # Normalize column names
        normalized_cols = self._normalize_columns(df.columns.tolist())
        # Handle duplicates by adding suffixes
        seen = {}
        for i, col in enumerate(normalized_cols):
            if col in seen:
                seen[col] += 1
                normalized_cols[i] = f"{col}_{seen[col]}"
            else:
                seen[col] = 0
        
        df.columns = normalized_cols
        
        # Convert numeric columns
        import numpy as np
        numeric_patterns = ["quant", "preço", "preco", "valor", "total", "item"]
        for col in df.columns:
            col_lower = col.lower()
            if any(pattern in col_lower for pattern in numeric_patterns):
                df[col] = pd.to_numeric(df[col], errors='coerce').replace([np.inf, -np.inf], np.nan)
        
        return df.reset_index(drop=True)
    
    def _normalize_columns(self, columns: List[str]) -> List[str]:
        """Normalize column names."""
        normalized = []
        mapping = {
            "item": "Item",
            "nitem": "Item",
            "n.º": "Item",
            "descrição": "Descricao",
            "descricao": "Descricao",
            "quantidade": "Quant",
            "quant.": "Quant",
            "quant": "Quant",
            "unidade": "Unid",
            "unid.": "Unid",
            "unid": "Unid",
            "código": "Codigo",
            "cod": "Codigo",
            "valor unitário": "ValorUnitario",
            "preço unitário": "ValorUnitario",
            "valor unit": "ValorUnitario",
            "preço unit": "ValorUnitario",
            "valor negociado": "ValorNegociado",
            "preço negociado": "ValorNegociado",
            "valor total": "ValorTotal",
            "total": "ValorTotal",
        }
        
        for col in columns:
            # Handle NaN/None column names
            if col is None or (isinstance(col, float) and pd.isna(col)):
                normalized.append(f"Unnamed_{len(normalized)}")
                continue
            
            col_lower = str(col).lower().strip()
            
            # Try exact match
            if col_lower in mapping:
                normalized.append(mapping[col_lower])
            else:
                # Try substring match
                found = False
                for key, value in mapping.items():
                    if key in col_lower:
                        normalized.append(value)
                        found = True
                        break
                
                if not found:
                    normalized.append(col)
        
        return normalized
    
    def _extract_suppliers(self, df_raw: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Extract supplier information from rows after data table.
        
        Looks for patterns:
        - FORNECEDOR N
        - NOME: ...
        - CONTATO: ...
        - TELEFONE: ...
        - EMAIL: ...
        """
        suppliers = []
        current_supplier = None
        
        for idx in range(len(df_raw)):
            row_values = [str(v).strip() if pd.notna(v) else "" for v in df_raw.iloc[idx].values]
            row_text = " ".join(row_values).lower()
            
            # Detect new supplier
            if "fornecedor" in row_text:
                if current_supplier:
                    suppliers.append(current_supplier)
                current_supplier = {}
            
            if current_supplier:
                for i, val in enumerate(row_values):
                    val_lower = val.lower()
                    
                    if "nome" in val_lower and i + 1 < len(row_values):
                        current_supplier["nome"] = row_values[i + 1]
                    elif "contato" in val_lower and i + 1 < len(row_values):
                        current_supplier["contato"] = row_values[i + 1]
                    elif "telefone" in val_lower and i + 1 < len(row_values):
                        current_supplier["telefone"] = row_values[i + 1]
                    elif "email" in val_lower and i + 1 < len(row_values):
                        current_supplier["email"] = row_values[i + 1]
        
        if current_supplier:
            suppliers.append(current_supplier)
        
        return suppliers
    
    def _merge_all_data(self, df_data: pd.DataFrame, suppliers: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Merge supplier information into data rows.
        
        If multiple suppliers, creates one row per combination.
        """
        if not suppliers:
            return df_data
        
        # For each supplier, create a copy of the data
        dfs = []
        for supplier in suppliers:
            df_copy = df_data.copy()
            if supplier.get("nome"):
                df_copy["FornecedorNome"] = supplier["nome"]
            if supplier.get("contato"):
                df_copy["Contato"] = supplier["contato"]
            if supplier.get("telefone"):
                df_copy["Telefone"] = supplier["telefone"]
            if supplier.get("email"):
                df_copy["Email"] = supplier["email"]
            dfs.append(df_copy)
        
        return pd.concat(dfs, ignore_index=True) if dfs else df_data
