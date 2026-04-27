# Dicionário de keywords para classificação semântica de colunas
# Formato: semantic_type -> (keywords_português, keywords_english, weight_nome, weight_amostra)

SEMANTIC_KEYWORDS = {
    "temporal": {
        "pt": ["data", "date", "hora", "time", "período", "mês", "month", "ano", "year", "semana", "week", "dia", "day", "timestamp"],
        "en": ["date", "time", "datetime", "timestamp", "period", "month", "year", "week", "day", "hour", "minute", "second"],
        "pattern": [r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", r"\d{4}[-/]\d{1,2}[-/]\d{1,2}"],
    },
    "monetario": {
        "pt": ["valor", "preço", "preço", "custo", "receita", "venda", "lucro", "margem", "fee", "taxa", "juros"],
        "en": ["value", "price", "cost", "revenue", "sales", "profit", "margin", "fee", "amount", "total"],
        "pattern": [r"[R$USD€¥]"],
    },
    "percentual": {
        "pt": ["percentual", "taxa", "índice", "ratio", "participação", "pct"],
        "en": ["percent", "percentage", "ratio", "rate", "pct", "share"],
        "pattern": [r"\d+\.?\d*\s*%"],
    },
    "contagem": {
        "pt": ["quantidade", "total", "count", "número", "quant", "qtd", "n_"],
        "en": ["count", "quantity", "number", "total", "num_", "n_"],
    },
    "identificador": {
        "pt": ["id", "código", "código", "cpf", "cnpj", "matricula", "registro", "referência", "uuid"],
        "en": ["id", "code", "key", "cpf", "cnpj", "registration", "reference", "uuid", "sku"],
        "pattern": [r"^[A-Z0-9]{6,}$"],
    },
    "categoria": {
        "pt": ["tipo", "tipo", "categoria", "classe", "status", "estado", "região", "país", "cidade", "departamento", "setor"],
        "en": ["type", "category", "class", "status", "state", "region", "country", "city", "department", "sector"],
    },
    "texto": {
        "pt": ["descrição", "comentário", "nome", "título", "assunto"],
        "en": ["description", "comment", "name", "title", "subject", "text", "notes"],
    },
    "booleano": {
        "pt": ["ativo", "inativo", "verdadeiro", "falso", "sim", "não", "habilitado", "desabilitado"],
        "en": ["active", "inactive", "true", "false", "yes", "no", "enabled", "disabled"],
        "pattern": [r"^(1|0|true|false|yes|no|sim|não|ativo|inativo)$"],
    },
    "geolocalização": {
        "pt": ["latitude", "longitude", "coordenada", "mapa", "local"],
        "en": ["latitude", "longitude", "coordinate", "location", "geo"],
        "pattern": [r"^[-+]?[0-9]{1,2}\.[0-9]{1,}"],
    },
    "email": {
        "pt": ["email", "correio", "mail"],
        "en": ["email", "mail", "e-mail"],
        "pattern": [r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"],
    },
    "telefone": {
        "pt": ["telefone", "celular", "whatsapp", "contato"],
        "en": ["phone", "mobile", "cellphone", "whatsapp", "contact"],
        "pattern": [r"^\+?[\d\s\-\(\)]{10,}$"],
    },
    "url": {
        "pt": ["site", "website", "url", "link"],
        "en": ["url", "link", "website", "site", "web"],
        "pattern": [r"^https?://"],
    },
}

# Configurações de score
MIN_CONFIDENCE_SCORE = 0.4  # Score mínimo para classificar (abaixo = "generico")
KEYWORD_MATCH_WEIGHT = 0.60  # Peso do nome da coluna
PATTERN_MATCH_WEIGHT = 0.25  # Peso do padrão encontrado
VALUE_SAMPLE_WEIGHT = 0.15   # Peso da amostra de valores

# Parâmetros de análise de valores
SAMPLE_SIZE = 100  # Número de valores não-nulos para analisar
MIN_PATTERN_MATCHES = 3  # Mínimo de valores que devem casar com o padrão
