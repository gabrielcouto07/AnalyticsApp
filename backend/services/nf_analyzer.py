"""
NF-specific analyzer for 12.csv
Provides advanced analytics, grouping, and formatting for NF template
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class NFAnalyzer:
    """Specialized analyzer for NF (Notas Fiscais) data"""
    
    # Expected column identifiers
    VALOR_KEYWORDS = ['VALOR', 'VALUE', 'AMOUNT', 'TOTAL']
    FORNECEDOR_KEYWORDS = ['FORNECEDOR', 'SUPPLIER', 'VENDOR', 'EMPRESA']
    NATUREZA_KEYWORDS = ['NATUREZA', 'TYPE', 'CATEGORY', 'TIPO', 'NATURE']
    PAGAMENTO_KEYWORDS = ['BOLETO', 'DEPOSITO', 'PAYMENT', 'PAGAMENTO', 'METHOD']
    DATA_KEYWORDS = ['DATA', 'DATE', 'VENCTO', 'VENCIMENTO', 'DUE']
    NF_KEYWORDS = ['NF', 'INVOICE', 'RECIBO', 'NUMERO', 'NOTA']
    COD_KEYWORDS = ['COD', 'CODE', 'PERIOD', 'MES', 'MONTH']
    
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.original_df = df.copy()
        self.column_map = {}
        
        logger.warning(f"NFAnalyzer INIT - DataFrame shape: {df.shape}")
        logger.warning(f"NFAnalyzer INIT - Columns ({len(df.columns)}): {df.columns.tolist()}")
        
        try:
            self._clean_columns()
            self._detect_and_map_columns()
            self._clean_data()
        except Exception as e:
            logger.error(f"Error initializing NFAnalyzer: {str(e)}")
            raise
    
    def _clean_columns(self):
        """Clean column names: remove newlines, extra spaces, and encoding issues"""
        self.df.columns = [
            col.replace('\n', ' ').replace('\r', ' ')
            .replace('\t', ' ')
            .replace('  ', ' ')
            .strip() 
            for col in self.df.columns
        ]
        
        # Remove completely empty columns
        self.df = self.df.loc[:, (self.df != '').any(axis=0)]
    
    def _find_column(self, keywords: List[str], exclude_keywords: List[str] = None) -> Optional[str]:
        """Find a column matching any of the keywords"""
        if exclude_keywords is None:
            exclude_keywords = []
            
        for col in self.df.columns:
            col_upper = col.upper()
            
            # Check exclusions first
            if any(excl in col_upper for excl in exclude_keywords):
                continue
                
            # Check if any keyword matches
            for keyword in keywords:
                if keyword in col_upper:
                    return col
        return None
    
    def _find_numeric_column(self, col_names: List[str]) -> Optional[str]:
        """Find first numeric column from list of candidates, handling Portuguese number format"""
        for col_name in col_names:
            if col_name not in self.df.columns:
                continue
                
            col = self.df[col_name]
            # Try to convert to numeric, handling Portuguese format (comma as decimal)
            numeric_count = 0
            for val in col:
                if pd.isna(val):
                    continue
                val_str = str(val).strip()
                if not val_str:
                    continue
                # Try converting as-is first
                try:
                    float(val_str)
                    numeric_count += 1
                    continue
                except:
                    pass
                # Try Portuguese format (comma as decimal, dot as thousands separator)
                try:
                    converted = val_str.replace('.', '').replace(',', '.')
                    float(converted)
                    numeric_count += 1
                except:
                    pass
            
            # If more than 10% of values are numeric, likely a value column
            if numeric_count > len(col) * 0.1:
                logger.info(f"NFAnalyzer - Column '{col_name}' detected as numeric ({numeric_count} values)")
                return col_name
        return None
    
    def _find_text_column(self, col_names: List[str]) -> Optional[str]:
        """Find first text column from list of candidates"""
        for col_name in col_names:
            if col_name not in self.df.columns:
                continue
                
            col = self.df[col_name]
            # Count non-null, non-numeric values
            text_values = 0
            for val in col:
                if pd.notna(val):
                    val_str = str(val).strip()
                    if val_str and val_str.lower() not in {'nan', 'none', 'nat'}:
                        text_values += 1
            
            # If more than 10% are text, likely a text column
            if text_values > len(col) * 0.1:
                logger.info(f"NFAnalyzer - Column '{col_name}' has {text_values} text values")
                return col_name
        return None
    
    def _detect_and_map_columns(self):
        """Intelligently detect and map essential columns by analyzing data content"""
        logger.warning(f"NFAnalyzer INIT - Columns ({len(self.df.columns)}): {self.df.columns.tolist()}")
        
        # If exact matches don't work, try to detect by data characteristics
        if not self.column_map.get('VALOR'):
            valor_col = self._find_numeric_column(['value', 'amount', 'total', 'col_6', 'col_5', 'col_8'])
            if valor_col:
                self.column_map['VALOR'] = valor_col
                logger.info(f"NFAnalyzer - Detected VALOR column (by data): {valor_col}")
            else:
                logger.warning("NFAnalyzer - VALOR column NOT found even by data analysis!")
        
        # Try to find supplier/vendor column
        if not self.column_map.get('FORNECEDOR'):
            fornecedor_col = self._find_text_column(['supplier', 'vendor', 'empresa', 'fornecedor', 'col_2', 'col_3', 'col_1'])
            if fornecedor_col:
                self.column_map['FORNECEDOR'] = fornecedor_col
                logger.info(f"NFAnalyzer - Detected FORNECEDOR column (by data): {fornecedor_col}")
            else:
                logger.warning("NFAnalyzer - FORNECEDOR column NOT found even by data analysis!")
        
        # Find NATUREZA
        natureza_col = self._find_column(self.NATUREZA_KEYWORDS)
        if natureza_col:
            self.column_map['NATUREZA'] = natureza_col
        
        # Find PAGAMENTO
        pagamento_col = self._find_column(self.PAGAMENTO_KEYWORDS)
        if pagamento_col:
            self.column_map['BOLETO_DEPOSITO'] = pagamento_col
        
        # Find DATA
        data_col = self._find_column(self.DATA_KEYWORDS)
        if data_col:
            self.column_map['DATA_VENCTO'] = data_col
        
        # Find NF
        nf_col = self._find_column(self.NF_KEYWORDS, ['REPETIDAS', 'PLANILHA'])
        if nf_col:
            self.column_map['NF'] = nf_col
        
        # Find COD
        cod_col = self._find_column(self.COD_KEYWORDS)
        if cod_col:
            self.column_map['COD'] = cod_col
        
        logger.info(f"Detected column mapping: {self.column_map}")
    
    def _clean_data(self):
        """Clean and normalize data values"""
        try:
            # Convert VALOR to numeric
            if 'VALOR' in self.column_map:
                valor_col = self.column_map['VALOR']
                self.df[valor_col] = pd.to_numeric(
                    self.df[valor_col].astype(str)
                    .str.replace('.', '', regex=False)
                    .str.replace(',', '.', regex=False),
                    errors='coerce'
                )
                # Rename for consistency
                if valor_col != 'VALOR':
                    self.df = self.df.rename(columns={valor_col: 'VALOR'})
                    self.column_map['VALOR'] = 'VALOR'
            
            # Clean other columns
            for key, col in list(self.column_map.items()):
                if key != 'VALOR' and col in self.df.columns:
                    # Trim whitespace
                    if self.df[col].dtype == 'object':
                        self.df[col] = self.df[col].astype(str).str.strip()
                    
                    # Rename for consistency
                    if col != key:
                        self.df = self.df.rename(columns={col: key})
                        self.column_map[key] = key
        except Exception as e:
            logger.error(f"Error cleaning data: {str(e)}")
    
    def get_summary(self) -> Dict[str, Any]:
        """Get overall summary metrics"""
        try:
            # Filter rows with actual NF data (has VALOR)
            if 'VALOR' not in self.df.columns:
                return self._empty_summary()
            
            df_valid = self.df[pd.to_numeric(self.df['VALOR'], errors='coerce').notna()].copy()
            
            if len(df_valid) == 0:
                return self._empty_summary()
            
            total_nfs = len(df_valid)
            total_value = pd.to_numeric(df_valid['VALOR'], errors='coerce').sum()
            
            # Get unique suppliers
            unique_suppliers = 0
            if 'FORNECEDOR' in self.df.columns:
                unique_suppliers = df_valid['FORNECEDOR'].nunique()
            
            avg_value = pd.to_numeric(df_valid['VALOR'], errors='coerce').mean()
            
            return {
                "total_nfs": int(total_nfs),
                "total_value": float(total_value) if pd.notna(total_value) else 0,
                "unique_suppliers": int(unique_suppliers),
                "average_invoice_value": float(avg_value) if pd.notna(avg_value) else 0,
                "data_quality": {
                    "total_rows": len(self.df),
                    "valid_rows": len(df_valid),
                    "completeness_percentage": round(100 * len(df_valid) / len(self.df), 2) if len(self.df) > 0 else 0
                }
            }
        except Exception as e:
            logger.error(f"Error in get_summary: {str(e)}")
            return self._empty_summary()
    
    def _empty_summary(self) -> Dict[str, Any]:
        """Return empty summary structure"""
        return {
            "total_nfs": 0,
            "total_value": 0,
            "unique_suppliers": 0,
            "average_invoice_value": 0,
            "data_quality": {
                "total_rows": len(self.df),
                "valid_rows": 0,
                "completeness_percentage": 0
            }
        }
    
    def get_supplier_analysis(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Analyze data by supplier"""
        try:
            if 'FORNECEDOR' not in self.df.columns or 'VALOR' not in self.df.columns:
                return []
            
            df_valid = self.df.copy()
            df_valid['VALOR_NUM'] = pd.to_numeric(df_valid['VALOR'], errors='coerce')
            df_valid = df_valid[df_valid['VALOR_NUM'].notna()].copy()
            
            if len(df_valid) == 0:
                return []
            
            analysis = df_valid.groupby('FORNECEDOR').agg({
                'VALOR_NUM': ['sum', 'count', 'mean', 'min', 'max']
            }).reset_index()
            
            analysis.columns = ['supplier', 'total_value', 'invoice_count', 'avg_value', 'min_value', 'max_value']
            analysis = analysis.sort_values('total_value', ascending=False).head(limit)
            
            return [
                {
                    "supplier": str(row['supplier']).strip() if pd.notna(row['supplier']) else 'Unknown',
                    "total_value": float(row['total_value']),
                    "invoice_count": int(row['invoice_count']),
                    "avg_invoice_value": float(row['avg_value']),
                    "min_value": float(row['min_value']),
                    "max_value": float(row['max_value']),
                }
                for _, row in analysis.iterrows()
            ]
        except Exception as e:
            logger.error(f"Error in get_supplier_analysis: {str(e)}")
            return []
    
    def get_nature_analysis(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Analyze data by nature (type of purchase)"""
        try:
            if 'NATUREZA' not in self.df.columns or 'VALOR' not in self.df.columns:
                return []
            
            df_valid = self.df.copy()
            df_valid['VALOR_NUM'] = pd.to_numeric(df_valid['VALOR'], errors='coerce')
            df_valid = df_valid[df_valid['VALOR_NUM'].notna()].copy()
            
            if len(df_valid) == 0:
                return []
            
            analysis = df_valid.groupby('NATUREZA').agg({
                'VALOR_NUM': ['sum', 'count', 'mean']
            }).reset_index()
            
            analysis.columns = ['nature', 'total_value', 'count', 'avg_value']
            analysis = analysis.sort_values('total_value', ascending=False).head(limit)
            
            return [
                {
                    "nature": str(row['nature']).strip() if pd.notna(row['nature']) else 'Unknown',
                    "total_value": float(row['total_value']),
                    "invoice_count": int(row['count']),
                    "avg_value": float(row['avg_value']),
                }
                for _, row in analysis.iterrows()
            ]
        except Exception as e:
            logger.error(f"Error in get_nature_analysis: {str(e)}")
            return []
    
    def get_payment_method_analysis(self) -> List[Dict[str, Any]]:
        """Analyze by payment method (BOLETO/DEPÓSITO)"""
        try:
            if 'BOLETO_DEPOSITO' not in self.df.columns or 'VALOR' not in self.df.columns:
                return []
            
            df_valid = self.df.copy()
            df_valid['VALOR_NUM'] = pd.to_numeric(df_valid['VALOR'], errors='coerce')
            df_valid = df_valid[df_valid['VALOR_NUM'].notna()].copy()
            
            if len(df_valid) == 0:
                return []
            
            analysis = df_valid.groupby('BOLETO_DEPOSITO').agg({
                'VALOR_NUM': ['sum', 'count', 'mean']
            }).reset_index()
            
            analysis.columns = ['method', 'total_value', 'count', 'avg_value']
            analysis = analysis.sort_values('total_value', ascending=False)
            
            return [
                {
                    "method": str(row['method']).strip() if pd.notna(row['method']) else 'Unknown',
                    "total_value": float(row['total_value']),
                    "invoice_count": int(row['count']),
                    "avg_value": float(row['avg_value']),
                }
                for _, row in analysis.iterrows()
            ]
        except Exception as e:
            logger.error(f"Error in get_payment_method_analysis: {str(e)}")
            return []
    
    def get_timeline_analysis(self) -> List[Dict[str, Any]]:
        """Analyze data over time by COD (period)"""
        try:
            if 'COD' not in self.df.columns or 'VALOR' not in self.df.columns:
                return []
            
            df_valid = self.df.copy()
            df_valid['VALOR_NUM'] = pd.to_numeric(df_valid['VALOR'], errors='coerce')
            df_valid = df_valid[df_valid['VALOR_NUM'].notna()].copy()
            
            if len(df_valid) == 0:
                return []
            
            df_valid['PERIODO'] = df_valid['COD'].astype(str).str[:2]  # Extract month/period
            
            analysis = df_valid.groupby('PERIODO').agg({
                'VALOR_NUM': ['sum', 'count', 'mean']
            }).reset_index()
            
            analysis.columns = ['period', 'total_value', 'count', 'avg_value']
            
            return [
                {
                    "period": str(row['period']),
                    "total_value": float(row['total_value']),
                    "invoice_count": int(row['count']),
                    "avg_value": float(row['avg_value']),
                }
                for _, row in analysis.iterrows()
            ]
        except Exception as e:
            logger.error(f"Error in get_timeline_analysis: {str(e)}")
            return []
    
    def get_top_invoices(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get top invoices by value"""
        try:
            if 'VALOR' not in self.df.columns:
                return []
            
            df_valid = self.df.copy()
            df_valid['VALOR_NUM'] = pd.to_numeric(df_valid['VALOR'], errors='coerce')
            df_valid = df_valid[df_valid['VALOR_NUM'].notna()].copy()
            
            if len(df_valid) == 0:
                return []
            
            df_valid = df_valid.sort_values('VALOR_NUM', ascending=False).head(limit)
            
            return [
                {
                    "nf": str(row.get('NF', 'N/A')) if 'NF' in self.df.columns and pd.notna(row.get('NF')) else 'N/A',
                    "supplier": str(row.get('FORNECEDOR', 'N/A')).strip() if 'FORNECEDOR' in self.df.columns and pd.notna(row.get('FORNECEDOR')) else 'N/A',
                    "value": float(row['VALOR_NUM']),
                    "nature": str(row.get('NATUREZA', 'N/A')).strip() if 'NATUREZA' in self.df.columns and pd.notna(row.get('NATUREZA')) else 'N/A',
                    "payment_method": str(row.get('BOLETO_DEPOSITO', 'N/A')).strip() if 'BOLETO_DEPOSITO' in self.df.columns and pd.notna(row.get('BOLETO_DEPOSITO')) else 'N/A',
                    "due_date": str(row.get('DATA_VENCTO', 'N/A')) if 'DATA_VENCTO' in self.df.columns and pd.notna(row.get('DATA_VENCTO')) else 'N/A',
                }
                for _, row in df_valid.iterrows()
            ]
        except Exception as e:
            logger.error(f"Error in get_top_invoices: {str(e)}")
            return []
    
    def get_consolidated_report(self) -> Dict[str, Any]:
        """Get complete consolidated report"""
        try:
            return {
                "summary": self.get_summary(),
                "supplier_analysis": self.get_supplier_analysis(),
                "nature_analysis": self.get_nature_analysis(),
                "payment_analysis": self.get_payment_method_analysis(),
                "timeline_analysis": self.get_timeline_analysis(),
                "top_invoices": self.get_top_invoices(20),
            }
        except Exception as e:
            logger.error(f"Error in get_consolidated_report: {str(e)}")
            return {
                "summary": self._empty_summary(),
                "supplier_analysis": [],
                "nature_analysis": [],
                "payment_analysis": [],
                "timeline_analysis": [],
                "top_invoices": [],
            }
    
    def get_filtered_data(self, filters: Dict[str, Any] = None) -> pd.DataFrame:
        """Get filtered and formatted data"""
        try:
            df = self.df.copy()
            df['VALOR_NUM'] = pd.to_numeric(df['VALOR'], errors='coerce')
            
            if filters:
                if 'supplier' in filters and filters['supplier'] and 'FORNECEDOR' in df.columns:
                    df = df[df['FORNECEDOR'] == filters['supplier']]
                if 'nature' in filters and filters['nature'] and 'NATUREZA' in df.columns:
                    df = df[df['NATUREZA'] == filters['nature']]
                if 'payment_method' in filters and filters['payment_method'] and 'BOLETO_DEPOSITO' in df.columns:
                    df = df[df['BOLETO_DEPOSITO'] == filters['payment_method']]
            
            # Keep only valid NFs (with VALOR)
            df = df[df['VALOR_NUM'].notna()]
            
            # Select essential columns
            essential_cols = ['NF', 'FORNECEDOR', 'VALOR', 'NATUREZA', 'BOLETO_DEPOSITO', 'DATA_VENCTO', 'COD']
            available_cols = [col for col in essential_cols if col in df.columns]
            
            if len(available_cols) == 0:
                # Fallback to all columns
                available_cols = list(df.columns)[:10]
            
            return df[available_cols].sort_values('VALOR_NUM', ascending=False)
        except Exception as e:
            logger.error(f"Error in get_filtered_data: {str(e)}")
            return pd.DataFrame()
