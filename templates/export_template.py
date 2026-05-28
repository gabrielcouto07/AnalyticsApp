"""
Template de exportação — Download de dados em Excel/CSV.
"""

import streamlit as st
from datetime import datetime
from utils import to_excel


def render_export_tab(model, filtered_df) -> None:
    """
    Renderiza tab de exportação com botões de download.
    
    Args:
        model: BaseModel instanciado
        filtered_df: DataFrame com dados filtrados
    """
    ts_file = datetime.now().strftime("%Y%m%d_%H%M")
    
    st.subheader("📥 Exportar relatórios")
    st.caption(f"Exportando {len(filtered_df):,} linhas filtradas".replace(",", "."))
    
    # ── Sheet planning ──
    sheets = model.get_export_sheets(filtered_df)
    
    if not sheets:
        st.warning("Nenhum sheet disponível para exportar")
        return
    
    # ── Download Excel ──
    col1, col2, col3 = st.columns(3)
    
    with col1:
        excel_data = to_excel(sheets)
        st.download_button(
            label="📊 Excel completo",
            data=excel_data,
            file_name=f"{model.MODEL_NAME.lower()}_{ts_file}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )
    
    # ── Download CSV (primeiro sheet) ──
    with col2:
        if sheets:
            first_sheet_name = list(sheets.keys())[0]
            first_sheet = sheets[first_sheet_name]
            csv_data = first_sheet.to_csv(index=False, sep=";", decimal=",").encode("utf-8-sig")
            st.download_button(
                label="📄 CSV (1º sheet)",
                data=csv_data,
                file_name=f"{model.MODEL_NAME.lower()}_resumo_{ts_file}.csv",
                mime="text/csv",
                use_container_width=True,
            )
    
    # ── Download Detalhado CSV ──
    with col3:
        csv_detailed = filtered_df.to_csv(index=False, sep=";", decimal=",").encode("utf-8-sig")
        st.download_button(
            label="📋 Detalhado CSV",
            data=csv_detailed,
            file_name=f"{model.MODEL_NAME.lower()}_detalhado_{ts_file}.csv",
            mime="text/csv",
            use_container_width=True,
        )
    
    # ── Preview ──
    st.markdown("---")
    st.subheader("📊 Prévia — Sheets disponíveis")
    
    preview_sheet = st.selectbox(
        "Escolha sheet para visualizar",
        list(sheets.keys()),
        key="export_preview_sheet",
    )
    
    if preview_sheet in sheets:
        preview_df = sheets[preview_sheet].head(10)
        st.dataframe(preview_df, use_container_width=True, height=280)
