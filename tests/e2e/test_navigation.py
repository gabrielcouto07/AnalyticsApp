"""Suite de regressão de navegação em navegador real (Playwright).

Sobe NADA sozinha — assume backend (8000) e frontend (5173) rodando. É pulada
automaticamente quando as dependências/servidores não estão disponíveis, para
não quebrar `pytest -q` no ambiente de unidade.

Como rodar:
    # terminal 1
    ANALYTICS_DATA_DIR=./data/sessions .venv/Scripts/python -m uvicorn backend.main:app --port 8000
    # terminal 2
    cd frontend && npm run dev
    # terminal 3
    RUN_E2E=1 pytest tests/e2e/test_navigation.py -v

Usa SOMENTE o fixture sintético (nunca o workbook real de 23 MB).
Falha em: pageerror, console.error de app, ErrorBoundary global, #root em branco,
overflow horizontal (sidebar espremida) ou navegação que trava.
"""
import os
import time
from pathlib import Path

import pytest

RUN = os.environ.get("RUN_E2E") == "1"
FRONTEND = os.environ.get("E2E_URL", "http://localhost:5173")
FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "base_unificada_mini.xlsx"

pytestmark = pytest.mark.skipif(not RUN, reason="defina RUN_E2E=1 e suba backend+frontend")

PAGES = ["Explorador", "Distribuição", "Ranking", "Temporal", "Correlação", "Qualidade", "Exportar", "Visão Geral"]


@pytest.fixture(scope="module")
def browser_page():
    pw = pytest.importorskip("playwright.sync_api")
    with pw.sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))
        page.on("console", lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None)
        page._app_errors = errors  # type: ignore[attr-defined]
        try:
            page.goto(FRONTEND, wait_until="networkidle", timeout=15000)
        except Exception:
            pytest.skip(f"frontend não acessível em {FRONTEND}")
        yield page
        browser.close()


def _upload_and_wait(page):
    page.set_input_files("input[type=file]", str(FIXTURE))
    for _ in range(60):
        time.sleep(1)
        if "Dashboard Fiscal" in page.inner_text("body") or "Visão Geral" in page.inner_text("body"):
            return True
    return False


def test_navigate_all_pages_without_crash(browser_page):
    page = browser_page
    errors = page._app_errors  # type: ignore[attr-defined]
    assert _upload_and_wait(page), "sessão não ficou pronta após upload"

    for label in PAGES:
        before = len(errors)
        page.get_by_role("button", name=label).first.click(timeout=8000)
        time.sleep(2.5)

        body = page.inner_text("body")
        root_len = page.eval_on_selector("#root", "el => el.innerHTML.length")
        overflow = page.evaluate("() => document.body.scrollWidth - window.innerWidth")
        sidebar_visible = page.get_by_role("button", name="Visão Geral").first.is_visible()

        assert "erro inesperado na interface" not in body, f"[{label}] ErrorBoundary global disparou"
        assert root_len > 500, f"[{label}] #root em branco (len={root_len})"
        assert overflow <= 2, f"[{label}] overflow horizontal de {overflow}px (sidebar espremida)"
        assert sidebar_visible, f"[{label}] sidebar não navegável"
        assert len(errors) == before, f"[{label}] novos erros: {errors[before:]}"

    assert not errors, f"erros de navegador durante a navegação: {errors}"


def test_explorer_raw_dataset_and_pagination(browser_page):
    page = browser_page
    errors = page._app_errors  # type: ignore[attr-defined]
    page.get_by_role("button", name="Explorador").first.click(timeout=8000)
    time.sleep(2)
    # troca para uma aba bruta (muitas colunas) — não pode estourar o layout
    try:
        page.select_option("#explorer-dataset", label="Dados Saída")
        time.sleep(2)
    except Exception:
        pass  # fixture pode não ter o seletor se só houver 1 dataset
    overflow = page.evaluate("() => document.body.scrollWidth - window.innerWidth")
    assert overflow <= 2, f"overflow ao abrir dataset bruto: {overflow}px"
    assert not errors, f"erros no Explorer: {errors}"
