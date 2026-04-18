"""
Central template registry. Maps template keys to their definitions.
Each entry exposes metadata used by the frontend and upload router.
"""

from .efetivo_template import EFETIVO_TEMPLATE

TEMPLATES: dict = {
    "efetivo": EFETIVO_TEMPLATE,
}


def get_template(key: str) -> dict | None:
    return TEMPLATES.get(key)


def list_templates() -> list[dict]:
    return [{"key": k, **v} for k, v in TEMPLATES.items()]
