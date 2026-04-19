from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List


@dataclass
class AuditStep:
    step_id: int
    category: str
    title: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    severity: str = "info"


@dataclass
class AuditTrail:
    steps: List[AuditStep] = field(default_factory=list)
    _counter: int = 0

    def add(
        self,
        category: str,
        title: str,
        description: str,
        details: Dict[str, Any] | None = None,
        severity: str = "info",
    ) -> None:
        self._counter += 1
        self.steps.append(
            AuditStep(
                step_id=self._counter,
                category=category,
                title=title,
                description=description,
                details=details or {},
                severity=severity,
            )
        )

    def to_dict(self) -> List[Dict[str, Any]]:
        return [vars(step) for step in self.steps]
