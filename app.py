import io
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from config.schema_detector import detect_context
from templates.ui import apply_chart_style

st.set_page_config(
    page_title="Analytics Hub",
    layout="wide",
    initial_sidebar_state="collapsed",
)


def inject_css() -> None:
    css_path = Path(__file__).parent / "theme.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)


def init_session() -> None:
    st.session_state.setdefault("df", None)
    st.session_state.setdefault("ctx", None)


def fmt_number(value: float) -> str:
    if pd.isna(value):
        return "-"
    if value == 0:
        return "0"

    absolute = abs(value)
    if absolute >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if absolute >= 1_000:
        return f"{value / 1_000:.1f}K"
    return f"{value:,.2f}"


def detect_encoding(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1", "utf-16"):
        try:
            file_bytes.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    return "utf-8"


def detect_delimiter(text: str) -> str:
    first_line = text.splitlines()[0] if text else ""
    delimiters = [",", ";", "\t", "|"]
    return max(delimiters, key=first_line.count)


def _try_parse_datetime(series: pd.Series) -> Optional[pd.Series]:
    parsed = pd.to_datetime(series, errors="coerce")
    if len(series) and parsed.notna().mean() >= 0.7:
        return parsed
    return None


def _try_parse_numeric(series: pd.Series) -> Optional[pd.Series]:
    raw = series.astype(str).str.strip()
    candidates = [
        raw,
        raw.str.replace(",", "", regex=False),
        raw.str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
    ]

    for candidate in candidates:
        cleaned = candidate.str.replace(r"[R$%\s]", "", regex=True)
        parsed = pd.to_numeric(cleaned, errors="coerce")
        if len(series) and parsed.notna().mean() >= 0.7:
            return parsed

    return None


def detect_and_parse(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    parsed_df = df.copy()
    for column in parsed_df.columns:
        if parsed_df[column].dtype != object:
            continue

        parsed_dates = _try_parse_datetime(parsed_df[column])
        if parsed_dates is not None:
            parsed_df[column] = parsed_dates
            continue

        parsed_numeric = _try_parse_numeric(parsed_df[column])
        if parsed_numeric is not None:
            parsed_df[column] = parsed_numeric

    return parsed_df


def load_delimited_file(file_bytes: bytes) -> pd.DataFrame:
    encoding = detect_encoding(file_bytes)
    text = file_bytes.decode(encoding)
    delimiter = detect_delimiter(text)
    return pd.read_csv(io.StringIO(text), sep=delimiter)


@st.cache_data(show_spinner="Loading...")
def load_file(file_bytes: bytes, filename: str) -> Optional[pd.DataFrame]:
    name = filename.lower()

    try:
        if name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        elif name.endswith((".csv", ".txt")):
            df = load_delimited_file(file_bytes)
        elif name.endswith(".json"):
            text = file_bytes.decode("utf-8")
            data = json.loads(text)
            df = pd.DataFrame(data) if isinstance(data, list) else pd.json_normalize(data)
        else:
            st.error(f"Unsupported format: {name}")
            return None
    except Exception as exc:
        st.error(f"Error loading file: {exc}")
        return None

    return detect_and_parse(df)


def to_excel(df: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Data")
    return buffer.getvalue()


def build_tabs(context: dict) -> list[str]:
    tabs: list[str] = []
    has_metrics = bool(context["key_metrics"])
    has_dimensions = bool(context["key_dimensions"])
    has_dates = bool(context["date_cols"])

    if has_metrics and context["context"] in {"vendas", "comissoes", "financeiro"}:
        tabs.append("Financial")
    if has_metrics and has_dimensions and context["context"] in {"vendas", "comissoes"}:
        tabs.append("By Dimension")
    if has_metrics and has_dates:
        tabs.append("Timeline")
    if has_metrics and context["context"] == "obra":
        tabs.append("Schedule")
    if context["context"] == "rh":
        tabs.append("People")
    if has_metrics and context["context"] == "estoque":
        tabs.append("Inventory")

    tabs.extend(["Data", "Statistics", "Explorer", "Export"])
    return list(dict.fromkeys(tabs))


def first_non_null_example(series: pd.Series) -> str:
    non_null = series.dropna()
    if non_null.empty:
        return "-"
    return str(non_null.iloc[0])[:50]


inject_css()
init_session()

st.title("Analytics Hub")
st.caption("Upload a spreadsheet and the app adapts the analysis automatically.")

uploaded_file = st.file_uploader(
    "Choose a file",
    type=["xlsx", "xls", "csv", "txt", "json"],
    label_visibility="collapsed",
)

if not uploaded_file:
    st.markdown(
        """
        ### How it works
        1. Upload a spreadsheet file.
        2. The app detects the dataset context automatically.
        3. Relevant tabs are created for financial, timeline, people, inventory or generic analysis.
        4. You can inspect the raw data, statistics, charts and exports in the same flow.
        """
    )
    st.stop()

df = load_file(uploaded_file.read(), uploaded_file.name)
if df is None:
    st.stop()

ctx = detect_context(df)
st.session_state.df = df
st.session_state.ctx = ctx

st.info(
    "Detected context: "
    f"**{ctx['context'].upper()}** ({ctx['confidence']:.0%}) | "
    f"{len(df):,} rows | {len(df.columns)} columns"
)

if ctx["key_metrics"]:
    st.subheader("Key metrics")
    metric_columns = st.columns(min(4, len(ctx["key_metrics"][:4])))

    for index, column_name in enumerate(ctx["key_metrics"][:4]):
        total = df[column_name].sum()
        midpoint = len(df) // 2
        first_half = df[column_name].iloc[:midpoint].sum()
        second_half = df[column_name].iloc[midpoint:].sum()
        delta_pct = ((second_half - first_half) / abs(first_half) * 100) if first_half else 0

        metric_columns[index].metric(
            label=column_name,
            value=fmt_number(total),
            delta=f"{delta_pct:+.1f}%",
        )

tab_names = build_tabs(ctx)
tabs = st.tabs(tab_names)
tab_map = {name: tab for name, tab in zip(tab_names, tabs)}

if "Financial" in tab_map:
    with tab_map["Financial"]:
        st.subheader("Financial analysis")
        metric = ctx["key_metrics"][0]

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total", fmt_number(df[metric].sum()))
        col2.metric("Average", fmt_number(df[metric].mean()))
        col3.metric("Maximum", fmt_number(df[metric].max()))
        col4.metric("Median", fmt_number(df[metric].median()))

        if ctx["date_cols"]:
            date_col = ctx["date_cols"][0]
            timeline = df.set_index(date_col)[metric].resample("ME").sum().reset_index()
            figure = px.line(timeline, x=date_col, y=metric, markers=True, title=f"{metric} by month")
            st.plotly_chart(apply_chart_style(figure), use_container_width=True)

        if ctx["key_dimensions"]:
            dimension = ctx["key_dimensions"][0]
            summary = df.groupby(dimension)[ctx["key_metrics"][:3]].sum().reset_index()
            summary = summary.sort_values(ctx["key_metrics"][0], ascending=False)
            st.dataframe(summary, use_container_width=True)

if "By Dimension" in tab_map:
    with tab_map["By Dimension"]:
        st.subheader("Analysis by dimension")

        for dimension in ctx["key_dimensions"][:3]:
            st.markdown(f"#### {dimension}")

            grouped = (
                df.groupby(dimension)[ctx["key_metrics"][0]]
                .agg(["sum", "mean", "count"])
                .reset_index()
                .sort_values("sum", ascending=False)
                .head(20)
            )

            col1, col2 = st.columns(2)
            with col1:
                bar_chart = px.bar(
                    grouped,
                    y=dimension,
                    x="sum",
                    orientation="h",
                    color="sum",
                    color_continuous_scale="Blues",
                    title=f"Top 20 by {dimension}",
                )
                st.plotly_chart(apply_chart_style(bar_chart), use_container_width=True)

            with col2:
                pie_chart = px.pie(
                    grouped.head(10),
                    names=dimension,
                    values="sum",
                    title=f"Share by {dimension}",
                )
                st.plotly_chart(apply_chart_style(pie_chart), use_container_width=True)

            st.dataframe(grouped, use_container_width=True)

if "Timeline" in tab_map:
    with tab_map["Timeline"]:
        st.subheader("Timeline analysis")
        date_col = ctx["date_cols"][0]

        col1, col2 = st.columns(2)
        with col1:
            metric_col = st.selectbox("Metric", ctx["key_metrics"], key="timeline_metric")
        with col2:
            granularity = st.selectbox(
                "Granularity",
                ["Day", "Week", "Month", "Quarter", "Year"],
                index=2,
                key="timeline_granularity",
            )

        freq_map = {"Day": "D", "Week": "W", "Month": "ME", "Quarter": "QE", "Year": "YE"}

        try:
            timeline = df.set_index(date_col)[metric_col].resample(freq_map[granularity]).sum().reset_index()
            line_chart = px.line(
                timeline,
                x=date_col,
                y=metric_col,
                markers=True,
                title=f"{metric_col} by {granularity.lower()}",
            )
            st.plotly_chart(apply_chart_style(line_chart), use_container_width=True)

            if len(timeline) >= 2:
                current = timeline[metric_col].iloc[-1]
                previous = timeline[metric_col].iloc[-2]
                delta = ((current - previous) / abs(previous) * 100) if previous else 0

                info1, info2, info3 = st.columns(3)
                info1.metric("Current", fmt_number(current), f"{delta:+.1f}%")
                info2.metric("Previous", fmt_number(previous))
                info3.metric("Total", fmt_number(timeline[metric_col].sum()))

            timeline["cumulative"] = timeline[metric_col].cumsum()
            cumulative_chart = px.area(
                timeline,
                x=date_col,
                y="cumulative",
                title=f"Cumulative {metric_col}",
            )
            st.plotly_chart(apply_chart_style(cumulative_chart), use_container_width=True)
        except Exception as exc:
            st.error(f"Could not build the timeline: {exc}")

if "Schedule" in tab_map:
    with tab_map["Schedule"]:
        st.subheader("Schedule")
        phase_columns = [column for column in df.columns if any(token in column.lower() for token in ("etapa", "fase"))]

        if phase_columns:
            phase = phase_columns[0]
            metric = ctx["key_metrics"][0]
            grouped = df.groupby(phase)[metric].agg(["sum", "mean", "count"]).reset_index()

            chart = px.bar(
                grouped,
                x=phase,
                y="sum",
                title=f"Progress by {phase}",
                color="sum",
                color_continuous_scale="Viridis",
            )
            st.plotly_chart(apply_chart_style(chart), use_container_width=True)
            st.dataframe(grouped, use_container_width=True)
        else:
            st.info("No schedule columns were detected.")

if "People" in tab_map:
    with tab_map["People"]:
        st.subheader("People analysis")
        role_columns = [column for column in df.columns if "cargo" in column.lower()]

        if role_columns:
            role = role_columns[0]
            grouped = df[role].value_counts().reset_index()
            grouped.columns = [role, "Count"]

            chart = px.bar(grouped, x=role, y="Count", title=f"Distribution by {role}")
            st.plotly_chart(apply_chart_style(chart), use_container_width=True)
            st.dataframe(grouped, use_container_width=True)
        else:
            st.info("No role column was detected.")

if "Inventory" in tab_map:
    with tab_map["Inventory"]:
        st.subheader("Inventory")
        balance_columns = [column for column in df.columns if "saldo" in column.lower()]
        product_columns = [column for column in df.columns if "produto" in column.lower()]

        if balance_columns and product_columns:
            balance = balance_columns[0]
            product = product_columns[0]
            grouped = (
                df.groupby(product)[balance]
                .sum()
                .reset_index()
                .sort_values(balance, ascending=False)
                .head(20)
            )

            chart = px.bar(
                grouped,
                x=product,
                y=balance,
                title="Top 20 products",
                color=balance,
                color_continuous_scale="Greens",
            )
            st.plotly_chart(apply_chart_style(chart), use_container_width=True)
            st.dataframe(grouped, use_container_width=True)
        else:
            st.info("Inventory columns were not found.")

with tab_map["Data"]:
    st.subheader("Raw data")

    if len(df) > 2_000:
        st.caption(f"Showing 2,000 of {len(df):,} rows")
        st.dataframe(df.head(2_000), use_container_width=True, height=450)
    else:
        st.dataframe(df, use_container_width=True, height=450)

    with st.expander("Data quality"):
        quality_rows = []
        for column in df.columns:
            completeness = (df[column].notna().sum() / len(df) * 100) if len(df) else 0
            quality_rows.append(
                {
                    "Column": column,
                    "Type": str(df[column].dtype),
                    "Completeness": f"{completeness:.1f}%",
                    "Unique": df[column].nunique(),
                    "Example": first_non_null_example(df[column]),
                }
            )

        st.dataframe(pd.DataFrame(quality_rows), use_container_width=True)

with tab_map["Statistics"]:
    st.subheader("Statistics")

    if not ctx["key_metrics"]:
        st.info("No numeric columns were detected.")
    else:
        st.dataframe(df[ctx["key_metrics"]].describe().T, use_container_width=True)

        if len(ctx["key_metrics"]) >= 2:
            st.markdown("#### Correlation")
            correlation = df[ctx["key_metrics"]].corr()

            heatmap = go.Figure(
                data=go.Heatmap(
                    z=correlation.values,
                    x=correlation.columns,
                    y=correlation.columns,
                    colorscale="RdBu_r",
                    zmid=0,
                )
            )
            st.plotly_chart(apply_chart_style(heatmap), use_container_width=True)

            pairs: list[tuple[str, str, float]] = []
            for left_index, left_column in enumerate(correlation.columns):
                for right_index in range(left_index + 1, len(correlation.columns)):
                    pairs.append(
                        (
                            left_column,
                            correlation.columns[right_index],
                            correlation.iloc[left_index, right_index],
                        )
                    )

            pairs.sort(key=lambda item: abs(item[2]), reverse=True)
            st.markdown("**Top correlations**")
            for left_column, right_column, value in pairs[:5]:
                st.caption(f"{left_column} <-> {right_column}: **{value:.2f}**")

with tab_map["Explorer"]:
    st.subheader("Free explorer")

    col1, col2, col3, col4 = st.columns(4)
    chart_type = col1.selectbox("Type", ["Bar", "Line", "Pie", "Histogram", "Scatter", "Area"], key="explorer_type")
    axis_x = col2.selectbox("X axis", df.columns.tolist(), key="explorer_x")
    axis_y = col3.selectbox(
        "Y axis",
        ctx["numeric_cols"] if ctx["numeric_cols"] else df.columns.tolist(),
        key="explorer_y",
    )
    aggregation = col4.selectbox("Aggregation", ["Sum", "Average", "Count", "Max", "Min"], key="explorer_agg")

    aggregation_map = {
        "Sum": "sum",
        "Average": "mean",
        "Count": "count",
        "Max": "max",
        "Min": "min",
    }

    try:
        if chart_type == "Histogram":
            chart = px.histogram(df, x=axis_y, nbins=40, title=f"Distribution of {axis_y}")
        elif chart_type == "Scatter":
            chart = px.scatter(df, x=axis_x, y=axis_y, title=f"{axis_x} vs {axis_y}")
        else:
            grouped = (
                df.groupby(axis_x)[axis_y]
                .agg(aggregation_map[aggregation])
                .reset_index()
                .sort_values(axis_y, ascending=False)
                .head(20)
            )

            if chart_type == "Bar":
                chart = px.bar(grouped, x=axis_x, y=axis_y, title=f"{axis_x} vs {axis_y}")
            elif chart_type == "Line":
                chart = px.line(grouped, x=axis_x, y=axis_y, markers=True, title=f"{axis_x} vs {axis_y}")
            elif chart_type == "Area":
                chart = px.area(grouped, x=axis_x, y=axis_y, title=f"{axis_x} vs {axis_y}")
            else:
                chart = px.pie(grouped, names=axis_x, values=axis_y, title=f"Distribution of {axis_x}")

        st.plotly_chart(apply_chart_style(chart), use_container_width=True)
    except Exception as exc:
        st.error(f"Could not build the chart: {exc}")

with tab_map["Export"]:
    st.subheader("Download")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    col1, col2, col3 = st.columns(3)

    csv_data = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
    col1.download_button("CSV", csv_data, f"data_{timestamp}.csv", "text/csv", use_container_width=True)

    excel_data = to_excel(df)
    col2.download_button(
        "Excel",
        excel_data,
        f"data_{timestamp}.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
    )

    json_data = df.to_json(orient="records", force_ascii=False).encode("utf-8")
    col3.download_button("JSON", json_data, f"data_{timestamp}.json", "application/json", use_container_width=True)

    st.markdown("#### Preview")
    show_all = st.checkbox("Show all rows", value=False)
    st.dataframe(df if show_all else df.head(20), use_container_width=True)
