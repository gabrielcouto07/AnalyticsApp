"""
NF-specific analyzer for 12.csv
Provides advanced analytics, grouping, and formatting for NF template
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from datetime import datetime

class NFAnalyzer:
    """Specialized analyzer for NF (Notas Fiscais) data"""
    
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._clean_columns()
        self._map_essential_columns()
        self._clean_data()
    
    def _clean_columns(self):
        """Clean column names: remove newlines, extra spaces, and encoding issues"""
        self.df.columns = [
            col.replace('\n', ' ').replace('\r', ' ').strip() 
            for col in self.df.columns
        ]
    
    def _map_essential_columns(self):
        """Map column names to standard names, handling encoding issues"""
        # Create mapping for columns that might have encoding issues
        mapping = {}
        for col in self.df.columns:
            col_upper = col.upper()
            # Remove common encoding artifacts
            col_clean = col_upper.replace('¤', 'º').replace('ú', 'U').replace('û', 'U').replace('í', 'I')
            
            # Map to standard columns
            if 'VALOR' in col_clean and 'DO ITEM' not in col_clean and 'nan' not in col:
                mapping[col] = 'VALOR'
            elif 'FORNECEDOR' in col_clean:
                mapping[col] = 'FORNECEDOR'
            elif 'NATUREZA' in col_clean:
                mapping[col] = 'NATUREZA'
            elif 'BOLETO' in col_clean or 'DEPOSITO' in col_clean:
                mapping[col] = 'BOLETO_DEPOSITO'
            elif 'DATA' in col_clean and 'VENCTO' in col_clean:
                mapping[col] = 'DATA_VENCTO'
            elif 'NF' in col_clean and 'PLANILHA' not in col_clean and 'REPETIDAS' not in col_clean and col_clean != 'NAN':
                mapping[col] = 'NF'
            elif 'COD' in col_clean and len(col_clean) < 10:
                mapping[col] = 'COD'
        
        # Apply mapping
        for old_col, new_col in mapping.items():
            if old_col in self.df.columns and new_col not in self.df.columns:
                self.df = self.df.rename(columns={old_col: new_col})
    
    def _clean_data(self):
        """Clean data values"""
        # Convert VALOR column to numeric
        valor_col = 'VALOR' if 'VALOR' in self.df.columns else None
        if valor_col:
            self.df[valor_col] = pd.to_numeric(
                self.df[valor_col].astype(str)
                .str.replace('.', '', regex=False)
                .str.replace(',', '.', regex=False),
                errors='coerce'
            )
    
    def get_summary(self) -> Dict[str, Any]:
        """Get overall summary metrics"""
        # Filter rows with actual NF data (has VALOR)
        df_valid = self.df[self.df['VALOR'].notna()]
        
        total_nfs = len(df_valid)
        total_value = df_valid['VALOR'].sum()
        
        # Get unique suppliers (with fallback)
        fornecedor_col = 'FORNECEDOR' if 'FORNECEDOR' in df_valid.columns else None
        unique_suppliers = df_valid[fornecedor_col].nunique() if fornecedor_col else 0
        
        return {
            "total_nfs": int(total_nfs),
            "total_value": float(total_value) if pd.notna(total_value) else 0,
            "unique_suppliers": int(unique_suppliers),
            "average_invoice_value": float(df_valid['VALOR'].mean()) if len(df_valid) > 0 else 0,
            "data_quality": {
                "total_rows": len(self.df),
                "valid_rows": len(df_valid),
                "completeness_percentage": round(100 * len(df_valid) / len(self.df), 2) if len(self.df) > 0 else 0
            }
        }
    
    def get_supplier_analysis(self) -> List[Dict[str, Any]]:
        """Analyze data by supplier"""
        df_valid = self.df[self.df['VALOR'].notna()].copy()
        
        if 'FORNECEDOR' not in df_valid.columns or len(df_valid) == 0:
            return []
        
        analysis = df_valid.groupby('FORNECEDOR').agg({
            'VALOR': ['sum', 'count', 'mean', 'min', 'max']
        }).reset_index()
        
        analysis.columns = ['supplier', 'total_value', 'invoice_count', 'avg_value', 'min_value', 'max_value']
        
        # Sort by total value
        analysis = analysis.sort_values('total_value', ascending=False)
        
        return [
            {
                "supplier": str(row['supplier']),
                "total_value": float(row['total_value']),
                "invoice_count": int(row['invoice_count']),
                "avg_invoice_value": float(row['avg_value']),
                "min_value": float(row['min_value']),
                "max_value": float(row['max_value']),
            }
            for _, row in analysis.iterrows()
        ]
    
    def get_nature_analysis(self) -> List[Dict[str, Any]]:
        """Analyze data by nature (type of purchase)"""
        df_valid = self.df[self.df['VALOR'].notna()].copy()
        
        if 'NATUREZA' not in df_valid.columns or len(df_valid) == 0:
            return []
        
        analysis = df_valid.groupby('NATUREZA').agg({
            'VALOR': ['sum', 'count', 'mean']
        }).reset_index()
        
        analysis.columns = ['nature', 'total_value', 'count', 'avg_value']
        analysis = analysis.sort_values('total_value', ascending=False)
        
        return [
            {
                "nature": str(row['nature']),
                "total_value": float(row['total_value']),
                "invoice_count": int(row['count']),
                "avg_value": float(row['avg_value']),
            }
            for _, row in analysis.iterrows()
        ]
    
    def get_payment_method_analysis(self) -> List[Dict[str, Any]]:
        """Analyze by payment method (BOLETO/DEPÓSITO)"""
        df_valid = self.df[self.df['VALOR'].notna()].copy()
        
        # Check for payment method column (might be mapped as BOLETO_DEPOSITO or similar)
        payment_col = None
        for col in df_valid.columns:
            if 'BOLETO' in col.upper() or 'DEPOSITO' in col.upper():
                payment_col = col
                break
        
        if not payment_col or len(df_valid) == 0:
            return []
        
        analysis = df_valid.groupby(payment_col).agg({
            'VALOR': ['sum', 'count', 'mean']
        }).reset_index()
        
        analysis.columns = ['method', 'total_value', 'count', 'avg_value']
        analysis = analysis.sort_values('total_value', ascending=False)
        
        return [
            {
                "method": str(row['method']),
                "total_value": float(row['total_value']),
                "invoice_count": int(row['count']),
                "avg_value": float(row['avg_value']),
            }
            for _, row in analysis.iterrows()
        ]
    
    def get_timeline_analysis(self) -> List[Dict[str, Any]]:
        """Analyze data over time by COD (period)"""
        df_valid = self.df[self.df['VALOR'].notna()].copy()
        
        if 'COD' not in df_valid.columns or len(df_valid) == 0:
            return []
        
        df_valid['PERIODO'] = df_valid['COD'].astype(str).str[:2]  # Extract month/period
        
        analysis = df_valid.groupby('PERIODO').agg({
            'VALOR': ['sum', 'count', 'mean']
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
    
    def get_top_invoices(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get top invoices by value"""
        df_valid = self.df[self.df['VALOR'].notna()].copy()
        df_valid = df_valid.sort_values('VALOR', ascending=False).head(limit)
        
        return [
            {
                "nf": str(row.get('NF', 'N/A')) if 'NF' in row else 'N/A',
                "supplier": str(row.get('FORNECEDOR', 'N/A')) if 'FORNECEDOR' in row else 'N/A',
                "value": float(row['VALOR']),
                "nature": str(row.get('NATUREZA', 'N/A')) if 'NATUREZA' in row else 'N/A',
                "payment_method": str(row.get('BOLETO_DEPOSITO', 'N/A')) if 'BOLETO_DEPOSITO' in row else 'N/A',
                "due_date": str(row.get('DATA_VENCTO', 'N/A')) if 'DATA_VENCTO' in row else 'N/A',
            }
            for _, row in df_valid.iterrows()
        ]
    
    def get_consolidated_report(self) -> Dict[str, Any]:
        """Get complete consolidated report"""
        return {
            "summary": self.get_summary(),
            "supplier_analysis": self.get_supplier_analysis(),
            "nature_analysis": self.get_nature_analysis(),
            "payment_analysis": self.get_payment_method_analysis(),
            "timeline_analysis": self.get_timeline_analysis(),
            "top_invoices": self.get_top_invoices(20),
        }
    
    def get_filtered_data(self, filters: Dict[str, Any] = None) -> pd.DataFrame:
        """Get filtered and formatted data"""
        df = self.df.copy()
        
        if filters:
            if 'supplier' in filters and filters['supplier']:
                if 'FORNECEDOR' in df.columns:
                    df = df[df['FORNECEDOR'] == filters['supplier']]
            if 'nature' in filters and filters['nature']:
                if 'NATUREZA' in df.columns:
                    df = df[df['NATUREZA'] == filters['nature']]
            if 'payment_method' in filters and filters['payment_method']:
                for col in df.columns:
                    if 'BOLETO' in col.upper() or 'DEPOSITO' in col.upper():
                        df = df[df[col] == filters['payment_method']]
                        break
        
        # Keep only valid NFs (with VALOR)
        df = df[df['VALOR'].notna()]
        
        # Select essential columns
        essential_cols = ['NF', 'FORNECEDOR', 'VALOR', 'NATUREZA', 'BOLETO_DEPOSITO', 'DATA_VENCTO', 'COD']
        available_cols = [col for col in essential_cols if col in df.columns]
        
        if len(available_cols) == 0:
            # Fallback to all columns
            available_cols = list(df.columns)[:10]
        
        return df[available_cols].sort_values('VALOR', ascending=False)
